// Pure helpers that turn raw GraphQL rows into what the UI needs.
// TODO (numbers pass): check rounding and filters against the platform dashboard.

// XP sizes use base 1000, like the platform (1 kB = 1000 B).
export function formatXp(amount) {
  const n = Number(amount) || 0;
  if (Math.abs(n) < 1000) return `${Math.round(n)} B`;
  if (Math.abs(n) < 1_000_000) return `${Math.round(n / 1000)} kB`;
  return `${(n / 1_000_000).toFixed(2)} MB`;
}

export function formatDate(iso, opts = { day: "numeric", month: "short", year: "numeric" }) {
  return new Date(iso).toLocaleDateString("en-GB", opts);
}

export function lastSegment(path = "") {
  return path.split("/").filter(Boolean).pop() || path;
}

export function prettify(slug = "") {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function totalXp(xpRows) {
  return xpRows.reduce((sum, t) => sum + t.amount, 0);
}

// Cumulative XP points for the time chart: [{ date, value, gained, name }]
export function cumulativeXp(xpRows) {
  let running = 0;
  return xpRows
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((t) => {
      running += t.amount;
      return {
        date: new Date(t.createdAt),
        value: running,
        gained: t.amount,
        name: t.object?.name || lastSegment(t.path),
      };
    });
}

// XP summed per project/exercise path: [{ name, xp, date }]
export function xpByProject(xpRows) {
  const map = new Map();
  for (const t of xpRows) {
    const key = t.path;
    const entry = map.get(key) || {
      name: t.object?.name || lastSegment(t.path),
      xp: 0,
      date: new Date(t.createdAt),
    };
    entry.xp += t.amount;
    const d = new Date(t.createdAt);
    if (d > entry.date) entry.date = d;
    map.set(key, entry);
  }
  return [...map.values()].filter((p) => p.xp > 0);
}

// Latest progress row per project path (rows arrive newest first).
function latestPerProject(progressRows) {
  const seen = new Map();
  for (const p of progressRows) {
    if (!seen.has(p.path)) seen.set(p.path, p);
  }
  return [...seen.values()];
}

export function projectStatus(progressRows) {
  const latest = latestPerProject(progressRows);
  const toItem = (p) => ({
    name: p.object?.name || lastSegment(p.path),
    date: new Date(p.updatedAt || p.createdAt),
    passed: p.grade !== null && p.grade >= 1,
  });
  return {
    current: latest.filter((p) => p.grade === null).map(toItem),
    finished: latest.filter((p) => p.grade !== null).map(toItem),
  };
}

// Every graded attempt counts, so failed attempts that were later passed still show.
export function passFail(progressRows) {
  let pass = 0;
  let fail = 0;
  for (const p of progressRows) {
    if (p.grade === null) continue;
    if (p.grade >= 1) pass++;
    else fail++;
  }
  return { pass, fail };
}

// Highest amount per skill type: [{ name, value }] sorted desc.
export function skillLevels(skillRows) {
  const map = new Map();
  for (const s of skillRows) {
    const name = prettify(s.type.replace(/^skill_/, ""));
    map.set(name, Math.max(map.get(name) || 0, s.amount));
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}
