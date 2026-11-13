// Thai plates are written inconsistently ("81-5480", "81 5480", "๘๑-๕๔๘๐",
// "1กข 1234 กทม."), so compare on a normalised form: Thai digits → Arabic,
// spaces / hyphens / dots dropped, Latin letters upper-cased.
const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';

export function normalizeVehicleRegistration(value) {
  if (value == null) return '';
  return String(value)
    .replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)))
    .replace(/[\s\-.]/g, '')
    .toUpperCase();
}

// The ร.3 plate is the one the customer declared (snapshotted into
// declared_vehicle_registration the first time staff change the plate).
// Before any staff edit there's no snapshot, so the current plate is still
// the declared one. After an edit only the snapshot counts — a blank one
// means the customer declared no plate, so there's nothing to compare.
export function getR3VehicleRegistration(header) {
  if (!header) return null;
  if (header.vehicle_registration_set_at) return header.declared_vehicle_registration ?? null;
  return header.vehicle_registration ?? null;
}

export function isVehicleRegistrationMismatch(actual, r3Plate) {
  const a = normalizeVehicleRegistration(actual);
  const b = normalizeVehicleRegistration(r3Plate);
  if (!b) return false;
  return a !== b;
}
