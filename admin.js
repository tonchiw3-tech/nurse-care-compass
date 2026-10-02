/* DEMO ONLY: client-side role gate. Repeat ownership/share checks in future server APIs. */
const adminSession = NCCAuth.requireRole("ADMIN");
if (!adminSession) throw new Error("ADMIN role is required");

const sampleStaff = [
  { id: "staff-a", name: "スタッフ A", role: "外来看護チーム", sleep: 6.4, breakRate: 86, overtime: 2.5, nightShifts: 2, fatigue: "普通", noBreak: 2, backPain: 1, consultationRequested: true, shareMentalState: false },
  { id: "staff-b", name: "スタッフ B", role: "病棟チーム", sleep: 5.8, breakRate: 67, overtime: 6, nightShifts: 5, fatigue: "やや強い", noBreak: 5, backPain: 3, consultationRequested: false, shareMentalState: false },
  { id: "staff-c", name: "スタッフ C", role: "手術室チーム", sleep: 7.1, breakRate: 100, overtime: .5, nightShifts: 0, fatigue: "少ない", noBreak: 0, backPain: 0, consultationRequested: false, shareMentalState: false },
  { id: "staff-d", name: "スタッフ D", role: "地域連携チーム", sleep: 6, breakRate: 75, overtime: 4, nightShifts: 1, fatigue: "強い", noBreak: 4, backPain: 2, consultationRequested: true, shareMentalState: true, mentalState: ["気分・こころの状態の共有を許可"] }
];

function fromHistory() {
  let history = []; try { history = JSON.parse(localStorage.getItem("healthHistory:staff-demo")) || []; } catch { return null; }
  const record = history[0]; if (!record) return null;
  return { id: "staff-demo", name: "本人の記録（デモ）", role: "本人が共有を許可した範囲のみ", sleep: Number(record.sleep || 0), breakRate: record.breakTaken === "はい" ? 100 : 0, overtime: Number(record.overtime || 0), nightShifts: ["準夜勤", "深夜勤", "夜勤"].includes(record.shiftType) ? 1 : 0, fatigue: record.fatigue || "-", noBreak: record.breakTaken === "はい" ? 0 : 1, backPain: record.backPain === "あり" ? 1 : 0, consultationRequested: record.consultationRequested === true || record.consultation === "あり", shareMentalState: record.shareMentalState === true, mentalState: Array.isArray(record.mentalState) ? record.mentalState : [], dailyNote: record.shareDailyNote === true ? record.dailyNote : "" };
}

