import { MODULE_EVENT_ID } from "./config.js";
import { AuthError, signIn, getToken, getUserId, clearSession } from "./auth.js";
import { gql } from "./api.js";
import { USER_QUERY, XP_QUERY, PROGRESS_QUERY } from "./queries.js";
import {
  formatXp, formatDate, totalXp, cumulativeXp, xpByProject,
  projectStatus, passFail, skillLevels,
} from "./data.js";
import {
  renderXpTimeline, renderXpByProject, renderPassFail,
  renderSkillsRadar, miniBar, hideTip,
} from "./charts.js";

const $ = (id) => document.getElementById(id);

const loginView = $("login-view");
const profileView = $("profile-view");
const form = $("login-form");
const idInput = $("identifier");
const pwInput = $("password");
const loginError = $("login-error");
const submitBtn = $("login-submit");

// Handles for interactive charts, replaced on every render.
let charts = {};

/* ---------------- Views ---------------- */

function showLogin(message = "") {
  hideTip();
  profileView.hidden = true;
  loginView.hidden = false;
  loginError.textContent = message;
  document.title = "Sign in · Zone01 Profile";
  idInput.focus();
}

function resetProfile() {
  // Remove every piece of the previous user's data from the page.
  for (const id of [
    "topbar-login", "avatar", "full-name", "login-name", "identity-list",
    "level-value", "xp-value", "xp-note", "audit-ratio", "current-projects",
    "recent-projects", "skills-radar", "skills-list", "xp-time-chart",
    "xp-project-chart", "passfail-chart",
  ]) {
    $(id).replaceChildren();
  }
  $("profile-error").hidden = true;
  $("profile-content").hidden = true;
  $("loading").hidden = false;
  charts = {};
  lastStats = null;
  sortMode = "xp";
  setSortButton("xp");
}

function logout(message = "") {
  clearSession();
  resetProfile();
  form.reset();
  showLogin(message);
}

/* ---------------- Login ---------------- */

function setFieldError(input, bad) {
  input.setAttribute("aria-invalid", bad ? "true" : "false");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const identifier = idInput.value.trim();
  const password = pwInput.value;

  setFieldError(idInput, !identifier);
  setFieldError(pwInput, !password);
  if (!identifier && !password) return void (loginError.textContent = "Please enter your username or email and your password.");
  if (!identifier) return void (loginError.textContent = "Please enter your username or email.");
  if (!password) return void (loginError.textContent = "Please enter your password.");

  loginError.textContent = "";
  submitBtn.disabled = true;
  submitBtn.textContent = "Signing in…";
  try {
    await signIn(identifier, password);
    form.reset();
    await loadProfile();
  } catch (err) {
    setFieldError(pwInput, true);
    loginError.textContent = err.message;
    pwInput.select();
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Sign in";
  }
});

$("toggle-password").addEventListener("click", (e) => {
  const showing = pwInput.type === "text";
  pwInput.type = showing ? "password" : "text";
  e.currentTarget.textContent = showing ? "Show" : "Hide";
  e.currentTarget.setAttribute("aria-pressed", String(!showing));
  e.currentTarget.setAttribute("aria-label", showing ? "Show password" : "Hide password");
});

$("logout-btn").addEventListener("click", () => logout());

/* ---------------- Profile ---------------- */

async function loadProfile() {
  const token = getToken();
  if (!token) return showLogin();

  resetProfile();
  loginView.hidden = true;
  profileView.hidden = false;

  try {
    const userId = getUserId(token); // as the subject suggests, read the id from the JWT
    const vars = { userId, eventId: MODULE_EVENT_ID };

    const [userData, xpData, progressData] = await Promise.all([
      gql(USER_QUERY),
      gql(XP_QUERY, vars),
      gql(PROGRESS_QUERY, vars),
    ]);

    const user = userData.user?.[0];
    if (!user) throw new Error("No user data returned.");

    renderIdentity(user);
    renderXp(xpData);
    renderAudit(user);
    renderProjects(progressData.progress);
    $("loading").hidden = true;
    $("profile-content").hidden = false;

    // Charts measure their SVG paths, so render them once the page is visible.
    renderSkills(xpData.skills);
    renderStats(xpData.xp, progressData.progress);
  } catch (err) {
    if (err instanceof AuthError) return logout(err.message);
    console.error(err);
    $("loading").hidden = true;
    const banner = $("profile-error");
    banner.textContent = `Could not load your profile. ${err.message}`;
    banner.hidden = false;
  }
}

function addKv(dl, key, value) {
  if (value === undefined || value === null || value === "") return;
  const dt = document.createElement("dt");
  dt.textContent = key;
  const dd = document.createElement("dd");
  dd.textContent = value;
  dl.append(dt, dd);
}

function renderIdentity(user) {
  const a = user.attrs || {};
  const fullName = [a.firstName, a.lastName].filter(Boolean).join(" ") || user.login;
  document.title = `${user.login} · Zone01 Profile`;

  $("topbar-login").textContent = user.login;
  $("avatar").textContent = (fullName[0] || "?").toUpperCase();
  $("full-name").textContent = fullName;
  $("login-name").textContent = `@${user.login}`;

  const dl = $("identity-list");
  addKv(dl, "User ID", user.id);
  addKv(dl, "Email", a.email);
  addKv(dl, "Campus", user.campus ? user.campus[0].toUpperCase() + user.campus.slice(1) : "");
  addKv(dl, "Member since", user.createdAt ? formatDate(user.createdAt) : "");
}

