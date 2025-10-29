document.addEventListener('DOMContentLoaded', function() {
  const nav = document.getElementById('authNav');
  if (!nav || !window.StorageAPI) return;
  const user = StorageAPI.currentUser();
  if (user && user.id) {
    nav.innerHTML = `
      <span class="user-badge">${user.id}</span>
      <button id="logoutBtn" class="logout-btn">Logout</button>
    `;
    const btn = document.getElementById('logoutBtn');
    if (btn) {
      btn.addEventListener('click', function(){
        StorageAPI.logout();
        window.location.href = '/';
      });
    }
  } else {
    nav.innerHTML = `<a class="new-post-btn" href="/login.html">Login</a>`;
  }
});


