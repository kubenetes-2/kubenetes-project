// backend/routes/jobs.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// DB 연결 (이미 app.js에서 연결되어 있으면 생략 가능하지만 안전하게 추가)
mongoose.connect('mongodb://mongodb:27017/jobsdb', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// 스키마 정의 (요청하신 컬럼 반영)
const jobSchema = new mongoose.Schema({
  title: String,       // 공고명
  company: String,     // 기업명
  scale: String,       // 기업규모
  address: String,     // 주소
  position: String,    // 직무
  skills: String,      // 기술스택
  career: String,      // 경력
  salary: String,      // 연봉 및 급여
  deadline: String     // 마감일
}, { timestamps: true });

const Job = mongoose.model('Job', jobSchema);

// ✅ CREATE
router.post('/', async (req, res) => {
  try {
    const job = new Job(req.body);
    await job.save();
    res.status(201).json(job);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ✅ READ (전체)
router.get('/', async (req, res) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ READ (단건)
router.get('/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    res.json(job);
  } catch (err) {
    res.status(404).json({ message: 'Not found' });
  }
});

// ✅ UPDATE
router.put('/:id', async (req, res) => {
  try {
    const updated = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ✅ DELETE
router.delete('/:id', async (req, res) => {
  try {
    await Job.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

