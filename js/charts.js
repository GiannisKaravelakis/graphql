// Hand-built SVG charts. No libraries.
import { formatXp, formatDate } from "./data.js";

const NS = "http://www.w3.org/2000/svg";

// Create an SVG element with attributes and optional parent.
export function svgEl(tag, attrs = {}, parent) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

function emptyState(container, text = "No data to display yet.") {
  const p = document.createElement("p");
  p.className = "empty";
  p.textContent = text;
  container.replaceChildren(p);
}

// "Nice" upper bound and step for an axis from 0 to max.
function niceScale(max, ticks = 5) {
  if (max <= 0) return { max: 1, step: 1 };
  const raw = max / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  return { max: Math.ceil(max / step) * step, step };
}

// Draw at the container's real pixel width so text stays readable on phones.
function chartWidth(container) {
  return Math.round(Math.min(900, Math.max(300, container.clientWidth || 800)));
}

function truncate(text, n) {
  return text.length > n ? text.slice(0, n - 1) + "…" : text;
}

/* ---------------- Tooltip ---------------- */

const tip = () => document.getElementById("tooltip");

export function showTip(event, title, lines = []) {
  const t = tip();
  t.replaceChildren();
  const strong = document.createElement("strong");
  strong.textContent = title;
  t.appendChild(strong);
  for (const line of lines) {
    const div = document.createElement("div");
    div.textContent = line;
    t.appendChild(div);
  }
  t.hidden = false;

  // Mouse events have coordinates; keyboard focus uses the element's box.
  let x, y;
  if (event.clientX || event.clientY) {
    x = event.clientX;
    y = event.clientY;
  } else {
    const r = event.currentTarget.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top;
  }
  const { offsetWidth: w, offsetHeight: h } = t;
  let left = x + 14;
  let top = y + 14;
  if (left + w > window.innerWidth - 8) left = x - w - 14;
  if (top + h > window.innerHeight - 8) top = y - h - 14;
  t.style.left = `${Math.max(8, left)}px`;
  t.style.top = `${Math.max(8, top)}px`;
}

export function hideTip() {
  tip().hidden = true;
}

// Show the tooltip on hover and on keyboard focus.
function bindTip(node, getContent) {
  const show = (e) => {
    const [title, lines] = getContent();
    showTip(e, title, lines);
  };
  node.addEventListener("mouseenter", show);
  node.addEventListener("mousemove", show);
  node.addEventListener("focus", show);
  node.addEventListener("mouseleave", hideTip);
  node.addEventListener("blur", hideTip);
}

/* ---------------- 1. XP over time (animated line + hover) ---------------- */

