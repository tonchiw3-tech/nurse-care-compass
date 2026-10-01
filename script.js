const sleepInput = document.getElementById("sleep-hours");

sleepInput.addEventListener("keydown", (event) => {
  if (event.key === "-") {
    event.preventDefault();
  }
});

function recordHealth() {
  const sleep = sleepInput.value;
  if (sleep === "") {
  alert("睡眠時間を入力してください");
  return;
}
  if (!sleepInput.checkValidity()) {
    sleepInput.reportValidity();
    return;
  }

  const selects = document.querySelectorAll("select");

  const fatigue = selects[0].value;
  const breakTaken = selects[1].value;
  const backPain = selects[2].value;

  const result = document.getElementById("result");

  result.textContent =
    `記録しました：睡眠 ${sleep}時間／疲労感 ${fatigue}／休憩 ${breakTaken}／腰痛 ${backPain}`;
}
