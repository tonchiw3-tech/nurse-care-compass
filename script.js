const sleepInput = document.getElementById("sleep-hours");
const shiftInput = document.getElementById("shift-type");
const napInput = document.getElementById("nap-hours");
const dailyNoteInput = document.getElementById("daily-note");
let sleepChart;

// DEMO ONLY: browser storage isolation is not production authorization.
// Future Spring Boot APIs must repeat STAFF ownership checks on the server.
const currentSession = NCCAuth.getSession();
const historyStorageKey = NCCAuth.getHealthHistoryKey();

document.querySelectorAll('input[type="number"]').forEach((input) => input.addEventListener("keydown", (event) => {
  if (event.key === "-") event.preventDefault();
}));

const valueOf = (id) => document.getElementById(id).value;
const valuesOf = (name) => Array.from(document.querySelectorAll(`input[name="${name}"]:checked`), (input) => input.value);
const readHistory = () => { try { return JSON.parse(localStorage.getItem(historyStorageKey)) || []; } catch { return []; } };
const isNightShift = (shift) => ["夜勤", "準夜勤", "深夜勤"].includes(shift);

function updateNapAvailability() {
  const night = isNightShift(shiftInput.value);
  napInput.disabled = !night;
  if (!night) napInput.value = "";
  document.getElementById("nap-help").textContent = night ? "入力は任意です" : "夜勤以外は入力不要です";
}

shiftInput.addEventListener("change", updateNapAvailability);
updateNapAvailability();

function recordHealth() {
  if (sleepInput.value === "") { alert("睡眠時間を入力してください"); return; }
  if (!sleepInput.checkValidity()) { sleepInput.reportValidity(); return; }
  const mentalState = valuesOf("mental-state");
  const consultationRequested = document.getElementById("consultation-request").checked || mentalState.includes("相談したい");
  const shareMentalState = document.getElementById("share-mental-state").checked;
  const shareDailyNote = document.getElementById("share-daily-note").checked;
  const record = {
    id: `${currentSession.id}-${Date.now()}`, ownerId: currentSession.id,
    date: new Date().toLocaleString("ja-JP"), sleep: sleepInput.value,
    shiftType: valueOf("shift-type"),
    overtime: valueOf("overtime") || "0", breakTaken: valueOf("break-taken"), napHours: valueOf("nap-hours") || "0",
    fatigue: valueOf("fatigue"), backPain: valueOf("back-pain"), mentalState, recovery: valueOf("recovery"),
    consultation: consultationRequested ? "あり" : "なし", consultationRequested, shareMentalState,
    dailyNote: dailyNoteInput.value.trim(), shareDailyNote
  };
  const history = readHistory(); history.unshift(record);
  localStorage.setItem(historyStorageKey, JSON.stringify(getRecentHistory(history)));
  document.getElementById("result").textContent = `記録しました：${record.shiftType}／睡眠 ${record.sleep}時間／疲労感 ${record.fatigue}`;
  showHistory();
}

function parseRecordDate(dateValue) { const date = new Date(dateValue); return Number.isNaN(date.getTime()) ? null : date; }
function getRecentHistory(history) {
  const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 1); const now = new Date();
  return history.filter((record) => { const date = parseRecordDate(record.date); return date && date >= cutoff && date <= now; });
}
function getMonthKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }

function updateSleepChart(history) {
  const labels = []; const totals = {}; const current = new Date(); current.setDate(1);
  for (let i = 11; i >= 0; i -= 1) { const month = new Date(current); month.setMonth(current.getMonth() - i); labels.push({ key: getMonthKey(month), label: `${month.getFullYear()}/${month.getMonth() + 1}` }); }
  history.forEach((record) => { const date = parseRecordDate(record.date); const sleep = Number(record.sleep); if (!date || !Number.isFinite(sleep)) return; const key = getMonthKey(date); totals[key] = totals[key] || { total: 0, count: 0 }; totals[key].total += sleep; totals[key].count += 1; });
  const values = labels.map((month) => totals[month.key] ? Number((totals[month.key].total / totals[month.key].count).toFixed(2)) : null);
  const empty = document.getElementById("chart-empty-months"); if (empty) empty.textContent = labels.filter((month) => !totals[month.key]).map((month) => month.label).join("、");
  const canvas = document.getElementById("sleep-chart"); if (!canvas || typeof Chart === "undefined") return;
  if (sleepChart) { sleepChart.data.labels = labels.map((month) => month.label); sleepChart.data.datasets[0].data = values; sleepChart.update(); return; }
  sleepChart = new Chart(canvas, { type: "line", data: { labels: labels.map((month) => month.label), datasets: [{ label: "平均睡眠時間", data: values, borderColor: "#22C7B8", backgroundColor: "rgba(34,199,184,.18)", pointBackgroundColor: "#22C7B8", tension: .25, spanGaps: false }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } } });
}

