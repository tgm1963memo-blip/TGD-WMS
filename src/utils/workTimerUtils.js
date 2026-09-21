// Shared helpers for the "start/finish work time" feature (Scan Center's
// DocumentTimerCard and the admin desktop's WorkPhaseTimeControl) — kept in
// one place since both need the exact same duration math and the same
// "take today's/the existing date, swap in an edited HH:MM" logic.

export function formatDurationBetween(startIso, finishIso) {
  if (!startIso || !finishIso) return null;
  const start = new Date(startIso);
  const finish = new Date(finishIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(finish.getTime())) return null;

  const totalMinutes = Math.max(0, Math.round((finish.getTime() - start.getTime()) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours} ชม ${minutes} นาที`;
  if (hours > 0) return `${hours} ชม`;
  return `${minutes} นาที`;
}

// Takes the date portion of `existingIso` (or today, if there's no existing
// timestamp yet) and swaps in the edited "HH:MM" from a native
// <input type="time">, returning a full ISO string suitable for the `at`
// param of setDepositReceivingTime/setWithdrawalDispatchTime.
export function combineDateWithEditedTime(existingIso, hhmm) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(hhmm ?? '').trim());
  if (!match) return null;

  const base = existingIso ? new Date(existingIso) : new Date();
  if (Number.isNaN(base.getTime())) return null;

  const [, hours, minutes] = match;
  base.setHours(Number(hours), Number(minutes), 0, 0);
  return base.toISOString();
}

export function formatTimeHHmm(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
}
