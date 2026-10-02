/*
 * DEMO ONLY: this browser-local session is not production security.
 * Future Spring Boot migration: replace this module with server-issued,
 * HttpOnly session/JWT handling and enforce the same role checks on APIs.
 */
(function () {
  const SESSION_KEY = "nurseCareCompass.demoSession";
  const DEMO_USERS = {
    staff: { id: "staff-demo", name: "スタッフ（デモ）", role: "STAFF", password: "staff" },
    admin: { id: "admin-demo", name: "管理者（デモ）", role: "ADMIN", password: "admin" }
  };

  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
  }

  function setSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, name: user.name, role: user.role }));
  }

  function login(account, password) {
    const user = DEMO_USERS[account];
    if (!user || user.password !== password) return false;
    setSession(user);
    return true;
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = "login.html";
  }

  function requireRole(role) {
    const session = getSession();
    if (!session) { window.location.href = "login.html"; return null; }
    if (role && session.role !== role) {
      window.location.href = session.role === "ADMIN" ? "admin.html" : "index.html";
      return null;
    }
    return session;
  }

  window.NCCAuth = {
    DEMO_ONLY: true,
    getSession,
    login,
    logout,
    requireRole,
    getHealthHistoryKey: () => {
      const session = getSession();
      return `healthHistory:${session ? session.id : "anonymous"}`;
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    const session = getSession();
    if (!session || document.body.classList.contains("login-page")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "logout-button";
    button.textContent = `${session.name} / ログアウト`;
    button.addEventListener("click", logout);
    document.body.appendChild(button);
  });
})();
