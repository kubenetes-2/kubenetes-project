// /home/kevin/gb-deploy/src/backend/app.js
const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://gb_mongodb:27017/jobsdb';
const PORT = process.env.PORT || 8000;

const app = express();

// 미들웨어
app.use(cors());
app.use(express.urlencoded({ extended: true })); // HTML form (x-www-form-urlencoded)
app.use(express.json());                         // JSON

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

// 바디 키 보정(안전)
function pick(body, keys, fallback = '') {
  for (const k of keys) {
    if (body && body[k] != null && body[k] !== '') return body[k];
  }
  return fallback;
}

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

app.listen(PORT, () => {
  console.log('[backend] listening on', PORT);
});

