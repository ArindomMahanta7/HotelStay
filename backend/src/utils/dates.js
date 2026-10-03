export function toISODate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export function todayISO() {
  return toISODate(new Date());
}

export function isValidISODate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function nightsBetween(checkIn, checkOut) {
  const start = Date.parse(`${toISODate(checkIn)}T00:00:00Z`);
  const end = Date.parse(`${toISODate(checkOut)}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return NaN;
  return Math.round((end - start) / 86400000);
}

export function addDaysISO(iso, days) {
  const d = new Date(`${toISODate(iso)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
