import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearSynced,
  enqueue,
  listInterrupted,
  listQueued,
  summarizeQueue,
  syncQueue,
  updateStatus,
} from '../../src/utils/offlineActionQueue.js';

// Just enough of IndexedDB for the queue: one store, requests that resolve on
// the next tick, and a transaction that completes after them.
function createFakeIndexedDb() {
  const rows = new Map();
  let nextId = 1;

  function request(run) {
    const req = {};
    queueMicrotask(() => {
      req.result = run();
      req.onsuccess?.();
    });
    return req;
  }

  const store = {
    add: (record) => request(() => { const id = nextId++; rows.set(id, { ...record, id }); return id; }),
    get: (id) => request(() => rows.get(id)),
    put: (record) => request(() => { rows.set(record.id, record); return record.id; }),
    delete: (id) => request(() => { rows.delete(id); }),
    getAll: () => request(() => [...rows.values()]),
  };

  const db = {
    objectStoreNames: { contains: () => true },
    close() {},
    transaction() {
      const tx = { objectStore: () => store };
      setTimeout(() => tx.oncomplete?.(), 0);
      return tx;
    },
  };

  return { open: () => request(() => db), rows };
}

const ok = () => Promise.resolve({});
let fakeDb;

// A record written by the app before clientActionId existed.
async function enqueueLegacy(payload, status) {
  await enqueue('LOCATION_UPDATE', payload);
  const [record] = [...fakeDb.rows.values()].slice(-1);
  delete record.clientActionId;
  record.status = status;
}

describe('offline action queue', () => {
  beforeEach(() => {
    fakeDb = createFakeIndexedDb();
    vi.stubGlobal('indexedDB', fakeDb);
  });

  it('resends an item cut off mid-send with the same action id', async () => {
    await enqueue('LOCATION_UPDATE', { palletNo: 7 });
    const [item] = await listQueued();
    await updateStatus(item.id, 'syncing');
    const handler = vi.fn(ok);

    await syncQueue({ LOCATION_UPDATE: handler });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][1].clientActionId).toBe(item.clientActionId);
  });

  it('keeps one action id across failed retries', async () => {
    await enqueue('LOCATION_UPDATE', { palletNo: 8 });
    const handler = vi.fn()
      .mockResolvedValueOnce({ error: new Error('TypeError: Failed to fetch') })
      .mockResolvedValueOnce({});

    await syncQueue({ LOCATION_UPDATE: handler });
    await syncQueue({ LOCATION_UPDATE: handler });

    const ids = handler.mock.calls.map(([, item]) => item.clientActionId);
    expect(ids[0]).toBeTruthy();
    expect(ids[1]).toBe(ids[0]);
  });

  it('gives an old failed record an id before resending it', async () => {
    await enqueueLegacy({ palletNo: 9 }, 'failed');
    const handler = vi.fn(ok);

    await syncQueue({ LOCATION_UPDATE: handler });

    expect(handler.mock.calls[0][1].clientActionId).toBeTruthy();
  });

  it('parks an old record left mid-send instead of replaying it', async () => {
    await enqueueLegacy({ palletNo: 7 }, 'syncing');

    const handler = vi.fn(ok);
    const result = await syncQueue({ LOCATION_UPDATE: handler });

    expect(handler).not.toHaveBeenCalled();
    expect(result.synced).toBe(0);
    expect((await listInterrupted()).map((entry) => entry.payload.palletNo)).toEqual([7]);
  });

  it('runs again for a call made during a run, so nothing queued meanwhile is skipped', async () => {
    await enqueue('LOCATION_UPDATE', { palletNo: 1 });
    let releaseFirst;
    const handler = vi.fn(({ palletNo }) => (palletNo === 1
      ? new Promise((resolve) => { releaseFirst = () => resolve({}); })
      : Promise.resolve({})));

    const first = syncQueue({ LOCATION_UPDATE: handler });
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    await enqueue('LOCATION_UPDATE', { palletNo: 2 });
    const second = syncQueue({ LOCATION_UPDATE: handler });
    releaseFirst();
    await Promise.all([first, second]);

    expect(handler.mock.calls.map(([payload]) => payload.palletNo)).toEqual([1, 2]);
  });

  it('sends an interrupted item again once a person sets it back to pending', async () => {
    await enqueue('LOCATION_UPDATE', { palletNo: 7 });
    const [item] = await listQueued();
    await updateStatus(item.id, 'interrupted');
    const handler = vi.fn(ok);

    await syncQueue({ LOCATION_UPDATE: handler });
    expect(handler).not.toHaveBeenCalled();

    await updateStatus(item.id, 'pending');
    await syncQueue({ LOCATION_UPDATE: handler });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('only replays the signed-in profile\'s items on a shared device', async () => {
    await enqueue('LOCATION_UPDATE', { palletNo: 1 }, { ownerId: 'staff-a' });
    await enqueue('LOCATION_UPDATE', { palletNo: 2 }, { ownerId: 'staff-b' });
    const handler = vi.fn(ok);

    await syncQueue({ LOCATION_UPDATE: handler }, { ownerId: 'staff-a' });

    expect(handler.mock.calls.map(([payload]) => payload.palletNo)).toEqual([1]);
    expect(await summarizeQueue('staff-b')).toEqual({ pending: 1, interrupted: 0 });
    expect(await summarizeQueue('staff-a')).toEqual({ pending: 0, interrupted: 0 });
  });

  it('still syncs records queued before owners existed', async () => {
    await enqueue('LOCATION_UPDATE', { palletNo: 3 });
    const handler = vi.fn(ok);

    await syncQueue({ LOCATION_UPDATE: handler }, { ownerId: 'staff-a' });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('sends each item once when two callers sync at the same time', async () => {
    await enqueue('LOCATION_UPDATE', { palletNo: 4 });
    const handler = vi.fn(ok);

    await Promise.all([
      syncQueue({ LOCATION_UPDATE: handler }),
      syncQueue({ LOCATION_UPDATE: handler }),
    ]);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(await listInterrupted()).toEqual([]);
  });

  it('keeps a failed item for retry and clears synced ones', async () => {
    await enqueue('LOCATION_UPDATE', { palletNo: 5 });
    await enqueue('LOCATION_UPDATE', { palletNo: 6 });
    const handler = vi.fn(({ palletNo }) => Promise.resolve(palletNo === 5 ? { error: new Error('ชนกัน') } : {}));

    const result = await syncQueue({ LOCATION_UPDATE: handler });
    await clearSynced();

    expect(result).toMatchObject({ synced: 1, failed: 1 });
    expect((await listQueued()).map((item) => [item.payload.palletNo, item.status])).toEqual([[5, 'failed']]);
  });
});
