// Work24 채용공고 API(210L21) 엔드포인트 및 테이블 뿌리기
const COMPANY_TYPE = {
  "10": "대기업", "20": "공기업", "30": "공공기관", "40": "중견기업", "50": "외국계기업"
};
const WANTED_TYPE = {
  "10": "정규직", "20": "정규직전환", "30": "비정규직",
  "40": "기간제", "50": "시간선택제", "60": "기타"
};
// 경력/학력은 미제공 빈도가 높아 필터에서 제외

function mapValue(table, value) {
  if (!value || value === "-") return "-";
  // 테이블이 없으면 원본 값을 그대로 사용
  if (!table) {
    return value.split("|").join(", ");
  }
  return value.split("|").map(v => (table && table[v]) ? table[v] : v).join(", ");
}

// 제목에서 경력/학력 키워드 추론 (전역에서 재사용)
function guessFromTitle(title) {
  const t = (title || '').toLowerCase();
  let career = '';
  if (/[\(\s\[]?신입[\)\s\]]?/.test(t)) career = '신입';
  if (/인턴/.test(t)) career = '인턴';
  if (/경력무관|무관/.test(t)) career = '무관';
  if (/경력/.test(t) && !career) career = '경력';
  let edu = '';
  if (/학력무관/.test(t)) edu = '학력무관';
  else if (/고졸/.test(t)) edu = '고졸';
  else if (/대졸\(2~3\)|초대졸|전문대/.test(t)) edu = '대졸(2~3)';
  else if (/대졸/.test(t)) edu = '대졸';
  else if (/석사/.test(t)) edu = '석사';
  else if (/박사/.test(t)) edu = '박사';
  return { career, edu };
}

function normalizeCareer(value){
  if (!value) return '';
  const v = String(value).trim();
  if (v === '-') return '';
  // 통일 표기: 경력무관/무관 -> 무관
  if (v === '경력무관' || v === '무관') return '무관';
  return v;
}

function normalizeEdu(value){
  if (!value) return '';
  const v = String(value).trim();
  if (v === '-') return '';
  if (v === '초대졸' || v === '전문대') return '대졸(2~3)';
  return v;
}

function getCareer(j){
  const fromApi = normalizeCareer(j.empWantedCareerCd);
  if (fromApi) return fromApi;
  return normalizeCareer(guessFromTitle(j.empWantedTitle).career);
}

function getEdu(j){
  const fromApi = normalizeEdu(j.empWantedEduCd);
  if (fromApi) return fromApi;
  return normalizeEdu(guessFromTitle(j.empWantedTitle).edu);
}

let allJobs = [];
let filters = { coClcd: '', empWantedTypeCd: '', company: '', titleKeyword: '' };
let currentPage = 1;
const pageSize = 10;

// 즐겨찾기 기능 (백엔드 API 사용)
async function toggleFavorite(jobSeq) {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  
  // 로그인하지 않은 경우 즐겨찾기 기능 비활성화
  if (!token || !user) {
    alert('즐겨찾기 기능을 사용하려면 로그인이 필요합니다.');
    window.location.href = '/login.html';
    return;
  }
  
  // 로그인한 경우 백엔드 API 호출
  try {
    const isSaved = await isFavorite(jobSeq);
    const url = isSaved 
      ? `/api/favorites/${jobSeq}`
      : '/api/favorites';
    const method = isSaved ? 'DELETE' : 'POST';
    
    // 즐겨찾기 추가 시 공고 정보도 함께 전송
    let bodyData = { jobSeq };
    if (method === 'POST') {
      const currentJob = allJobs.find(j => String(j.seq) === String(jobSeq));
      if (currentJob) {
        bodyData = {
          jobSeq,
          jobTitle: currentJob.empWantedTitle || '',
          company: currentJob.company || '',
          career: getCareer(currentJob) || '',
          education: getEdu(currentJob) || '',
          link: currentJob.homeUrl || ''
        };
      }
    }
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      ...(method === 'POST' ? { body: JSON.stringify(bodyData) } : {})
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '즐겨찾기 처리 실패');
    }
    
    renderJobsTable();
  } catch (error) {
    console.error('즐겨찾기 처리 오류:', error);
    alert(error.message || '즐겨찾기 처리 중 오류가 발생했습니다.');
  }
}

