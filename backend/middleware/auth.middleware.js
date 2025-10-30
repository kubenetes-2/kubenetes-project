const jwt = require('jsonwebtoken');

// JWT 시크릿 키 (반드시 환경변수로 관리해야 함)
const JWT_SECRET = 'your_jwt_secret_key';

// 인증 미들웨어
const auth = (req, res, next) => {
  try {
    // 헤더에서 토큰 추출
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: '인증 토큰이 없습니다.' });
    }

    // 토큰 검증
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId; // 요청 객체에 사용자 ID 추가
    next();
  } catch (error) {
    console.error('인증 오류:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: '토큰이 만료되었습니다.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
    }
    res.status(500).json({ message: '인증 처리 중 오류가 발생했습니다.' });
  }
};

module.exports = auth;
