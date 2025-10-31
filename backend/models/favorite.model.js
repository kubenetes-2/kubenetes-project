const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  jobSeq: {
    type: String,
    required: true,
    index: true
  },
  // 공고 정보 저장 (DB 데이터)
  jobTitle: {
    type: String,
    default: ''
  },
  company: {
    type: String,
    default: ''
  },
  career: {
    type: String,
    default: ''
  },
  education: {
    type: String,
    default: ''
  },
  link: {
    type: String,
    default: ''
  },
  // 즐겨찾기 추가 시점
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 사용자와 공고 ID 조합이 유일하도록 설정
favoriteSchema.index({ userId: 1, jobSeq: 1 }, { unique: true });

const Favorite = mongoose.model('Favorite', favoriteSchema);

module.exports = Favorite;

