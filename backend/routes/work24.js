const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

const API_KEY = process.env.WORK24_KEY || '184d5b92-d9ef-4629-b9dc-1947635119ac';
const BASE_URL = 'https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L21.do';

async function fetchWork24(page = 1, perPage = 10) {
  const url = new URL(BASE_URL);
  url.searchParams.set('authKey', API_KEY);
  url.searchParams.set('callTp', 'L');
  url.searchParams.set('returnType', 'XML');
  url.searchParams.set('startPage', String(page));
  url.searchParams.set('display', String(perPage));

  const resp = await fetch(url.toString(), { method: 'GET' });
  const text = await resp.text();

  // XML 파싱
  try {
    const xml2js = require('xml2js');
    const parsed = await xml2js.parseStringPromise(text, { explicitArray: false, mergeAttrs: true });
    return parsed;
  } catch (err) {
    throw new Error('XML 파싱 실패: ' + err.message);
  }
}

// 실제 API 구조: dhsEmpWantedInfoList > dhsOpenEmpInfo[]
function normalizeWork24Response(raw) {
  if (!raw || !raw.dhsEmpWantedInfoList) return [];
  let items = raw.dhsEmpWantedInfoList.dhsOpenEmpInfo; // 이 부분 수정!
  if (!items) return [];
  if (!Array.isArray(items)) items = [items];
  return items.map(it => ({
    coClcd: it.coClcd || '-',
    empWantedTypeCd: it.empWantedTypeCd || '-',
    empWantedCareerCd: it.empWantedCareerCd || '-',
    empWantedTitle: it.empWantedTitle || '-',
    empWantedEduCd: it.empWantedEduCd || '-'
  }));
}

// GET /api/import/work24
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page || '1', 10) || 1;
  const perPage = parseInt(req.query.perPage || '10', 10) || 10;
  try {
    const apiRes = await fetchWork24(page, perPage);
    const jobs = normalizeWork24Response(apiRes);
    return res.json({ ok: true, count: jobs.length, jobs });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message });
  }
});

module.exports = router;
