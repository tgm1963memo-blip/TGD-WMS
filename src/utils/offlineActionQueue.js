// Generic IndexedDB-backed action queue -- lets any feature (today:
// handheld location updates; later: offline stock counting) record an
// action while offline and replay it against the real backend once
// connectivity returns, without each feature reinventing its own queue.
//
// Deliberately built on the native indexedDB API rather than a library
// (idb/localforage/Dexie) -- the schema is a single object store with one
// status index, well within what's reasonable to hand-write, and this app
// otherwise has no client-storage dependency at all.
//
// A queued record looks like:
//   { id, type, payload, ownerId, clientActionId, queuedAt, status: 'pending'|'syncing'|'synced'|'failed'|'interrupted', errorMessage }
// `clientActionId` is sent with the action so the server can recognise a
// resend of something it already saved (see the 20261105120000 migration).
// `ownerId` is the handheld PIN profile that queued it: several staff share
// one device (and one Supabase session), so each person's work waits for
// that person. Records queued before this field existed have none and sync
// for whoever is signed in, as they always did.
// `type` is an open string so unrelated features can share one queue/db
// without coordinating on a shared schema -- each registers its own sync
// handler keyed by its own `type`.

const DB_NAME = 'tgd_offline_queue';
const DB_VERSION = 1;
const STORE_NAME = 'actions';

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available in this environment'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('status', 'status');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      const result = fn(store);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function newActionId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

export async function enqueue(type, payload, { ownerId = null } = {}) {
  return withStore('readwrite', (store) => {
    store.add({ type, payload, ownerId, clientActionId: newActionId(), queuedAt: new Date().toISOString(), status: 'pending', errorMessage: null });
  });
}

export async function listQueued() {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const all = await requestToPromise(store.getAll());
    return all.sort((a, b) => (a.queuedAt < b.queuedAt ? -1 : a.queuedAt > b.queuedAt ? 1 : 0));
  } finally {
    db.close();
  }
}

async function patchRecord(id, patch) {
  return withStore('readwrite', (store) => {
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const record = getRequest.result;
      if (!record) return;
      store.put({ ...record, ...patch });
    };
  });
}

export async function updateStatus(id, status, errorMessage = null) {
  return patchRecord(id, { status, errorMessage });
}

export async function removeAction(id) {
  return withStore('readwrite', (store) => {
    store.delete(id);
  });
}

function belongsTo(item, ownerId) {
  return !item.ownerId || !ownerId || item.ownerId === ownerId;
}

export async function summarizeQueue(ownerId = null) {
  const mine = (await listQueued()).filter((item) => belongsTo(item, ownerId));
  return {
    pending: mine.filter((item) => item.status === 'pending' || item.status === 'failed').length,
    interrupted: mine.filter((item) => item.status === 'interrupted').length,
  };
}

export async function listInterrupted(ownerId = null) {
  return (await listQueued()).filter((item) => item.status === 'interrupted' && belongsTo(item, ownerId));
}

// Replays every 'pending' or 'failed' item (a failed item is retried, not
// abandoned -- the caller decides when to stop retrying, e.g. by leaving it
// visible in a "needs attention" list) against the handler registered for
// its type, strictly in the order it was queued. `handlers` is
// `{ [type]: async (payload, item) => { error?: Error } }` -- a handler resolving
// with no error (or a falsy one) counts as success; anything else is
// recorded as a per-item failure and the queue moves on to the next item
// rather than stopping the whole batch.
//
// Every send carries the item's clientActionId, so a resend after a lost
// response (or an app killed mid-send, which leaves the item 'syncing') is
// recognised by the server instead of saved twice. Only records queued
// before that id existed, and left 'syncing', are parked as 'interrupted'
// for a person to check: for those the server could not tell.
//
// One run at a time, across tabs too where the browser supports Web Locks.
// A call made while a run is going gets a fresh run after it, with its own
// arguments, so an item set back to pending mid-run is not skipped.
let activeRun = null;
let nextRun = null;
let nextArgs = null;

function startRun(handlers, options) {
  const run = () => runSync(handlers, options);
  const locked = globalThis.navigator?.locks?.request
    ? globalThis.navigator.locks.request('tgd-offline-queue', run)
    : run();
  activeRun = locked.finally(() => { activeRun = null; });
  return activeRun;
}

export function syncQueue(handlers, options = {}) {
  if (!activeRun) return startRun(handlers, options);
  nextArgs = [handlers, options];
  if (!nextRun) {
    nextRun = activeRun.catch(() => {}).then(() => {
      nextRun = null;
      return startRun(...nextArgs);
    });
  }
  return nextRun;
}

async function runSync(handlers, { ownerId = null }) {
  const queued = (await listQueued()).filter((item) => belongsTo(item, ownerId));
  for (const item of queued.filter((entry) => entry.status === 'syncing')) {
    if (item.clientActionId) {
      item.status = 'pending';
      await updateStatus(item.id, 'pending');
    } else {
      await updateStatus(item.id, 'interrupted', 'ถูกตัดระหว่างส่ง');
    }
  }

  const items = queued.filter((item) => item.status === 'pending' || item.status === 'failed');
  const results = { synced: 0, failed: 0, failures: [] };

  for (const item of items) {
    const handler = handlers[item.type];
    if (!handler) continue;

    // An older record that failed before ids existed gets one now, before
    // its next send, so every later retry of it is safe.
    if (!item.clientActionId) {
      item.clientActionId = newActionId();
      await patchRecord(item.id, { clientActionId: item.clientActionId });
    }
    await updateStatus(item.id, 'syncing');
    try {
      const { error } = await handler(item.payload, item);
      if (error) {
        await updateStatus(item.id, 'failed', error.message ?? String(error));
        results.failed += 1;
        results.failures.push({ id: item.id, type: item.type, payload: item.payload, errorMessage: error.message ?? String(error) });
      } else {
        await updateStatus(item.id, 'synced');
        results.synced += 1;
      }
    } catch (err) {
      await updateStatus(item.id, 'failed', err.message ?? String(err));
      results.failed += 1;
      results.failures.push({ id: item.id, type: item.type, payload: item.payload, errorMessage: err.message ?? String(err) });
    }
  }

  return results;
}

export async function clearSynced() {
  const items = await listQueued();
  await Promise.all(items.filter((item) => item.status === 'synced').map((item) => removeAction(item.id)));
}
