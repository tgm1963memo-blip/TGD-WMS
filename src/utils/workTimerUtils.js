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

export function formatDateYYYYMMDD(value) {
  if (!value) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    if (
      d.getFullYear() === Number(year)
      && d.getMonth() === Number(month) - 1
      && d.getDate() === Number(day)
    ) {
      return `${year}-${month}-${day}`;
    }
    return null;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = String(d.getFullYear()).padStart(4, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function combineDateAndEditedTime(yyyyMmDd, hhmm) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(yyyyMmDd ?? '').trim());
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(String(hhmm ?? '').trim());
  if (!dateMatch || !timeMatch) return null;

  const [, year, month, day] = dateMatch;
  const [, hours, minutes] = timeMatch;
  const d = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    0,
    0,
  );
  if (
    Number.isNaN(d.getTime())
    || d.getFullYear() !== Number(year)
    || d.getMonth() !== Number(month) - 1
    || d.getDate() !== Number(day)
    || d.getHours() !== Number(hours)
    || d.getMinutes() !== Number(minutes)
  ) {
    return null;
  }
  return d.toISOString();
}

export function formatTimeHHmm(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
}