function updateMonthlySummary(history) {
  const area = document.getElementById("monthly-summary"); if (!area) return;
  const recent = history.filter((record) => { const date = parseRecordDate(record.date); return date && date >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); });
  const averageSleep = recent.length ? (recent.reduce((sum, record) => sum + Number(record.sleep || 0), 0) / recent.length).toFixed(1) : "-";
  const breaks = recent.filter((record) => record.breakTaken === "はい").length;
  const nights = recent.filter((record) => ["準夜勤", "深夜勤", "夜勤"].includes(record.shiftType)).length;
  const overtime = recent.reduce((sum, record) => sum + Number(record.overtime || 0), 0).toFixed(1);
  const metrics = [["平均睡眠時間", averageSleep, "時間"], ["休憩取得率", recent.length ? `${Math.round(breaks / recent.length * 100)}%` : "-", ""], ["残業時間", overtime, "時間"], ["夜勤回数", nights, "回"]];
  area.innerHTML = metrics.map(([label, value, unit]) => `<div class="metric-card"><span>${label}</span><strong>${value}</strong><small>${unit}</small></div>`).join("");
}

function showHistory() {
  const history = getRecentHistory(readHistory()); localStorage.setItem(historyStorageKey, JSON.stringify(history));
  const area = document.getElementById("history"); area.innerHTML = "";
  history.forEach((record) => {
    const item = document.createElement("p");
    const mentalStates = Array.isArray(record.mentalState) ? record.mentalState : (record.mentalState ? [record.mentalState] : []);
    const request = record.consultationRequested !== undefined ? record.consultationRequested : (record.consultation === "あり" || mentalStates.includes("相談したい"));
    const nap = isNightShift(record.shiftType) && record.napHours && record.napHours !== "0" ? `／仮眠 ${record.napHours}時間` : "";
    const note = record.dailyNote ? `／今日のひとこと：${record.dailyNote}` : "";
    item.textContent = `${record.date}｜${record.shiftType || "勤務区分未記録"}／超過勤務 ${record.overtime || "0"}時間／睡眠 ${record.sleep}時間／疲労感 ${record.fatigue || "-"}／休憩 ${record.breakTaken || "-"}${nap}${note}${mentalStates.length ? `／今日の気分・こころの状態 ${mentalStates.join("、")}` : ""}${request ? "／相談希望あり" : ""}`;
    area.appendChild(item);
  });
  updateSleepChart(history); updateMonthlySummary(history);
}

showHistory();

const voiceButton = document.getElementById("voice-input");
const voiceStatus = document.getElementById("voice-status");
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition) {
  voiceButton.disabled = true;
  voiceStatus.textContent = "このブラウザでは音声入力を利用できません";
} else {
  const recognition = new SpeechRecognition();
  recognition.lang = "ja-JP";
  recognition.interimResults = false;
  recognition.continuous = false;
  voiceButton.addEventListener("click", () => {
    recognition.start();
    voiceButton.disabled = true;
    voiceStatus.textContent = "聞いています…";
  });
  recognition.addEventListener("result", (event) => {
    const transcript = Array.from(event.results).map((result) => result[0].transcript).join("");
    dailyNoteInput.value = `${dailyNoteInput.value.trim()}${dailyNoteInput.value.trim() ? " " : ""}${transcript}`.slice(0, 200);
  });
  recognition.addEventListener("end", () => {
    voiceButton.disabled = false;
    voiceStatus.textContent = "";
  });
  recognition.addEventListener("error", (event) => {
    voiceButton.disabled = false;
    voiceStatus.textContent = event.error === "not-allowed" ? "マイクの使用を許可してください" : "音声を認識できませんでした";
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(() => {}));
}

const navItems = Array.from(document.querySelectorAll(".nav-item"));
const sections = Array.from(document.querySelectorAll(".app-section"));
const setActiveNav = (id) => navItems.forEach((item) => item.classList.toggle("is-active", item.getAttribute("href") === `#${id}`));
navItems.forEach((item) => item.addEventListener("click", () => setActiveNav(item.getAttribute("href").slice(1))));
if ("IntersectionObserver" in window) {
  const navObserver = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) setActiveNav(visible.target.id);
  }, { rootMargin: "-15% 0px -65% 0px", threshold: [0.1, 0.4, 0.8] });
  sections.forEach((section) => navObserver.observe(section));
}
