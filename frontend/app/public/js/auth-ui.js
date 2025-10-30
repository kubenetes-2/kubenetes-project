document.addEventListener('DOMContentLoaded', function() {
  const nav = document.getElementById('authNav');
  if (!nav || !window.StorageAPI) return;
  // Try StorageAPI.currentUser() first (used by local StorageAPI),
  // fall back to legacy `user` key (set by the login page when using the API).
  let user = null;
  try {
    user = StorageAPI.currentUser();
  } catch (e) {
    user = null;
  }
  if (!user) {
    const raw = localStorage.getItem('user');
    if (raw) {
      try { user = JSON.parse(raw); } catch (e) { user = null; }
    }
  }
  if (user && (user.username || user.name || user.id)) {
    // Prefer username (from API), then name, then id as fallback
    const displayName = user.username || user.name || user.id;
    nav.innerHTML = `
      <span class="user-badge">${displayName}</span>
      <button id="logoutBtn" class="logout-btn">Logout</button>
    `;
    const btn = document.getElementById('logoutBtn');
    if (btn) {
      btn.addEventListener('click', function(){
        // Clear both StorageAPI currentUser and legacy keys set by API-based login
        try { StorageAPI.logout(); } catch (e) {}
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('currentUser');
        window.location.href = '/';
      });
    }
  } else {
    // 로그인/회원가입 버튼 나란히
    nav.innerHTML = `
      <div style="display: flex; gap: 10px; align-items: center;">
        <a class="new-post-btn" href="/login.html">Login</a>
        <a class="new-post-btn" href="/signup.html">회원가입</a>
      </div>
    `;
  }
});