async function isFavorite(jobSeq) {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  
  // 로그인하지 않은 경우 항상 false 반환
  if (!token || !user) {
    return false;
  }
  
  // 로그인한 경우 백엔드 API 호출
  try {
    const response = await fetch(`/api/favorites/check/${jobSeq}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return data.isFavorite || false;
  } catch (error) {
    console.error('즐겨찾기 확인 오류:', error);
    return false;
  }
}

// 동적으로 필터 UI 생성 & 이벤트 바인드
function renderFilters(jobs) {
  const unique = (arr) => [...new Set(arr.filter(x => x && x !== '-'))].sort();
  const $thead = document.querySelector('.job-table thead');
  if (!$thead || !jobs.length) return;
  let filterRow = document.querySelector('#filterRow');
  if (filterRow) filterRow.remove();

  // 각각의 select option 배열 만들기
  const companyTypes = unique(jobs.map(j => j.coClcd));
  const wantedTypes = unique(jobs.map(j => j.empWantedTypeCd));
  const companies = unique(jobs.map(j => j.company));
  // 경력/학력 옵션 (우선 고정 옵션을 사용하고, API/추론 값은 보조로 병합)
  const CAREER_OPTIONS = ['신입', '인턴', '무관', '경력'];
  const EDU_OPTIONS = ['학력무관', '고졸', '대졸(2~3)', '초대졸', '전문대', '대졸', '석사', '박사'];
  const careers = unique([...CAREER_OPTIONS, ...jobs.map(j => j.empWantedCareerCd || guessFromTitle(j.empWantedTitle).career)]);
  const edus = unique([...EDU_OPTIONS, ...jobs.map(j => j.empWantedEduCd || guessFromTitle(j.empWantedTitle).edu)]);

  const selectHtml = (id, options, table) => `
    <select id="${id}" style="width:100%;padding:4px;">
      <option value="">전체</option>
      ${options.map(val => `<option value="${val}">${mapValue(table, val)}</option>`).join('')}
    </select>
  `;

  const html = `
    <tr id="filterRow">
      <td>${selectHtml('fCompany', companyTypes, COMPANY_TYPE)}</td>
      <td></td>
      <td>${selectHtml('fWanted', wantedTypes, WANTED_TYPE)}</td>
      <td>${selectHtml('fCompanyName', companies)}</td>
      <td><input id="qTitle" type="text" placeholder="공고명 검색" style="width:85%;min-width:320px;height:36px;padding:6px 10px;"></td>
      <td>${selectHtml('fCareer', careers)}</td>
      <td>${selectHtml('fEdu', edus)}</td>
      <td></td>
    </tr>
  `;
  $thead.insertAdjacentHTML('afterend', html);

  // 이벤트 연결
  document.getElementById('fCompany').onchange = (e) => { filters.coClcd = e.target.value; currentPage = 1; renderJobsTable(); };
  document.getElementById('fWanted').onchange = (e) => { filters.empWantedTypeCd = e.target.value; currentPage = 1; renderJobsTable(); };
  document.getElementById('fCompanyName').onchange = (e) => { filters.company = e.target.value; currentPage = 1; renderJobsTable(); };
  const fCareer = document.getElementById('fCareer');
  const fEdu = document.getElementById('fEdu');
  fCareer.onchange = (e) => { filters.career = normalizeCareer(e.target.value); currentPage = 1; renderJobsTable(); };
  fEdu.onchange = (e) => { filters.edu = normalizeEdu(e.target.value); currentPage = 1; renderJobsTable(); };
  const titleInp = document.getElementById('qTitle');
  titleInp.oninput = () => { filters.titleKeyword = (titleInp.value||'').trim().toLowerCase(); currentPage = 1; renderJobsTable(); };
}

function formatDate(yyyymmdd){
  if (!yyyymmdd || yyyymmdd.length !== 8) return '-';
  return `${yyyymmdd.slice(0,4)}-${yyyymmdd.slice(4,6)}-${yyyymmdd.slice(6,8)}`;
}

function renderPager(total) {
  const pager = document.getElementById('pager');
  if (!pager) return;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  let html = '';
  for (let p = 1; p <= totalPages; p++) {
    html += `<button data-page="${p}" class="new-post-btn" style="padding:6px 10px;${p===currentPage?'background:#2b49c7;color:#fff;':''}">${p}</button>`;
  }
  pager.innerHTML = html;
  pager.querySelectorAll('button').forEach(btn => btn.onclick = (e) => {
    currentPage = Number(e.currentTarget.dataset.page);
    renderJobsTable();
  });
}

function renderJobsTable() {
  const tbody = document.getElementById('jobTbody');
  if (!tbody) return;
  let jobs = allJobs;
  // 필터 적용
  jobs = jobs.filter(j =>
    (!filters.coClcd || j.coClcd === filters.coClcd) &&
    (!filters.empWantedTypeCd || j.empWantedTypeCd === filters.empWantedTypeCd) &&
    (!filters.company || j.company === filters.company) &&
    (!filters.titleKeyword || (j.empWantedTitle || '').toLowerCase().includes(filters.titleKeyword)) &&
    (!filters.career || getCareer(j) === filters.career) &&
    (!filters.edu || getEdu(j) === filters.edu)
  );

  const total = jobs.length;
  const start = (currentPage - 1) * pageSize;
  const pageItems = jobs.slice(start, start + pageSize);

  // 각 공고의 즐겨찾기 상태를 비동기로 확인
  const renderWithFavorites = async () => {
    const rows = await Promise.all(pageItems.map(async (job) => {
      const fav = await isFavorite(job.seq);
      return `
      <tr>
        <td>${mapValue(COMPANY_TYPE, job.coClcd)}</td>
        <td style="text-align:center;">
          <button onclick="toggleFavorite('${job.seq}')" style="background:none;border:none;cursor:pointer;font-size:1.5rem;" title="${fav ? '즐겨찾기 해제' : '즐겨찾기 추가'}">
            ${fav ? '⭐' : '☆'}
          </button>
        </td>
        <td>${mapValue(WANTED_TYPE, job.empWantedTypeCd)}</td>
        <td>${job.company || '-'}</td>
        <td>
          ${job.homeUrl ? `<a href="${job.homeUrl}" target="_blank" rel="noopener noreferrer">${job.empWantedTitle || '-'}</a>` : (job.empWantedTitle || '-')}
        </td>
        <td>${getCareer(job) || '-'}</td>
        <td>${getEdu(job) || '-'}</td>
        <td>${job.logo ? `<img src="${job.logo}" alt="logo" style="height:24px;">` : '-'}</td>
      </tr>
    `;
    }));
    tbody.innerHTML = rows.join('') || '<tr><td colspan="8">채용공고 없음</td></tr>';
  };
  
  renderWithFavorites();

  renderPager(total);
}

async function fetchAndRenderWantedList() {
    const tbody = document.getElementById('jobTbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8">불러오는 중...</td></tr>';
    try {
        // 프론트 익스프레스에서 직접 Work24를 프록시함
        const res = await fetch('/work24?perPage=100');
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status} ${res.statusText} - ${text.slice(0,200)}`);
        }
        const payload = await res.json();
        allJobs = payload.jobs || [];
        renderFilters(allJobs);
        renderJobsTable();
    } catch(e) {
        console.error('Work24 fetch error:', e);
        tbody.innerHTML = `<tr><td colspan="8">불러오기 실패: ${String(e).replace(/</g,'&lt;')}</td></tr>`;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    fetchAndRenderWantedList();
});

// 전역 함수로 노출 (onclick에서 사용)
window.toggleFavorite = toggleFavorite;
window.isFavorite = isFavorite;
