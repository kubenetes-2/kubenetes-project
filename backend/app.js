// /home/kevin/gb-deploy/src/backend/app.js
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');

// Allow using provided MONGO_URI (for docker). Default to localhost for
// local development so running `node app.js` works without docker.
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/jobsdb';
const PORT = process.env.PORT || 8000;

const app = express();

// 미들웨어
// CORS: Docker 내부 네트워크에서는 프록시를 통한 요청이므로 origin이 없을 수 있음
// 프론트엔드 프록시 서버에서 오는 요청도 허용
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || FRONTEND_ORIGIN).split(',').map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (Docker 내부 네트워크, curl, mobile apps, local files)
    if (!origin) {
      console.log('[CORS] No origin - allowing (internal request)');
      return callback(null, true);
    }
    
    // 허용된 origin 목록 확인
    if (ALLOWED_ORIGINS.some(allowed => origin === allowed || origin.startsWith(allowed))) {
      console.log(`[CORS] Allowed origin: ${origin}`);
      return callback(null, true);
    }
    
    // 개발 모드에서는 모든 origin 허용
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[CORS] Development mode - allowing: ${origin}`);
      return callback(null, true);
    }
    
    // production 모드에서 허용되지 않은 origin
    console.error(`[CORS] Blocked origin: ${origin} (allowed: ${ALLOWED_ORIGINS.join(', ')})`);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.urlencoded({ extended: true })); // HTML form (x-www-form-urlencoded)
app.use(express.json());                         // JSON
app.use(cookieParser());                         // 쿠키 파서

// 요청 로깅 미들웨어 (디버깅용)
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.path} (originalUrl: ${req.originalUrl}) - Origin: ${req.headers.origin || 'none'}`);
  // 모든 /api 경로 요청 상세 로깅
  if (req.path.startsWith('/api')) {
    console.log(`[Request] API 요청: ${req.method} ${req.path}, URL: ${req.url}, baseUrl: ${req.baseUrl}`);
  }
  next();
});

// DB
mongoose.set('strictQuery', true);
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('[mongo] connected:', MONGO_URI))
  .catch((e) => {
    console.error('[mongo] connect error:', e);
    process.exit(1);
  });

const jobSchema = new mongoose.Schema(
  {
    title: String,
    company: String,
    size: String,
    address: String,
    role: String,
    stack: String,
    career: String,
    salary: String,
    deadline: String,
    memo: String,
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);
const Job = mongoose.model('Job', jobSchema);

// 라우터 가져오기 및 설정
try {
  const authRoutes = require('./routes/auth');
  const work24Router = require('./routes/work24');
  const favoritesRoutes = require('./routes/favorites');

  // 라우트 설정
  app.use('/api/auth', authRoutes);
  app.use('/api/import/work24', work24Router);
  app.use('/api/favorites', favoritesRoutes);
  
  console.log('[routes] 라우터 로드 완료');
  console.log('[routes] 등록된 엔드포인트:');
  console.log('  - POST /api/auth/signup');
  console.log('  - POST /api/auth/login');
  console.log('  - GET /api/auth/me');
  console.log('  - GET /api/favorites');
  console.log('  - POST /api/favorites');
  console.log('  - DELETE /api/favorites/:jobSeq');
  console.log('  - GET /api/favorites/check/:jobSeq');
} catch (error) {
  console.error('[routes] 라우터 로드 실패:', error);
  console.error('[routes] 에러 스택:', error.stack);
  // 라우터 로드 실패 시에도 에러 핸들러가 처리하도록
  app.use('/api/auth', (req, res) => {
    res.status(500).json({ ok: false, message: '인증 라우터를 로드할 수 없습니다.' });
  });
}

// 바디 키 보정(안전)
function pick(body, keys, fallback = '') {
  for (const k of keys) {
    if (body && body[k] != null && body[k] !== '') return body[k];
  }
  return fallback;
}

// 테스트 엔드포인트 (라우터가 제대로 등록되었는지 확인) - 라우터 등록 직후에 위치
app.get('/api/test', (req, res) => {
  console.log('[test] /api/test 엔드포인트 호출됨');
  console.log('[test] Request path:', req.path);
  console.log('[test] Request originalUrl:', req.originalUrl);
  res.json({ 
    ok: true, 
    message: 'API 라우터가 정상 작동 중입니다.',
    requestPath: req.path,
    originalUrl: req.originalUrl,
    routes: {
      auth: 'POST /api/auth/signup, POST /api/auth/login, GET /api/auth/me',
      favorites: 'GET /api/favorites, POST /api/favorites, DELETE /api/favorites/:jobSeq',
      test: 'GET /api/test',
      health: 'GET /api/health'
    }
  });
});

// 헬스
app.get('/api/health', async (_req, res) => {
  const cnt = await Job.countDocuments().catch(() => 0);
  res.json({ ok: true, db: 'ok', count: cnt });
});

// 목록: 배열로 반환(현 프런트와 호환)
app.get('/api/jobs', async (_req, res) => {
  try {
    const rows = await Job.find({}).sort({ createdAt: -1 }).lean().exec();
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: 'list failed' });
  }
});

