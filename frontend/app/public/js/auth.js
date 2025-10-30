// 인증 관련 유틸리티 함수들

// 로그인 상태 확인
function isAuthenticated() {
  return !!localStorage.getItem('token');
}

// 현재 사용자 정보 가져오기
function getCurrentUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

// 로그아웃
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}

// API 요청을 위한 헤더 생성
function getAuthHeader() {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// 보호된 페이지 접근 제어
function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

// 로그인 상태에 따라 네비게이션 업데이트
function updateNavigation() {
  const user = getCurrentUser();
  const authLinks = document.getElementById('auth-links');
  const userInfo = document.getElementById('user-info');
  
  if (user && authLinks && userInfo) {
    authLinks.style.display = 'none';
    userInfo.style.display = 'block';
    document.getElementById('user-name').textContent = user.name || '사용자';
  } else if (authLinks && userInfo) {
    authLinks.style.display = 'block';
    userInfo.style.display = 'none';
  }
}

// 페이지 로드 시 네비게이션 업데이트
document.addEventListener('DOMContentLoaded', updateNavigation);

// 전역으로 노출
window.Auth = {
  isAuthenticated,
  getCurrentUser,
  logout,
  getAuthHeader,
  requireAuth,
  updateNavigation
};
