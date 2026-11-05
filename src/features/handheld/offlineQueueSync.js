import { useEffect, useRef, useState } from 'react';
import { addDepositLineLocationAllocation } from '../../services/customerDepositRequestService.js';
import { supabase } from '../../services/supabaseClient.js';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';
import { clearSynced, listInterrupted, summarizeQueue, syncQueue } from '../../utils/offlineActionQueue.js';

export const LOCATION_UPDATE_ACTION_TYPE = 'LOCATION_UPDATE';

// While items are still waiting, try again on this beat: a send can fail
// right after reconnecting, before the expired token has been refreshed.
const RETRY_MS = 20000;
const RESULT_SHOWN_MS = 10000;

const SYNC_HANDLERS = {
  [LOCATION_UPDATE_ACTION_TYPE]: (payload, item) => addDepositLineLocationAllocation({
    lineId: payload.lineId, locationId: payload.locationId, palletNo: payload.palletNo,
    boxes: payload.boxes, weight: payload.weight,
    clientActionId: item.clientActionId, actorProfileId: item.ownerId,
  }),
};

// Sending without a signed-in session only turns good items into failures,
// so wait until supabase-js has a session (getSession refreshes one that
// expired, when it can reach the server).
async function hasUsableSession() {
  if (!supabase) return false;
  try {
    const { data } = await supabase.auth.getSession();
    return Boolean(data?.session?.access_token) && (data.session.expires_at ?? 0) * 1000 > Date.now();
  } catch {
    return false;
  }
}

export async function drainOfflineQueue(ownerId) {
  if (!(await hasUsableSession())) return { synced: 0, failed: 0, failures: [], skipped: true };
  const result = await syncQueue(SYNC_HANDLERS, { ownerId });
  await clearSynced();
  return result;
}

const EMPTY_STATUS = { pending: 0, interrupted: [], lastResult: null };

// Lives at the top of the handheld app rather than in one workflow, so
// queued work replays as soon as signal returns on whichever screen staff
// happen to be on. `refreshKey` re-runs it, e.g. on returning to the menu.
export function useOfflineQueueDrain(ownerId, refreshKey) {
  const isOnline = useOnlineStatus();
  const [status, setStatus] = useState(EMPTY_STATUS);
  const runId = useRef(0);

  // Each run is numbered so an answer for a previous PIN user, or an older
  // run that finished late, never overwrites the current one.
  async function drainAndRefresh() {
    const id = ++runId.current;
    const result = isOnline && ownerId ? await drainOfflineQueue(ownerId) : null;
    const [summary, interrupted] = await Promise.all([summarizeQueue(ownerId), listInterrupted(ownerId)]);
    if (id !== runId.current) return;
    const sentSomething = result && (result.synced > 0 || result.failed > 0);
    setStatus((current) => ({
      pending: summary.pending,
      interrupted,
      lastResult: sentSomething ? { ...result, at: Date.now() } : current.lastResult,
    }));
  }

  // A new PIN user starts with a clean banner, not the last person's result.
  useEffect(() => {
    runId.current += 1;
    setStatus(EMPTY_STATUS);
  }, [ownerId]);

  useEffect(() => {
    if (!ownerId) return;
    drainAndRefresh().catch((e) => console.error('[useOfflineQueueDrain]', e));
  }, [isOnline, ownerId, refreshKey]);

  useEffect(() => {
    if (!ownerId || !isOnline || status.pending === 0) return undefined;
    const timer = setInterval(() => {
      drainAndRefresh().catch((e) => console.error('[useOfflineQueueDrain]', e));
    }, RETRY_MS);
    return () => clearInterval(timer);
  }, [ownerId, isOnline, status.pending]);

  useEffect(() => {
    if (!status.lastResult) return undefined;
    const timer = setTimeout(() => setStatus((current) => ({ ...current, lastResult: null })), RESULT_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [status.lastResult]);

  return { ...status, isOnline, refresh: drainAndRefresh };
}