const ownStaff = fromHistory();
const staffData = ownStaff ? [ownStaff, ...sampleStaff] : sampleStaff;
let selectedStaff = staffData[0];
let scheduleRange = "today";
let calendarDate = new Date();
let editingCalendarAppointmentId = "";
const CALENDAR_APPOINTMENTS_KEY = "adminCalendarAppointments:admin-demo";
const hasConsultationRequest = (staff) => staff.consultationRequested === true;
const statusChip = (text, className = "") => `<span class="status-chip ${className}">${text}</span>`;
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
function readSupportRecord(id) { try { return JSON.parse(localStorage.getItem(`adminSupport:${id}`)) || {}; } catch { return {}; } }
function saveSupportRecord(id, data) { localStorage.setItem(`adminSupport:${id}`, JSON.stringify(data)); }
function readCalendarAppointments() { try { const value = JSON.parse(localStorage.getItem(CALENDAR_APPOINTMENTS_KEY)); return Array.isArray(value) ? value : []; } catch { return []; } }
function saveCalendarAppointments(items) { localStorage.setItem(CALENDAR_APPOINTMENTS_KEY, JSON.stringify(items)); }
function todayString(date = new Date()) { const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 10); }
function dateObject(value) { const [year, month, day] = String(value).split("-").map(Number); return new Date(year, month - 1, day); }
function formatDate(value) { if (!value) return "日付未設定"; return dateObject(value).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", weekday: "short" }); }
function startOfWeek(date = new Date()) { const result = new Date(date); const day = result.getDay(); result.setDate(result.getDate() - (day === 0 ? 6 : day - 1)); result.setHours(0, 0, 0, 0); return result; }
function getSchedules(staff) {
  const support = readSupportRecord(staff.id);
  const schedules = Array.isArray(support.schedules) ? [...support.schedules] : [];
  if (support.nextFollowup && !schedules.some((schedule) => schedule.date === support.nextFollowup && String(schedule.type || "").includes("フォロー"))) {
    schedules.push({ id: `legacy-followup-${staff.id}`, date: support.nextFollowup, time: "", type: "フォロー予定", memo: "保存されている次回フォロー予定", completed: false });
  }
  return schedules;
}
function allSchedules() {
  const staffSchedules = staffData.flatMap((staff) => getSchedules(staff).map((schedule) => ({ ...schedule, staff, source: "support" })));
  const calendarAppointments = readCalendarAppointments().map((schedule) => ({ ...schedule, source: "calendar", staff: { id: `calendar-${schedule.id}`, name: schedule.staffName || "スタッフ未設定", role: "カレンダー登録" } }));
  return [...staffSchedules, ...calendarAppointments];
}
function scheduleTone(schedule) { if (schedule.completed) return "completed"; const target = dateObject(schedule.date); const today = dateObject(todayString()); const diff = Math.round((target - today) / 86400000); if (diff < 0) return "overdue"; if (diff === 0) return "today"; if (diff === 1) return "tomorrow"; if (diff <= 6 - (today.getDay() === 0 ? 6 : today.getDay() - 1)) return "week"; return ""; }
function calendarEventTone(schedule) { if (schedule.completed) return "completed"; const tone = scheduleTone(schedule); if (tone === "overdue") return "overdue"; if (tone === "today") return "today"; return String(schedule.type || "").includes("フォロー") ? "follow" : "interview"; }
function calendarEventLabel(schedule) { const name = schedule.staff?.name || schedule.staffName || ""; const shortType = String(schedule.type || "面談").replace("面談", "面談"); return `${schedule.time ? `${schedule.time} ` : ""}${name}${name ? " " : ""}${shortType}`.trim(); }
function nthMonday(year, month, nth) { const first = new Date(year, month - 1, 1); return 1 + ((8 - first.getDay()) % 7) + (nth - 1) * 7; }
function equinoxDay(year, type) { const elapsed = year - 1980; return Math.floor((type === "spring" ? 20.8431 : 23.2488) + 0.242194 * elapsed - Math.floor(elapsed / 4)); }
function getJapaneseHolidays(year) {
  const holidays = new Map();
  const add = (month, day, name) => holidays.set(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, name);
  add(1, 1, "元日"); add(1, nthMonday(year, 1, 2), "成人の日"); add(2, 11, "建国記念の日");
  if (year >= 2020) add(2, 23, "天皇誕生日");
  add(3, equinoxDay(year, "spring"), "春分の日"); add(4, 29, "昭和の日"); add(5, 3, "憲法記念日"); add(5, 4, "みどりの日"); add(5, 5, "こどもの日");
  add(7, year === 2020 ? 23 : year === 2021 ? 22 : nthMonday(year, 7, 3), "海の日"); add(8, year === 2020 ? 10 : year === 2021 ? 8 : 11, "山の日"); add(9, nthMonday(year, 9, 3), "敬老の日"); add(9, equinoxDay(year, "autumn"), "秋分の日"); add(10, year === 2020 ? 24 : year === 2021 ? 23 : nthMonday(year, 10, 2), "スポーツの日");
  add(11, 3, "文化の日"); add(11, 23, "勤労感謝の日");
  const baseDates = [...holidays.keys()];
  for (const date of baseDates) {
    const current = dateObject(date);
    if (current.getDay() !== 0) continue;
    const substitute = new Date(current);
    do { substitute.setDate(substitute.getDate() + 1); } while (holidays.has(todayString(substitute)));
    holidays.set(todayString(substitute), "振替休日");
  }
  for (let day = 2; day <= 364; day += 1) {
    const current = new Date(year, 0, day); if (current.getFullYear() !== year) break;
    const date = todayString(current); if (holidays.has(date)) continue;
    const previous = new Date(current); previous.setDate(previous.getDate() - 1);
    const next = new Date(current); next.setDate(next.getDate() + 1);
    if (holidays.has(todayString(previous)) && holidays.has(todayString(next))) holidays.set(date, "休日");
  }
  return holidays;
}
function inRange(schedule, range) { const date = dateObject(schedule.date); const today = dateObject(todayString()); if (range === "today") return schedule.date === todayString(); if (range === "week") { const start = startOfWeek(today); const end = new Date(start); end.setDate(end.getDate() + 6); return date >= start && date <= end; } return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth(); }

function renderSummary() { document.getElementById("staff-count").textContent = staffData.length; document.getElementById("support-count").textContent = staffData.filter(hasConsultationRequest).length; document.getElementById("follow-count").textContent = allSchedules().filter((item) => !item.completed).length; document.getElementById("rest-count").textContent = staffData.filter((staff) => staff.noBreak >= 4).length; }

function renderTable(filter = "all") {
  const body = document.getElementById("staff-table-body");
  const filtered = staffData.filter((staff) => filter === "all" || (filter === "consultation" && hasConsultationRequest(staff)) || (filter === "followup" && getSchedules(staff).some((schedule) => !schedule.completed)) || (filter === "rest" && staff.noBreak >= 4));
  body.innerHTML = filtered.map((staff) => { const support = readSupportRecord(staff.id); return `<tr class="${staff.id === selectedStaff.id ? "selected-row" : ""}"><td><button class="name-button" data-staff-id="${esc(staff.id)}">${esc(staff.name)}</button><small>${esc(staff.role)}</small></td><td><strong>${staff.sleep.toFixed(1)}</strong> 時間</td><td>${staff.breakRate}%</td><td>${staff.overtime.toFixed(1)}時間</td><td>${staff.nightShifts}回</td><td>${statusChip(esc(staff.fatigue))}</td><td>${staff.noBreak}日</td><td>${staff.backPain}日</td><td>${hasConsultationRequest(staff) ? statusChip("相談希望あり", "status-consult") : statusChip("相談希望なし")}</td><td>${esc(support.lastMeetingDate || "-")}</td><td>${esc(support.nextFollowup || "-")}</td><td><button class="detail-button" data-staff-id="${esc(staff.id)}">詳細を見る</button></td></tr>`; }).join("") || '<tr><td colspan="12" class="empty-state">該当するスタッフはいません。</td></tr>';
  body.querySelectorAll("[data-staff-id]").forEach((button) => button.addEventListener("click", () => { selectedStaff = staffData.find((staff) => staff.id === button.dataset.staffId); renderTable(document.getElementById("staff-filter").value); renderDetail(); document.querySelector(".detail-card").scrollIntoView({ behavior: "smooth", block: "start" }); }));
}

function scheduleMarkup(item, includeAction = true) { const schedule = item.schedule || item; const staff = item.staff || staffData.find((candidate) => candidate.id === item.staffId); const tone = scheduleTone(schedule); return `<article class="schedule-item schedule-${tone}"><div class="schedule-date"><strong>${esc(formatDate(schedule.date))}</strong><span>${esc(schedule.time || "時刻未定")}</span></div><div class="schedule-content"><div class="schedule-title"><strong>${esc(staff.name)}</strong>${statusChip(schedule.completed ? "実施済み" : "未実施", schedule.completed ? "status-done" : "status-attention")}</div><p><span class="schedule-type">${esc(schedule.type || "面談")}</span>${schedule.memo ? ` ／ ${esc(schedule.memo)}` : ""}</p></div>${includeAction && !schedule.completed && item.source !== "calendar" ? `<button type="button" class="complete-button" data-complete-staff="${esc(staff.id)}" data-complete-id="${esc(schedule.id)}">実施済みにする</button>` : ""}</article>`; }
function renderReminders() { const items = allSchedules().filter((item) => !item.completed && [0, 1].includes(Math.round((dateObject(item.date) - dateObject(todayString())) / 86400000))); document.getElementById("reminder-list").innerHTML = items.length ? items.map((item) => `<div class="reminder ${scheduleTone(item)}"><strong>${item.date === todayString() ? "今日の面談があります" : "明日フォロー予定のスタッフがいます"}</strong><span>${esc(item.staff.name)} ／ ${esc(item.time || "時刻未定")}</span></div>`).join("") : '<p class="muted">今日・明日の面談予定はありません。</p>'; }

function renderSchedule() {
  const items = allSchedules().filter((item) => inRange(item, scheduleRange)).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const pending = allSchedules().filter((item) => !item.completed); document.getElementById("today-schedule-count").textContent = pending.filter((item) => item.date === todayString()).length;
  const weekStart = startOfWeek(); const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6); document.getElementById("week-schedule-count").textContent = pending.filter((item) => { const date = dateObject(item.date); return date >= weekStart && date <= weekEnd; }).length;
  document.getElementById("schedule-list").innerHTML = items.length ? items.map((item) => scheduleMarkup(item)).join("") : '<p class="empty-state">この区分の面談予定はありません。</p>';
  document.querySelectorAll("[data-complete-staff]").forEach((button) => button.addEventListener("click", () => { selectedStaff = staffData.find((staff) => staff.id === button.dataset.completeStaff); renderTable(document.getElementById("staff-filter").value); renderDetail(button.dataset.completeId); document.querySelector(".detail-card").scrollIntoView({ behavior: "smooth", block: "start" }); })); renderCalendar();
}

