const API_BASE_URL = "http://localhost:3000/api";

function saveCurrentUser(user) {
  localStorage.setItem("esumbong_user", JSON.stringify(user));
}

function getCurrentUser() {
  const raw = localStorage.getItem("esumbong_user");
  return raw ? JSON.parse(raw) : null;
}

function requireAuth() {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = "index.html";
    return null;
  }
  return user;
}

function logoutUser() {
  localStorage.removeItem("esumbong_user");
  window.location.href = "index.html";
}
