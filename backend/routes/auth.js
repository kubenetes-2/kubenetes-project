const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const auth = require('../middleware/auth.middleware');

// 에러 핸들링 래퍼
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    console.error('라우터 에러:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        ok: false,
        message: '서버 오류가 발생했습니다.',
        error: error.message 
      });
    }
  });
};

// 회원가입
router.post('/signup', asyncHandler(authController.signup));

// 로그인
router.post('/login', asyncHandler(authController.login));

// 현재 사용자 정보 조회 (인증 필요)
router.get('/me', auth, asyncHandler(authController.getCurrentUser));

module.exports = router;
