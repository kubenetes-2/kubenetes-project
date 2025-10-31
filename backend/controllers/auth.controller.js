const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

// JWT 시크릿 키 (환경변수에서 가져오기)
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// 회원가입
const signup = async (req, res) => {
  try {
    const { username, name, phone, password } = req.body;
    
    // 사용자 중복 확인
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: '이미 존재하는 아이디입니다.' });
    }

    // 새 사용자 생성
    const user = new User({
      username,
      name,
      phone,
      password // 모델에서 자동으로 해싱됩니다
    });

    await user.save();
    
    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: '회원가입이 완료되었습니다.',
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name
      }
    });
  } catch (error) {
    console.error('회원가입 오류:', error);
    console.error('에러 스택:', error.stack);
    // 항상 JSON 반환 보장
    if (!res.headersSent) {
      // Mongoose validation error 처리
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(e => e.message);
        return res.status(400).json({ 
          ok: false,
          message: messages.join(', ') || '입력 데이터가 올바르지 않습니다.',
          error: error.message 
        });
      }
      // 중복 사용자 오류
      if (error.code === 11000) {
        return res.status(400).json({ 
          ok: false,
          message: '이미 존재하는 아이디입니다.'
        });
      }
      res.status(500).json({ 
        ok: false,
        message: '서버 오류가 발생했습니다.',
        error: error.message 
      });
    }
  }
};

// 로그인
const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 사용자 확인
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    // 비밀번호 확인
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: '로그인 성공',
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name
      }
    });
  } catch (error) {
    console.error('로그인 오류:', error);
    console.error('에러 스택:', error.stack);
    // 항상 JSON 반환 보장
    if (!res.headersSent) {
      res.status(500).json({ 
        ok: false,
        message: '서버 오류가 발생했습니다.',
        error: error.message 
      });
    }
  }
};

// 현재 사용자 정보 조회
const getCurrentUser = async (req, res) => {
  try {
    // 미들웨어에서 이미 검증된 사용자 정보 사용
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }
    res.json(user);
  } catch (error) {
    console.error('사용자 정보 조회 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
};

module.exports = {
  signup,
  login,
  getCurrentUser
};
