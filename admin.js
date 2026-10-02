const sampleStaff = [
  { id: "staff-a", name: "スタッフ A", role: "外来看護チーム", sleep: 6.4, breakRate: 86, overtime: 2.5, nightShifts: 2, fatigue: "安定", noBreak: 2, backPain: 1, consultationRequested: true, shareMentalState: false, mentalState: ["気持ちが落ち込んでいる"] },
  { id: "staff-b", name: "スタッフ B", role: "病棟チーム", sleep: 5.8, breakRate: 67, overtime: 6, nightShifts: 5, fatigue: "やや強い", noBreak: 5, backPain: 3, consultationRequested: false, shareMentalState: false, mentalState: ["少し疲れている"] },
  { id: "staff-c", name: "スタッフ C", role: "手術室チーム", sleep: 7.1, breakRate: 100, overtime: .5, nightShifts: 0, fatigue: "少ない", noBreak: 0, backPain: 0, consultationRequested: false, shareMentalState: false, mentalState: ["落ち着いている"] },
  { id: "staff-d", name: "スタッフ D", role: "地域連携チーム", sleep: 6, breakRate: 75, overtime: 4, nightShifts: 1, fatigue: "強い", noBreak: 4, backPain: 2, consultationRequested: true, shareMentalState: true, mentalState: ["相談したい"] }
];

function fromHistory() {
  let history = []; try { history = JSON.parse(localStorage.getItem("healthHistory")) || []; } catch { return null; }
  const record = history[0]; if (!record) return null;
  return { id: "self", name: "本人の記録", role: "localStorageの記録", sleep: Number(record.sleep || 0), breakRate: record.breakTaken === "はい" ? 100 : 0, overtime: Number(record.overtime || 0), nightShifts: ["準夜勤", "深夜勤", "夜勤"].includes(record.shiftType) ? 1 : 0, fatigue: record.fatigue || "-", noBreak: record.breakTaken === "はい" ? 0 : 1, backPain: record.backPain === "あり" ? 1 : 0, consultationRequested: record.consultationRequested === true || record.consultation === "あり", shareMentalState: record.shareMentalState === true, mentalState: Array.isArray(record.mentalState) ? record.mentalState : [] };
}

const storedStaff = fromHistory();
const staffData = storedStaff ? [storedStaff, ...sampleStaff] : sampleStaff;
let selectedStaff = staffData[0];

function hasConsultationRequest(staff) { return staff.consultationRequested === true; }
function statusChip(text, className = "") { return `<span class="status-chip ${className}">${text}</span>`; }

function renderSummary() {
  document.getElementById("staff-count").textContent = staffData.length;
  document.getElementById("support-count").textContent = staffData.filter(hasConsultationRequest).length;
  document.getElementById("follow-count").textContent = "-";
  document.getElementById("rest-count").textContent = staffData.filter((staff) => staff.noBreak >= 4).length;
}

function renderTable(filter = "all") {
  const body = document.getElementById("staff-table-body");
  const filtered = staffData.filter((staff) => filter === "all" || (filter === "consultation" && hasConsultationRequest(staff)) || (filter === "rest" && staff.noBreak >= 4));
  body.innerHTML = filtered.map((staff) => `<tr class="${staff.id === selectedStaff.id ? "selected-row" : ""}">
    <td><button class="name-button" data-staff-id="${staff.id}">${staff.name}</button><small>${staff.role}</small></td>
    <td><strong>${staff.sleep.toFixed(1)}</strong> 時間</td><td>${staff.breakRate}%</td><td>${staff.overtime.toFixed(1)}時間</td><td>${staff.nightShifts}回</td>
    <td>${statusChip(staff.fatigue)}</td><td>${staff.noBreak}日</td><td>${staff.backPain}日</td>
    <td>${hasConsultationRequest(staff) ? statusChip("相談希望あり", "status-consult") : statusChip("相談希望なし")}</td>
    <td>-</td><td>-</td><td><button class="detail-button" data-staff-id="${staff.id}">詳細を見る</button></td>
  </tr>`).join("") || '<tr><td colspan="12" class="empty-state">該当するスタッフはいません。</td></tr>';
  body.querySelectorAll("[data-staff-id]").forEach((button) => button.addEventListener("click", () => { selectedStaff = staffData.find((staff) => staff.id === button.dataset.staffId); renderTable(document.getElementById("staff-filter").value); renderDetail(); document.querySelector(".detail-card").scrollIntoView({ behavior: "smooth", block: "start" }); }));
}

function renderDetail() {
  const staff = selectedStaff;
  const mental = staff.shareMentalState && staff.mentalState.length ? `<div class="shared-mental-state"><h3>本人が共有した気分・こころの状態</h3><p>${staff.mentalState.join("、")}</p></div>` : `<div class="shared-mental-state"><p class="muted">具体的な気分・こころの状態は本人が共有を選択していないため表示していません。</p></div>`;
  document.getElementById("staff-detail").innerHTML = `<div class="detail-intro"><div><h3>${staff.name}</h3><p class="muted">${staff.role} ／ 本人の意向を確認しながら対話に活用する情報</p></div><div>${hasConsultationRequest(staff) ? statusChip("相談希望あり", "status-consult") : statusChip("相談希望なし")}</div></div>${mental}<div class="detail-stats"><div><span>直近の平均睡眠</span><strong>${staff.sleep.toFixed(1)}<small>時間</small></strong></div><div><span>休憩取得率</span><strong>${staff.breakRate}<small>%</small></strong></div><div><span>残業時間</span><strong>${staff.overtime.toFixed(1)}<small>時間</small></strong></div><div><span>夜勤回数</span><strong>${staff.nightShifts}<small>回</small></strong></div></div><div class="support-grid"><div class="support-panel"><h3>共有範囲</h3><p>${staff.shareMentalState ? "気分・こころの状態の共有あり" : "相談希望の有無のみ"}</p></div><div class="support-panel"><h3>プライバシー</h3><p>本人が明示的に共有した情報だけを管理者に表示しています。</p></div></div>`;
}

renderSummary(); renderTable(); renderDetail();
document.getElementById("staff-filter").addEventListener("change", (event) => renderTable(event.target.value));
