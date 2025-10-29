// /home/kevin/frontend/server.js
const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
const PORT = process.env.PORT || 3000;

// 백엔드 API 프록시 설정
const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:8000';
app.use('/api', createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api'
  }
}));

// 정적 파일 서빙
app.use(express.static(path.join(__dirname, 'public')));

// HTML 페이지 라우팅
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/new', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'new.html'));
});

app.get('/edit', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'edit.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/search', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'search.html'));
});

app.get('/history', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'history.html'));
});

// 간단 헬스
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// 프록시 뒤에서 /api/jobs 호출 결과를 화면에 보여주기 위함(프런트 자체는 정적)
app.get('/ping-api', async (_req, res) => {
  try {
    const r = await fetch(BACKEND_URL + '/api/jobs');
    const j = await r.json();
    res.json({ ok: true, data: j });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.listen(PORT, '0.0.0.0', () => console.log(`FE running on :${PORT}`));
