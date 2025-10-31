const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favorite.controller');
const auth = require('../middleware/auth.middleware');

// 모든 즐겨찾기 라우트는 인증 필요
router.post('/', auth, favoriteController.addFavorite); // 즐겨찾기 추가
router.delete('/:jobSeq', auth, favoriteController.removeFavorite); // 즐겨찾기 삭제
router.get('/', auth, favoriteController.getFavorites); // 즐겨찾기 목록 조회
router.get('/check/:jobSeq', auth, favoriteController.checkFavorite); // 특정 공고 즐겨찾기 확인

module.exports = router;


