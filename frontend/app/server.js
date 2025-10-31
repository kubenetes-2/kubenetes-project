// /home/kevin/frontend/server.js
const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { XMLParser } = require('fast-xml-parser');
const app = express();
const PORT = process.env.PORT || 3000;

// 고용24 오픈API 프록시 (프론트 자체 처리) - 백엔드 프록시보다 먼저 선언해야 함
const WORK24_API_KEY = process.env.WORK24_API_KEY || '184d5b92-d9ef-4629-b9dc-1947635119ac';
const WORK24_BASE_URL = 'https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L21.do';

app.get('/work24', async (req, res) => {
  try {
    const startPage = req.query.startPage || '1';
    const perPage = req.query.perPage || '10';
    const url = new URL(WORK24_BASE_URL);
    url.searchParams.append('authKey', WORK24_API_KEY);
    url.searchParams.append('callTp', 'L');
    url.searchParams.append('returnType', 'XML');
    url.searchParams.append('startPage', String(startPage));
    url.searchParams.append('display', String(perPage));

    const r = await fetch(url.toString());
    const text = await r.text();
    if (!r.ok) {
      return res.status(502).json({ ok: false, message: `Work24 error ${r.status}`, raw: text });
    }

    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', isArray: name => name === 'dhsOpenEmpInfo' });
    const j = parser.parse(text);

    let items = [];
    if (j && j.dhsOpenEmpInfoList) {
      items = j.dhsOpenEmpInfoList.dhsOpenEmpInfo || [];
      if (!Array.isArray(items)) items = [items];
    }

    const jobs = items.map(it => ({
      coClcd: it.coClcdNm || '-',
      empWantedTypeCd: it.empWantedTypeNm || '-',
      empWantedCareerCd: it.empWantedCareerNm || '-',
      empWantedEduCd: it.empWantedEduNm || '-',
      empWantedTitle: it.empWantedTitle || '-',
      homeUrl: it.empWantedHomepgDetail || null,
      company: it.empBusiNm || '-',
      seq: it.empSeqno || null,
      logo: it.regLogImgNm || null,
      startDate: it.empWantedStdt || null,
      endDate: it.empWantedEndt || null,
      region: it.workRgnNm || '-',
      salary: it.salaryNm || '-',
    }));

    return res.json({ ok: true, count: jobs.length, jobs, raw: j });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Failed to fetch Work24', error: String(e) });
  }
});

// 백엔드 API 프록시 설정
const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:8000';
app.use('/api', createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  // http-proxy-middleware는 app.use('/api', ...)에서 자동으로 /api prefix를 제거함
  // 따라서 pathRewrite에서 /api를 다시 추가해야 함
  pathRewrite: function (path, req) {
    // /api/auth/login -> /auth/login (prefix 제거됨) -> /api/auth/login (다시 추가)
    const rewritten = '/api' + path;
    console.log(`[Proxy] pathRewrite: ${path} -> ${rewritten}`);
    return rewritten;
  }
}));

// 정적 파일 서빙
app.use(express.static(path.join(__dirname, 'public')));

// HTML 페이지 라우팅
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup.html'));
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
