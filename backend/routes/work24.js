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

// 실제 API 구조: dhsOpenEmpInfoList > dhsOpenEmpInfo[] (혹은 Info210L21OutVo.list)
function normalizeWork24Response(raw) {
  if (!raw) return [];

  let items = [];

  if (raw.dhsOpenEmpInfoList) {
    items = raw.dhsOpenEmpInfoList.dhsOpenEmpInfo || [];
  } else if (raw.dhsEmpWantedInfoList) {
    items = raw.dhsEmpWantedInfoList.dhsOpenEmpInfo || [];
  } else if (raw.Info210L21OutVo) {
    items = raw.Info210L21OutVo.list || [];
  }

  if (!items) return [];
  if (!Array.isArray(items)) items = [items];

  return items.map(it => {
    const seq = it.empSeqno || it.seq || it.jobId || null;
    const title = it.empWantedTitle || it.recruTitle || it.title || '-';
    const company = it.empBusiNm || it.corpName || it.company || '-';
    let coClcd = (it.coClcd || it.coClCd || it.coClcdCd || it.corpDivCd || '').toString().trim();
    const coClcdNm = it.coClcdNm || it.corpDiv || it.companyType || (coClcd ? coClcd : '-');
    if (!coClcd || coClcd === '-') coClcd = coClcdNm || '-';

    let empWantedTypeCd = (it.empWantedTypeCd || it.empWantedType || it.empTypeCd || '').toString().trim();
    const empWantedTypeNm = it.empWantedTypeNm || it.empType || it.jobTypeNm || (empWantedTypeCd || '-');
    if (!empWantedTypeCd || empWantedTypeCd === '-') empWantedTypeCd = empWantedTypeNm || '-';
    const empWantedCareerCd = (it.empWantedCareerCd || it.empWantedCareerCode || '').toString().trim();
    const empWantedCareerNm = it.empWantedCareerNm || it.empWantedCareerCd || it.career || empWantedCareerCd || '';
    const empWantedEduCd = (it.empWantedEduCd || it.empWantedEduCode || '').toString().trim();
    const empWantedEduNm = it.empWantedEduNm || it.empWantedEduCd || it.education || empWantedEduCd || '';
    const homeUrl = it.empWantedHomepgDetail
      || it.empWantedHomepg
      || it.empWantedMobileUrl
      || it.homeUrl
      || it.url
      || it.link
      || null;
    const logo = it.regLogImgNm || it.logo || null;
    const workAddress = it.workAddress || it.workRgnNm || '-';
    const salaryNm = it.salaryNm || it.salary || '-';
    const jobType = it.jobType || it.role || '-';
    const startDate = it.empWantedStdt || it.startDate || null;
    const endDate = it.empWantedEndt || it.deadline || null;

    return {
      seq,
      // 원본 필드 유지 (프론트 static js 호환)
      empWantedTitle: title,
      empBusiNm: company,
      coClcd,
      coClcdNm,
      empWantedTypeCd,
      empWantedTypeNm,
      empWantedCareerCd,
      empWantedCareerNm,
      empWantedEduCd,
      empWantedEduNm,
      empWantedStdt: startDate,
      empWantedEndt: endDate,
      empWantedHomepgDetail: homeUrl,
      regLogImgNm: logo,
      workAddress,
      salaryNm,
      jobType,

      // 통합 필드 (Next.js 버전 호환)
      title,
      company,
      corpDiv: coClcdNm,
      empType: empWantedTypeNm,
      career: empWantedCareerNm || it.career || '-',
      education: empWantedEduNm || it.education || '-',
      address: workAddress,
      role: jobType,
      salary: salaryNm,
      startDate,
      deadline: endDate,
      link: homeUrl,
      homeUrl,
      logo,
    };
  });
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
    console.error('[work24] fetchWork24 failed:', e);
    if (e.cause) {
      console.error('[work24] root cause:', e.cause);
    }
    return res.status(500).json({ ok: false, message: e.message });
  }
});

module.exports = router;
