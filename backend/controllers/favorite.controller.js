const Favorite = require('../models/favorite.model');

// 즐겨찾기 추가
const addFavorite = async (req, res) => {
  try {
    const { jobSeq, jobTitle, company, career, education, link } = req.body;
    const userId = req.userId; // auth 미들웨어에서 설정됨

    if (!jobSeq) {
      return res.status(400).json({ message: '공고 ID가 필요합니다.' });
    }

    // 이미 즐겨찾기한 공고인지 확인
    const existing = await Favorite.findOne({ userId, jobSeq });
    if (existing) {
      return res.status(200).json({ message: '이미 즐겨찾기에 추가된 공고입니다.', favorite: existing });
    }

    // 즐겨찾기 추가 (공고 정보 함께 저장)
    const favorite = new Favorite({ 
      userId, 
      jobSeq,
      jobTitle: jobTitle || '',
      company: company || '',
      career: career || '',
      education: education || '',
      link: link || ''
    });
    await favorite.save();

    res.status(201).json({
      message: '즐겨찾기에 추가되었습니다.',
      favorite
    });
  } catch (error) {
    console.error('즐겨찾기 추가 오류:', error);
    if (error.code === 11000) {
      // 중복 키 오류
      return res.status(400).json({ message: '이미 즐겨찾기에 추가된 공고입니다.' });
    }
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 즐겨찾기 삭제
const removeFavorite = async (req, res) => {
  try {
    const { jobSeq } = req.params;
    const userId = req.userId;

    const favorite = await Favorite.findOneAndDelete({ userId, jobSeq });

    if (!favorite) {
      return res.status(404).json({ message: '즐겨찾기를 찾을 수 없습니다.' });
    }

    res.json({
      message: '즐겨찾기에서 삭제되었습니다.',
      favorite
    });
  } catch (error) {
    console.error('즐겨찾기 삭제 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 즐겨찾기 목록 조회
const getFavorites = async (req, res) => {
  try {
    const userId = req.userId;

    const favorites = await Favorite.find({ userId }).sort({ createdAt: -1 });

    // jobSeq만 배열로 반환 (기존 호환성 유지)
    const jobSeqs = favorites.map(fav => fav.jobSeq);

    res.json({
      favorites,
      jobSeqs
    });
  } catch (error) {
    console.error('즐겨찾기 조회 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

// 특정 공고가 즐겨찾기인지 확인
const checkFavorite = async (req, res) => {
  try {
    const { jobSeq } = req.params;
    const userId = req.userId;

    const favorite = await Favorite.findOne({ userId, jobSeq });

    res.json({
      isFavorite: !!favorite
    });
  } catch (error) {
    console.error('즐겨찾기 확인 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

module.exports = {
  addFavorite,
  removeFavorite,
  getFavorites,
  checkFavorite
};

