const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const auth = require('../middleware/auth.middleware');

// 회원가입
router.post('/signup', authController.signup);

// 로그인
router.post('/login', authController.login);

// 현재 사용자 정보 조회 (인증 필요)
router.get('/me', auth, authController.getCurrentUser);

module.exports = router;