function renderXp({ xp, level }) {
  $("level-value").textContent = level[0]?.amount ?? "–";
  $("xp-value").textContent = formatXp(totalXp(xp));
  const projects = new Set(xp.map((t) => t.path)).size;
  $("xp-note").textContent = `Earned across ${projects} projects and exercises.`;
}

function renderAudit(user) {
  const box = $("audit-ratio");
  const up = user.totalUp || 0;
  const down = user.totalDown || 0;
  const ratio = user.auditRatio ?? (down ? up / down : 0);

  const value = document.createElement("div");
  value.className = "ratio";
  value.textContent = ratio.toFixed(1);
  value.style.color = ratio >= 1 ? "var(--pass)" : ratio >= 0.8 ? "var(--warn)" : "var(--fail)";

  const msg = document.createElement("p");
  msg.className = "muted ratio-msg";
  msg.textContent = ratio >= 1.5 ? "Excellent, keep auditing!" : ratio >= 1 ? "Good, you give as much as you get." : "Do more audits to raise your ratio.";

  const max = Math.max(up, down, 1);
  const bar = (label, amount, color) => {
    const row = document.createElement("div");
    row.className = "audit-bar";
    const l = document.createElement("span");
    l.textContent = label;
    const v = document.createElement("span");
    v.textContent = formatXp(amount);
    row.append(l, miniBar(amount / max, color), v);
    return row;
  };

  box.replaceChildren(value, msg, bar("Done ↑", up, "var(--accent)"), bar("Received ↓", down, "var(--accent-2)"));
}

function projectItem(name, date, status) {
  const li = document.createElement("li");
  const left = document.createElement("span");
  left.textContent = name + " ";
  if (status) {
    const badge = document.createElement("span");
    badge.className = `badge ${status}`;
    badge.textContent = status === "pass" ? "PASS" : status === "fail" ? "FAIL" : "IN PROGRESS";
    left.appendChild(badge);
  }
  const right = document.createElement("span");
  right.className = "date";
  right.textContent = formatDate(date);
  li.append(left, right);
  return li;
}

function fillList(ul, items, emptyText) {
  if (!items.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = emptyText;
    ul.replaceChildren(li);
    return;
  }
  ul.replaceChildren(...items);
}

function renderProjects(progress) {
  const { current, finished } = projectStatus(progress);
  fillList($("current-projects"), current.slice(0, 5).map((p) => projectItem(p.name, p.date, "wip")), "Nothing in progress.");
  fillList($("recent-projects"), finished.slice(0, 6).map((p) => projectItem(p.name, p.date, p.passed ? "pass" : "fail")), "No finished projects yet.");
}

function renderSkills(skillRows) {
  const skills = skillLevels(skillRows);
  renderSkillsRadar($("skills-radar"), skills);

  const items = skills.map((s) => {
    const li = document.createElement("li");
    const top = document.createElement("div");
    top.className = "skill-top";
    const name = document.createElement("span");
    name.textContent = s.name;
    const val = document.createElement("span");
    val.className = "muted";
    val.textContent = `${s.value}%`;
    top.append(name, val);
    const meter = document.createElement("div");
    meter.className = "meter";
    const fill = document.createElement("span");
    fill.style.width = `${Math.min(s.value, 100)}%`;
    meter.appendChild(fill);
    li.append(top, meter);
    return li;
  });
  fillList($("skills-list"), items, "No skills recorded yet.");
}

let lastStats = null;
let sortMode = "xp";

function renderStats(xpRows, progress) {
  lastStats = { xpRows, progress };
  charts.timeline = renderXpTimeline($("xp-time-chart"), cumulativeXp(xpRows));
  charts.projects = renderXpByProject($("xp-project-chart"), xpByProject(xpRows));
  charts.projects?.sort(sortMode);
  renderPassFail($("passfail-chart"), passFail(progress));
}

// Redraw the width-dependent charts when the layout width changes.
let resizeTimer;
let lastWidth = window.innerWidth;
window.addEventListener("resize", () => {
  if (window.innerWidth === lastWidth) return;
  lastWidth = window.innerWidth;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!lastStats || profileView.hidden) return;
    hideTip();
    charts.timeline = renderXpTimeline($("xp-time-chart"), cumulativeXp(lastStats.xpRows));
    charts.projects = renderXpByProject($("xp-project-chart"), xpByProject(lastStats.xpRows));
    charts.projects?.sort(sortMode);
  }, 200);
});

/* ---------------- Chart controls ---------------- */

function setSortButton(mode) {
  for (const b of document.querySelectorAll(".seg-btn")) {
    const on = b.dataset.sort === mode;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", String(on));
  }
}

for (const btn of document.querySelectorAll(".seg-btn")) {
  btn.addEventListener("click", () => {
    sortMode = btn.dataset.sort;
    setSortButton(sortMode);
    charts.projects?.sort(sortMode);
  });
}

$("replay-xp").addEventListener("click", () => charts.timeline?.replay());

/* ---------------- Start ---------------- */

if (getToken()) loadProfile();
else showLogin();
