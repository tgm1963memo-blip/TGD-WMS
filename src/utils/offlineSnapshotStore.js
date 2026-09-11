// Generic key/value snapshot store, backed by IndexedDB -- lets a feature
// prefetch whatever reference data it needs while online (a "snapshot") and
// read it back later while offline. Separate from offlineActionQueue.js
// (which queues outgoing writes) since this is for incoming/reference data;
// kept in its own IndexedDB database so the two never need to coordinate a
// shared schema version.

const DB_NAME = 'tgd_offline_snapshots';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';

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
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSnapshot(key, data) {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ key, data, savedAt: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function loadSnapshot(key) {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const record = await requestToPromise(tx.objectStore(STORE_NAME).get(key));
    return record ?? null;
  } finally {
    db.close();
  }
}
