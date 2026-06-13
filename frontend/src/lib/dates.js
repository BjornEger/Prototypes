// Week math helpers (ISO weeks, Monday-start).

export const DAY_LABELS_DA = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
export const MONTHS_DA = [
  "januar", "februar", "marts", "april", "maj", "juni",
  "juli", "august", "september", "oktober", "november", "december",
];

export function pad(n) { return n < 10 ? `0${n}` : `${n}`; }

export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function mondayOf(d) {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(d, n) {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
}

export function weekDates(monday) {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

// ISO week number
export function isoWeek(d) {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target) / 604800000);
}

export function formatWeekRange(monday) {
  const sun = addDays(monday, 6);
  const sMonth = MONTHS_DA[monday.getMonth()];
  const eMonth = MONTHS_DA[sun.getMonth()];
  if (monday.getMonth() === sun.getMonth()) {
    return `${monday.getDate()}.–${sun.getDate()}. ${sMonth}`;
  }
  return `${monday.getDate()}. ${sMonth} – ${sun.getDate()}. ${eMonth}`;
}

export function weekTotal(entries) {
  if (!entries) return 0;
  return Object.values(entries).reduce((a, b) => a + (parseFloat(b) || 0), 0);
}
