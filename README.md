# 내일의 발견 - 채용공고 관리 시스템

## 프로젝트 구성

- **백엔드**: Node.js + Express + MongoDB (포트 8000)
- **프론트엔드**: Node.js + Express 정적 서버 (포트 3000)
- **데이터베이스**: MongoDB (포트 27017)

## Docker로 실행하기

### 1. 전체 시스템 실행
```bash
docker-compose up -d
```

### 2. 개별 서비스 실행
```bash
# 백엔드만 실행
docker-compose up -d mongodb backend

# 프론트엔드만 실행 (백엔드가 실행된 상태에서)
docker-compose up -d frontend
```

### 3. 로그 확인
```bash
# 전체 로그
docker-compose logs -f

# 특정 서비스 로그
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb
```

### 4. 서비스 중지
```bash
docker-compose down
```

## 접속 URL

- **프론트엔드**: http://localhost:3000
- **백엔드 API**: http://localhost:8000
- **MongoDB**: localhost:27017

## Harbor 배포

### 1. 로컬에서 이미지 빌드 및 Harbor에 푸시

```bash
# Harbor 로그인 (192.168.0.208에 Harbor가 있다고 가정)
docker login 192.168.0.208

# 이미지 빌드
docker-compose build

# 이미지 태깅
docker tag project-fixed-backend:latest 192.168.0.208/project-fixed-backend:latest
docker tag project-fixed-frontend:latest 192.168.0.208/project-fixed-frontend:latest

# Harbor에 푸시
docker push 192.168.0.208/project-fixed-backend:latest
docker push 192.168.0.208/project-fixed-frontend:latest
```

### 2. 서버에서 Harbor 이미지 사용

서버에서 `docker-compose.yml`을 Harbor 이미지를 사용하도록 수정하거나, 직접 pull 후 실행:

```bash
# Harbor 로그인
docker login 192.168.0.208

# 이미지 pull
docker pull 192.168.0.208/project-fixed-backend:latest
docker pull 192.168.0.208/project-fixed-frontend:latest

# docker-compose 실행 (build 대신 image 사용)
docker-compose up -d
```

또는 `docker-compose.yml`에서 `build` 대신 `image`를 사용하도록 수정할 수 있습니다.

## 주요 기능

1. **채용공고 관리**
   - 공고 등록/수정/삭제
   - 공고 목록 조회
   - 달력에서 마감일 확인

2. **사용자 정보 관리**
   - 개인정보 등록/수정
   - 정보 표시

## API 엔드포인트

- `GET /api/jobs` - 채용공고 목록
- `POST /api/jobs` - 채용공고 등록
- `GET /api/jobs/:id` - 특정 공고 조회
- `PUT /api/jobs/:id` - 공고 수정
- `DELETE /api/jobs/:id` - 공고 삭제
- `GET /api/health` - 헬스체크

## 문제 해결

### 포트 충돌 시
```bash
# 사용 중인 포트 확인
netstat -an | findstr :3000
netstat -an | findstr :8000
netstat -an | findstr :27017

# Docker 컨테이너 정리
docker-compose down
docker system prune -f
```

### 데이터베이스 초기화
```bash
# 볼륨 삭제 후 재시작
docker-compose down -v
docker-compose up -d
```


