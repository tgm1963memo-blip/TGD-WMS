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
//   { id, type, payload, queuedAt, status: 'pending'|'syncing'|'synced'|'failed', errorMessage }
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

export async function enqueue(type, payload) {
  return withStore('readwrite', (store) => {
    store.add({ type, payload, queuedAt: new Date().toISOString(), status: 'pending', errorMessage: null });
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

export async function updateStatus(id, status, errorMessage = null) {
  return withStore('readwrite', (store) => {
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const record = getRequest.result;
      if (!record) return;
      store.put({ ...record, status, errorMessage });
    };
  });
}

export async function removeAction(id) {
  return withStore('readwrite', (store) => {
    store.delete(id);
  });
}

// Replays every 'pending' or 'failed' item (a failed item is retried, not
// abandoned -- the caller decides when to stop retrying, e.g. by leaving it
// visible in a "needs attention" list) against the handler registered for
// its type, strictly in the order it was queued. `handlers` is
// `{ [type]: async (payload) => { error?: Error } }` -- a handler resolving
// with no error (or a falsy one) counts as success; anything else is
// recorded as a per-item failure and the queue moves on to the next item
// rather than stopping the whole batch.
export async function syncQueue(handlers) {
  const items = (await listQueued()).filter((item) => item.status === 'pending' || item.status === 'failed');
  const results = { synced: 0, failed: 0, failures: [] };

  for (const item of items) {
    const handler = handlers[item.type];
    if (!handler) continue;

    await updateStatus(item.id, 'syncing');
    try {
      const { error } = await handler(item.payload);
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