export function renderXpTimeline(container, points) {
  if (!points.length) return emptyState(container), null;

  const W = chartWidth(container), H = W < 500 ? 240 : 320;
  const m = { top: 20, right: 16, bottom: 40, left: W < 500 ? 56 : 70 };
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;

  const t0 = points[0].date.getTime();
  let t1 = points[points.length - 1].date.getTime();
  if (t1 === t0) t1 = t0 + 86_400_000;
  const { max: yMax, step } = niceScale(points[points.length - 1].value);

  const x = (d) => m.left + ((d.getTime() - t0) / (t1 - t0)) * iw;
  const y = (v) => m.top + ih - (v / yMax) * ih;

  const svg = svgEl("svg", {
    viewBox: `0 0 ${W} ${H}`,
    class: "xp-time",
    role: "img",
    "aria-label": `Cumulative XP from ${formatDate(points[0].date)} to ${formatDate(points[points.length - 1].date)}, reaching ${formatXp(points[points.length - 1].value)}`,
  });

  const defs = svgEl("defs", {}, svg);
  const grad = svgEl("linearGradient", { id: "xp-gradient", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  svgEl("stop", { offset: "0%", "stop-color": "#7c9cff", "stop-opacity": 0.45 }, grad);
  svgEl("stop", { offset: "100%", "stop-color": "#7c9cff", "stop-opacity": 0 }, grad);

  // Y grid + labels
  for (let v = 0; v <= yMax; v += step) {
    svgEl("line", { class: "grid-line", x1: m.left, x2: W - m.right, y1: y(v), y2: y(v) }, svg);
    svgEl("text", { x: m.left - 10, y: y(v) + 4, "text-anchor": "end" }, svg).textContent = formatXp(v);
  }

  // X labels (about 6)
  const xTicks = W < 500 ? 3 : 6;
  for (let i = 0; i <= xTicks; i++) {
    const d = new Date(t0 + ((t1 - t0) * i) / xTicks);
    svgEl("text", { x: x(d), y: H - 12, "text-anchor": "middle" }, svg).textContent =
      formatDate(d, { month: "short", year: "2-digit" });
  }

  // Step line: XP stays flat until the next transaction.
  let d = `M${x(points[0].date)},${y(0)} L${x(points[0].date)},${y(points[0].value)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` H${x(points[i].date)} V${y(points[i].value)}`;
  }
  const area = `${d} V${y(0)} Z`;
  svgEl("path", { d: area, class: "xp-area" }, svg);
  const line = svgEl("path", { d, class: "xp-line" }, svg);

  const dots = svgEl("g", {}, svg);
  points.forEach((p, i) => {
    const c = svgEl("circle", { cx: x(p.date), cy: y(p.value), r: 3, class: "xp-dot" }, dots);
    c.style.animationDelay = `${(0.2 + (i / points.length) * 2).toFixed(2)}s`;
  });

  // Hover: vertical guide + nearest point tooltip.
  const guide = svgEl("line", { class: "hover-line", y1: m.top, y2: m.top + ih, visibility: "hidden" }, svg);
  const marker = svgEl("circle", { r: 6, fill: "none", stroke: "#e8eaf0", "stroke-width": 2, visibility: "hidden" }, svg);
  const overlay = svgEl("rect", { x: m.left, y: m.top, width: iw, height: ih, fill: "transparent" }, svg);

  overlay.addEventListener("mousemove", (e) => {
    const box = svg.getBoundingClientRect();
    const mx = ((e.clientX - box.left) / box.width) * W;
    const t = t0 + ((mx - m.left) / iw) * (t1 - t0);
    let best = points[0];
    for (const p of points) {
      if (Math.abs(p.date - t) < Math.abs(best.date - t)) best = p;
    }
    guide.setAttribute("x1", x(best.date));
    guide.setAttribute("x2", x(best.date));
    marker.setAttribute("cx", x(best.date));
    marker.setAttribute("cy", y(best.value));
    guide.setAttribute("visibility", "visible");
    marker.setAttribute("visibility", "visible");
    showTip(e, best.name, [
      formatDate(best.date),
      `+${formatXp(best.gained)}`,
      `Total: ${formatXp(best.value)}`,
    ]);
  });
  overlay.addEventListener("mouseleave", () => {
    guide.setAttribute("visibility", "hidden");
    marker.setAttribute("visibility", "hidden");
    hideTip();
  });

  container.replaceChildren(svg);

  // Draw-on animation: dash the line by its own length, then animate to 0.
  const len = line.getTotalLength();
  line.style.strokeDasharray = len;
  line.style.strokeDashoffset = len;

  const play = () => {
    svg.classList.remove("animate");
    void svg.getBoundingClientRect(); // force reflow so the animation restarts
    svg.classList.add("animate");
  };

  // Start when the chart scrolls into view.
  const io = new IntersectionObserver((entries) => {
    if (entries.some((en) => en.isIntersecting)) {
      play();
      io.disconnect();
    }
  }, { threshold: 0.3 });
  io.observe(svg);

  return { replay: play };
}

/* ---------------- 2. XP by project (interactive bars) ---------------- */

export function renderXpByProject(container, projects) {
  if (!projects.length) return emptyState(container), null;

  const W = chartWidth(container);
  const rowH = 30;
  const labelW = W < 500 ? 120 : 190;
  const valueW = 70;
  const m = { top: 10, bottom: 10 };
  const H = m.top + m.bottom + projects.length * rowH;
  const maxXp = Math.max(...projects.map((p) => p.xp));
  const barMax = W - labelW - valueW - 10;

  const svg = svgEl("svg", {
    viewBox: `0 0 ${W} ${H}`,
    role: "list",
    "aria-label": "XP earned per project",
  });

  const rows = projects.map((p) => {
    const g = svgEl("g", {
      class: "bar-group bar-anim",
      tabindex: 0,
      role: "listitem",
      "aria-label": `${p.name}: ${formatXp(p.xp)}, ${formatDate(p.date)}`,
    }, svg);
    const label = svgEl("text", { class: "bar-label", x: labelW - 10, y: rowH / 2 + 4, "text-anchor": "end" }, g);
    label.textContent = truncate(p.name, W < 500 ? 16 : 26);
    const w = Math.max(2, (p.xp / maxXp) * barMax);
    svgEl("rect", { class: "bar", x: labelW, y: 5, height: rowH - 10, width: w, rx: 4 }, g);
    svgEl("text", { class: "bar-value", x: labelW + w + 8, y: rowH / 2 + 4 }, g).textContent = formatXp(p.xp);

    bindTip(g, () => [p.name, [`${formatXp(p.xp)}`, `Last XP: ${formatDate(p.date)}`]]);
    return { p, g };
  });

  const sorters = {
    xp: (a, b) => b.p.xp - a.p.xp,
    date: (a, b) => b.p.date - a.p.date,
    name: (a, b) => a.p.name.localeCompare(b.p.name),
  };

  // Re-order by moving each row; CSS transitions animate the transform.
  function sort(mode = "xp") {
    const ordered = rows.slice().sort(sorters[mode] || sorters.xp);
    ordered.forEach((r, i) => {
      r.g.style.transform = `translate(0px, ${m.top + i * rowH}px)`;
      svg.appendChild(r.g); // keep DOM/tab order in sync with what is shown
    });
  }

  sort("xp");
  container.replaceChildren(svg);
  return { sort };
}

/* ---------------- 3. PASS / FAIL donut ---------------- */

export function renderPassFail(container, { pass, fail }) {
  const total = pass + fail;
  if (!total) return emptyState(container, "No graded projects yet."), null;

  const size = 220, r = 80, stroke = 30;
  const C = 2 * Math.PI * r;
  const wrap = document.createElement("div");
  wrap.className = "donut-wrap";

  const svg = svgEl("svg", {
    viewBox: `0 0 ${size} ${size}`,
    role: "img",
    "aria-label": `${pass} passed, ${fail} failed out of ${total} graded attempts`,
  });
  const g = svgEl("g", { transform: `rotate(-90 ${size / 2} ${size / 2})` }, svg);
  svgEl("circle", { cx: size / 2, cy: size / 2, r, fill: "none", stroke: "#20242f", "stroke-width": stroke }, g);

  const segments = [
    { label: "PASS", value: pass, color: "var(--pass)" },
    { label: "FAIL", value: fail, color: "var(--fail)" },
  ];

  let offset = 0;
  const arcs = [];
  for (const s of segments) {
    if (!s.value) continue;
    const len = (s.value / total) * C;
    const arc = svgEl("circle", {
      class: "donut-seg",
      cx: size / 2, cy: size / 2, r,
      fill: "none",
      stroke: s.color,
      "stroke-width": stroke,
      "stroke-dasharray": `0 ${C}`,
      "stroke-dashoffset": -offset,
      tabindex: 0,
      "aria-label": `${s.label}: ${s.value}`,
    }, g);
    arc.style.transition = "stroke-dasharray 1.2s ease-out, transform 0.2s";
    const pct = ((s.value / total) * 100).toFixed(1);
    bindTip(arc, () => [s.label, [`${s.value} of ${total} attempts`, `${pct}%`]]);
    arcs.push({ arc, len });
    offset += len;
  }

  const pct = Math.round((pass / total) * 100);
  svgEl("text", { class: "donut-center", x: size / 2, y: size / 2 + 6, "text-anchor": "middle" }, svg).textContent = `${pct}%`;
  svgEl("text", { class: "donut-sub", x: size / 2, y: size / 2 + 26, "text-anchor": "middle" }, svg).textContent = "pass rate";

  const legend = document.createElement("ul");
  legend.className = "legend";
  for (const s of segments) {
    const li = document.createElement("li");
    const sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.background = s.color;
    li.append(sw, `${s.label}: ${s.value}`);
    legend.appendChild(li);
  }
  const totalLi = document.createElement("li");
  totalLi.className = "muted";
  totalLi.textContent = `${total} graded attempts`;
  legend.appendChild(totalLi);

  wrap.append(svg, legend);
  container.replaceChildren(wrap);

  // Grow the arcs after first paint.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    for (const { arc, len } of arcs) arc.setAttribute("stroke-dasharray", `${len} ${C - len}`);
  }));
}

/* ---------------- Bonus: skills radar ---------------- */

export function renderSkillsRadar(container, skills, maxAxes = 8) {
  const data = skills.slice(0, maxAxes);
  if (data.length < 3) return emptyState(container, "Not enough skills to draw a chart yet."), null;

  const size = 380, cx = size / 2, cy = size / 2, R = 120;
  const n = data.length;
  const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i, v) => [cx + Math.cos(angle(i)) * R * v, cy + Math.sin(angle(i)) * R * v];

  const svg = svgEl("svg", {
    viewBox: `0 0 ${size} ${size}`,
    role: "img",
    "aria-label": "Top skills: " + data.map((s) => `${s.name} ${s.value}%`).join(", "),
  });

  for (const level of [0.25, 0.5, 0.75, 1]) {
    const pts = data.map((_, i) => pt(i, level).join(",")).join(" ");
    svgEl("polygon", { class: "radar-grid", points: pts }, svg);
  }
  data.forEach((s, i) => {
    const [x2, y2] = pt(i, 1);
    svgEl("line", { class: "radar-grid", x1: cx, y1: cy, x2, y2 }, svg);
    const [lx, ly] = pt(i, 1.18);
    const cos = Math.cos(angle(i));
    const anchor = Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end";
    svgEl("text", { class: "radar-label", x: lx, y: ly + 4, "text-anchor": anchor }, svg).textContent = s.name;
  });

  const shape = data.map((s, i) => pt(i, Math.min(s.value, 100) / 100).join(",")).join(" ");
  svgEl("polygon", { class: "radar-shape", points: shape }, svg);
  data.forEach((s, i) => {
    const [x, y] = pt(i, Math.min(s.value, 100) / 100);
    const dot = svgEl("circle", { class: "radar-dot", cx: x, cy: y, r: 4, tabindex: 0, "aria-label": `${s.name}: ${s.value}%` }, svg);
    bindTip(dot, () => [s.name, [`${s.value}%`]]);
  });

  container.replaceChildren(svg);
}

/* ---------------- Small horizontal bar (audit card) ---------------- */

export function miniBar(fraction, color) {
  const svg = svgEl("svg", { viewBox: "0 0 100 10", preserveAspectRatio: "none", "aria-hidden": "true" });
  svgEl("rect", { x: 0, y: 0, width: 100, height: 10, rx: 5, fill: "#20242f" }, svg);
  svgEl("rect", { x: 0, y: 0, width: Math.max(0, Math.min(1, fraction)) * 100, height: 10, rx: 5, fill: color }, svg);
  return svg;
}