function renderCalendar() {
  const year = calendarDate.getFullYear(); const month = calendarDate.getMonth(); const first = new Date(year, month, 1); const lastDay = new Date(year, month + 1, 0).getDate(); const holidays = getJapaneseHolidays(year); document.getElementById("calendar-title").textContent = `${year}年${month + 1}月`;
  const headers = ["月", "火", "水", "木", "金", "土", "日"].map((day) => `<span class="calendar-weekday">${day}</span>`).join(""); const offset = (first.getDay() + 6) % 7; let cells = ""; for (let index = 0; index < offset; index += 1) cells += '<span class="calendar-empty"></span>';
  for (let day = 1; day <= lastDay; day += 1) { const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`; const holiday = holidays.get(date); const items = allSchedules().filter((item) => item.date === date); const eventLabels = items.slice(0, 2).map((item) => `<span class="calendar-event calendar-event-${calendarEventTone(item)}" title="${esc(`${item.staff.name}：${calendarEventLabel(item)}`)}"><i aria-hidden="true"></i><em>${esc(calendarEventLabel(item))}</em></span>`).join(""); const holidayLabel = holiday ? `<span class="calendar-holiday" title="${esc(holiday)}">${esc(holiday)}</span>` : ""; const ariaLabel = `${date}${holiday ? ` ${holiday}` : ""}${items.length ? ` ${items.length}件の予定` : " 予定なし"}`; cells += `<button type="button" class="calendar-day ${date === todayString() ? "is-today" : ""} ${holiday ? "is-holiday" : ""}" data-calendar-date="${date}" aria-label="${esc(ariaLabel)}"><strong>${day}</strong>${holidayLabel}<span class="calendar-events">${eventLabels}${items.length > 2 ? `<small class="calendar-more">ほか${items.length - 2}件</small>` : ""}</span></button>`; }
  document.getElementById("schedule-calendar").innerHTML = headers + cells; document.querySelectorAll("[data-calendar-date]").forEach((button) => button.addEventListener("click", () => renderCalendarDay(button.dataset.calendarDate)));
}
function calendarAppointmentMarkup(item) { const schedule = item.schedule || item; const tone = scheduleTone(schedule); return `<article class="schedule-item schedule-${tone} calendar-appointment-item"><div class="schedule-date"><strong>${esc(schedule.time || "時刻未定")}</strong><span>${schedule.completed ? "実施済み" : "未実施"}</span></div><div class="schedule-content"><div class="schedule-title"><strong>${esc(schedule.staffName || item.staff?.name || "スタッフ未設定")}</strong>${statusChip(schedule.completed ? "実施済み" : "未実施", schedule.completed ? "status-done" : "status-attention")}</div><p><span class="schedule-type schedule-type-${esc(String(schedule.type || "その他").replace(/面談|相談対応|その他/g, "").trim())}">${esc(schedule.type || "その他")}</span>${schedule.memo ? ` ／ ${esc(schedule.memo)}` : ""}</p></div><div class="calendar-appointment-actions"><button type="button" class="calendar-action-button" data-calendar-edit="${esc(schedule.id)}">編集</button><button type="button" class="calendar-action-button" data-calendar-complete="${esc(schedule.id)}">${schedule.completed ? "未実施に戻す" : "実施済みにする"}</button><button type="button" class="calendar-action-button calendar-delete-button" data-calendar-delete="${esc(schedule.id)}">削除</button></div></article>`; }
function calendarFormMarkup(date, appointment = {}) { return `<form id="calendar-appointment-form" class="calendar-appointment-form"><h5>${appointment.id ? "予定を編集" : "この日の予定を登録"}</h5><div class="calendar-form-grid"><label>スタッフ名<input id="calendar-staff-name" type="text" maxlength="80" required value="${esc(appointment.staffName || "")}" placeholder="Aさん"></label><label>予定時刻<input id="calendar-time" type="time" required value="${esc(appointment.time || "")}"></label><label>予定種別<select id="calendar-type"><option ${appointment.type === "定期面談" ? "selected" : ""}>定期面談</option><option ${appointment.type === "フォロー面談" ? "selected" : ""}>フォロー面談</option><option ${appointment.type === "新人面談" ? "selected" : ""}>新人面談</option><option ${appointment.type === "キャリア面談" ? "selected" : ""}>キャリア面談</option><option ${appointment.type === "相談対応" ? "selected" : ""}>相談対応</option><option ${appointment.type === "その他" ? "selected" : ""}>その他</option></select></label><label class="calendar-form-memo">簡単なメモ<textarea id="calendar-memo" rows="2" maxlength="200" placeholder="確認したいことなど">${esc(appointment.memo || "")}</textarea></label></div><div class="calendar-form-actions"><button type="submit">${appointment.id ? "変更を保存" : "予定を保存"}</button>${appointment.id ? '<button type="button" class="calendar-cancel-button" id="calendar-cancel-edit">キャンセル</button>' : ""}</div><p id="calendar-appointment-status" class="muted" role="status"></p></form>`; }
function renderCalendarDay(date, appointment = null) {
  editingCalendarAppointmentId = appointment?.id || "";
  const items = allSchedules().filter((item) => item.date === date); const holiday = getJapaneseHolidays(dateObject(date).getFullYear()).get(date); const detail = document.getElementById("calendar-day-detail");
  detail.innerHTML = `<h4>${esc(formatDate(date))}${holiday ? `（${esc(holiday)}）` : ""}の予定</h4>${calendarFormMarkup(date, appointment || { date })}<div class="calendar-day-list">${items.length ? items.map((item) => item.source === "calendar" ? calendarAppointmentMarkup(item) : scheduleMarkup(item, false)).join("") : '<p class="muted">予定なし</p>'}</div>`;
  const form = document.getElementById("calendar-appointment-form"); form.addEventListener("submit", (event) => { event.preventDefault(); if (!form.reportValidity()) return; const values = { staffName: document.getElementById("calendar-staff-name").value.trim(), time: document.getElementById("calendar-time").value, type: document.getElementById("calendar-type").value, memo: document.getElementById("calendar-memo").value.trim() }; const appointments = readCalendarAppointments(); const existingIndex = appointments.findIndex((item) => item.id === editingCalendarAppointmentId); if (existingIndex >= 0) appointments[existingIndex] = { ...appointments[existingIndex], ...values }; else appointments.push({ id: `calendar-${Date.now()}`, date, ...values, completed: false }); saveCalendarAppointments(appointments); editingCalendarAppointmentId = ""; renderAll(); renderCalendarDay(date); });
  const cancelButton = document.getElementById("calendar-cancel-edit"); if (cancelButton) cancelButton.addEventListener("click", () => renderCalendarDay(date));
  detail.querySelectorAll("[data-calendar-edit]").forEach((button) => button.addEventListener("click", () => { const target = readCalendarAppointments().find((item) => item.id === button.dataset.calendarEdit); if (target) renderCalendarDay(target.date, target); }));
  detail.querySelectorAll("[data-calendar-complete]").forEach((button) => button.addEventListener("click", () => { const appointments = readCalendarAppointments().map((item) => item.id === button.dataset.calendarComplete ? { ...item, completed: !item.completed, completedAt: item.completed ? "" : todayString() } : item); saveCalendarAppointments(appointments); renderAll(); renderCalendarDay(date); }));
  detail.querySelectorAll("[data-calendar-delete]").forEach((button) => button.addEventListener("click", () => { if (!window.confirm("この予定を削除しますか？")) return; saveCalendarAppointments(readCalendarAppointments().filter((item) => item.id !== button.dataset.calendarDelete)); renderAll(); renderCalendarDay(date); }));
}

function renderDetail(completingId = "") {
  const staff = selectedStaff; const support = readSupportRecord(staff.id); const schedules = getSchedules(staff); const mental = staff.shareMentalState && staff.mentalState?.length ? `<div class="shared-mental-state"><h3>本人が共有を許可した気分・こころの状態</h3><p>${esc(staff.mentalState.join("、"))}</p></div>` : `<div class="shared-mental-state"><p class="muted">気分・こころの状態は本人が共有を許可していないため表示しません。</p></div>`; const pending = schedules.filter((schedule) => !schedule.completed); const selectedCompletion = completingId || (pending[0] && pending[0].id) || "";
  document.getElementById("staff-detail").innerHTML = `<div class="detail-intro"><div><h3>${esc(staff.name)}</h3><p class="muted">${esc(staff.role)} ／ 本人が共有を許可した範囲だけを表示</p></div><div>${hasConsultationRequest(staff) ? statusChip("相談希望あり", "status-consult") : statusChip("相談希望なし")}</div></div>${mental}<div class="detail-stats"><div><span>直近の平均睡眠</span><strong>${staff.sleep.toFixed(1)}<small>時間</small></strong></div><div><span>休憩取得率</span><strong>${staff.breakRate}<small>%</small></strong></div><div><span>残業時間</span><strong>${staff.overtime.toFixed(1)}<small>時間</small></strong></div><div><span>夜勤回数</span><strong>${staff.nightShifts}<small>回</small></strong></div></div><div class="support-grid"><div class="support-panel"><h3>面談予定を登録</h3><label>面談予定日 <input id="schedule-date" type="date"></label><label>予定時刻 <input id="schedule-time" type="time"></label><label>面談種別 <select id="schedule-type"><option>定期面談</option><option>フォロー面談</option><option>新人面談</option><option>キャリア面談</option><option>相談対応</option><option>その他</option></select></label><label>簡単な予定メモ <textarea id="schedule-memo" rows="2" maxlength="200" placeholder="確認したいことなど"></textarea></label><button id="add-schedule" type="button">予定を追加</button><p id="schedule-saved" class="muted" role="status"></p></div><div class="support-panel"><h3>面談・フォロー記録</h3><label>最終面談日 <input id="last-meeting-date" type="date" value="${esc(support.lastMeetingDate || "")}"></label><label>次回フォロー予定日 <input id="next-followup" type="date" value="${esc(support.nextFollowup || "")}"></label><textarea id="meeting-note" rows="3" maxlength="500" placeholder="面談記録（管理者のみ）">${esc(support.meetingNote || "")}</textarea><button id="save-support" type="button">面談記録を保存</button><p id="support-saved" class="muted" role="status"></p>${pending.length ? `<div class="completion-box"><h4>面談を実施済みにする</h4><label>対象予定 <select id="completion-schedule">${pending.map((schedule) => `<option value="${esc(schedule.id)}" ${schedule.id === selectedCompletion ? "selected" : ""}>${esc(formatDate(schedule.date))} ${esc(schedule.type || "面談")}</option>`).join("")}</select></label><label>今回の面談記録 <textarea id="completion-note" rows="2" maxlength="500" placeholder="実施内容やフォロー事項"></textarea></label><label>次回フォロー予定日（任意） <input id="completion-followup" type="date"></label><button id="complete-schedule" type="button">実施済みにする</button></div>` : ""}</div></div>`;
  document.getElementById("add-schedule").addEventListener("click", () => { const date = document.getElementById("schedule-date").value; if (!date) { document.getElementById("schedule-date").reportValidity(); return; } const next = getSchedules(staff); next.push({ id: `schedule-${Date.now()}`, date, time: document.getElementById("schedule-time").value, type: document.getElementById("schedule-type").value, memo: document.getElementById("schedule-memo").value.trim(), completed: false }); saveSupportRecord(staff.id, { ...readSupportRecord(staff.id), schedules: next, nextFollowup: date }); renderAll(); renderDetail(); });
  document.getElementById("save-support").addEventListener("click", () => { saveSupportRecord(staff.id, { ...readSupportRecord(staff.id), lastMeetingDate: document.getElementById("last-meeting-date").value, nextFollowup: document.getElementById("next-followup").value, meetingNote: document.getElementById("meeting-note").value.trim(), schedules: getSchedules(staff) }); renderAll(); renderDetail(); });
  const completeButton = document.getElementById("complete-schedule"); if (completeButton) completeButton.addEventListener("click", () => { const id = document.getElementById("completion-schedule").value; const record = readSupportRecord(staff.id); const next = getSchedules(staff).map((schedule) => schedule.id === id ? { ...schedule, completed: true, completedAt: todayString() } : schedule); const note = document.getElementById("completion-note").value.trim(); const followup = document.getElementById("completion-followup").value; saveSupportRecord(staff.id, { ...record, schedules: next, lastMeetingDate: todayString(), nextFollowup: followup || record.nextFollowup || "", meetingNote: note ? `${record.meetingNote ? `${record.meetingNote}\n` : ""}${todayString()} 実施: ${note}` : record.meetingNote || "" }); renderAll(); renderDetail(); });
}

function renderAll() { renderSummary(); renderTable(document.getElementById("staff-filter").value); renderSchedule(); renderReminders(); }
renderAll(); renderDetail(); document.getElementById("staff-filter").addEventListener("change", (event) => renderTable(event.target.value));
document.querySelectorAll("[data-schedule-range]").forEach((button) => button.addEventListener("click", () => { scheduleRange = button.dataset.scheduleRange; document.querySelectorAll("[data-schedule-range]").forEach((tab) => tab.classList.toggle("is-active", tab === button)); renderSchedule(); }));
document.getElementById("calendar-prev").addEventListener("click", () => { calendarDate.setDate(1); calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); }); document.getElementById("calendar-next").addEventListener("click", () => { calendarDate.setDate(1); calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); });