// 폼 등록: /jobs (기존 페이지가 form action="/jobs"일 때)
app.post('/jobs', async (req, res) => {
  try {
    const b = req.body || {};
    await Job.create({
      title:    pick(b, ['title']),
      company:  pick(b, ['company']),
      size:     pick(b, ['size']),
      address:  pick(b, ['address']),
      role:     pick(b, ['role']),
      stack:    pick(b, ['stack', 'tech', 'techStack']),
      career:   pick(b, ['career']),
      salary:   pick(b, ['salary']),
      deadline: pick(b, ['deadline', 'endDate', 'dueDate']),
      memo:     pick(b, ['memo']),
    });
    return res.redirect(303, '/jobs.html');
  } catch (e) {
    console.error(e);
    return res.status(400).send('등록 실패');
  }
});

// JSON 등록: /api/jobs (지금 네 “새 공고 등록”이 여기로 POST 하는 상황)
app.post('/api/jobs', async (req, res) => {
  try {
    const b = req.body || {};
    const saved = await Job.create({
      title:    pick(b, ['title']),
      company:  pick(b, ['company']),
      size:     pick(b, ['size']),
      address:  pick(b, ['address']),
      role:     pick(b, ['role']),
      stack:    pick(b, ['stack', 'tech', 'techStack']),
      career:   pick(b, ['career']),
      salary:   pick(b, ['salary']),
      deadline: pick(b, ['deadline', 'endDate', 'dueDate']),
      memo:     pick(b, ['memo']),
    });
    return res.status(201).json({ ok: true, job: saved });
  } catch (e) {
    console.error(e);
    return res.status(400).json({ ok: false, message: '등록 실패' });
  }
});

// 개별 조회: /api/jobs/:id
app.get('/api/jobs/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).lean().exec();
    if (!job) {
      return res.status(404).json({ ok: false, message: 'Job not found' });
    }
    res.json(job);
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: '조회 실패' });
  }
});

// 수정: /api/jobs/:id
app.put('/api/jobs/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const updated = await Job.findByIdAndUpdate(
      req.params.id,
      {
        title:    pick(b, ['title']),
        company:  pick(b, ['company']),
        size:     pick(b, ['size']),
        address:  pick(b, ['address']),
        role:     pick(b, ['role']),
        stack:    pick(b, ['stack', 'tech', 'techStack']),
        career:   pick(b, ['career']),
        salary:   pick(b, ['salary']),
        deadline: pick(b, ['deadline', 'endDate', 'dueDate']),
        memo:     pick(b, ['memo']),
      },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ ok: false, message: 'Job not found' });
    }
    res.json({ ok: true, job: updated });
  } catch (e) {
    console.error(e);
    res.status(400).json({ ok: false, message: '수정 실패' });
  }
});

// 삭제: /api/jobs/:id
app.delete('/api/jobs/:id', async (req, res) => {
  try {
    const deleted = await Job.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ ok: false, message: 'Job not found' });
    }
    res.json({ ok: true, message: '삭제 완료' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: '삭제 실패' });
  }
});

// 사용자 API (간단한 메모리 저장)
let userData = {};

app.post('/api/user', (req, res) => {
  try {
    const { name, email, phone } = req.body;
    userData = { name, email, phone };
    res.json({ ok: true, user: userData });
  } catch (e) {
    console.error(e);
    res.status(400).json({ ok: false, message: '사용자 등록 실패' });
  }
});

app.put('/api/user', (req, res) => {
  try {
    const { name, email, phone } = req.body;
    userData = { ...userData, name, email, phone };
    res.json({ ok: true, user: userData });
  } catch (e) {
    console.error(e);
    res.status(400).json({ ok: false, message: '사용자 수정 실패' });
  }
});

app.get('/api/user', (req, res) => {
  res.json({ ok: true, user: userData });
});

// 루트
app.get('/', (_req, res) => res.send('Backend OK'));

// 등록된 라우트 디버깅 미들웨어 (404 전에)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[Route Check] ${req.method} ${req.path} - 모든 라우트 확인 중...`);
    // Express가 실제로 어떤 라우트를 매칭하는지 확인하기 어려우므로
    // 모든 라우트를 나열
    const registeredRoutes = [
      'GET /api/test',
      'GET /api/health',
      'POST /api/auth/signup',
      'POST /api/auth/login',
      'GET /api/auth/me',
      'GET /api/favorites',
      'POST /api/favorites',
      'DELETE /api/favorites/:jobSeq',
      'GET /api/favorites/check/:jobSeq'
    ];
    console.log(`[Route Check] 등록된 라우트:`, registeredRoutes);
  }
  next();
});

// 404 핸들러 - JSON 반환
app.use((req, res) => {
  console.warn(`[404] 요청된 경로를 찾을 수 없습니다: ${req.method} ${req.path}`);
  console.warn(`[404] originalUrl: ${req.originalUrl}`);
  console.warn(`[404] url: ${req.url}`);
  console.warn(`[404] baseUrl: ${req.baseUrl}`);
  console.warn(`[404] Headers:`, JSON.stringify(req.headers, null, 2));
  res.status(404).json({ 
    ok: false, 
    message: 'API 엔드포인트를 찾을 수 없습니다.', 
    path: req.path,
    originalUrl: req.originalUrl,
    url: req.url,
    method: req.method 
  });
});

// 전역 에러 핸들러 - 항상 JSON 반환
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(err.status || 500).json({
    ok: false,
    message: err.message || '서버 오류가 발생했습니다.',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.listen(PORT, () => {
  console.log('[backend] listening on', PORT);
});

