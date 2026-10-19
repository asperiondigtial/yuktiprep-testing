// k6 load test used by the staging gate. Run: k6 run -e BASE_URL=https://staging.example.com tests/load/smoke-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '20s', target: 20 },
    { duration: '40s', target: 20 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
};

export default function () {
  const res = http.get(`${__ENV.BASE_URL}/ready`);
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
