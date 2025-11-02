import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 200 },   // 30초간 200명까지 빠르게 증가
    { duration: '2m', target: 500 },    // 2분간 500명으로 증가
    { duration: '2m', target: 1000 },  // 2분간 1000명까지 증가 (최대 부하)
    { duration: '2m', target: 1000 },  // 2분간 1000명 유지 (지속 부하)
    { duration: '30s', target: 0 },    // 30초간 0명까지 감소
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% 요청이 500ms 이하
    http_req_failed: ['rate<0.01'],    // 실패율 1% 이하
  },
};

export default function () {
  const res = http.get('http://192.168.0.204'); // 테스트 대상 URL
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 1000ms': (r) => r.timings.duration < 1000,
  });
  sleep(0.1); // 각 VU가 요청 후 0.1초 대기 (더 빠른 요청)
}

