// 메인 애플리케이션 JavaScript
let currentMonth = new Date();

function fetchJobs() {
    return (window.StorageAPI && StorageAPI.getJobs()) || [];
}

function renderCalendar(jobs = []) {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    document.getElementById('monthTitle').innerText = `${year}년 ${month + 1}월`;

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const tbody = document.getElementById('calendarBody');
    tbody.innerHTML = '';

    let row = document.createElement('tr');

    for (let i = 0; i < firstDay; i++) {
        row.appendChild(document.createElement('td'));
    }

    for (let day = 1; day <= lastDate; day++) {
        const cell = document.createElement('td');
        cell.textContent = day;

        const job = jobs.find(j => {
            const end = new Date(j.endDate || j.deadline);
            return end.getFullYear() === year && end.getMonth() === month && end.getDate() === day;
        });

        if (job) {
            cell.style.backgroundColor = '#fff3cd';
            cell.style.fontWeight = 'bold';
            cell.innerHTML = `🚩<br>${job.company || ''}`;
        }

        row.appendChild(cell);
        if ((firstDay + day) % 7 === 0 || day === lastDate) {
            tbody.appendChild(row);
            row = document.createElement('tr');
        }
    }
}

function renderJobsTable(jobs = []) {
    const tbody = document.getElementById('jobTbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const current = StorageAPI.currentUser();
    const saved = StorageAPI.getSaved(current?.id);
    if (!jobs.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 9;
        td.textContent = '공고가 없습니다. 우측 상단에서 등록하세요.';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }
    for (const j of jobs) {
        const tr = document.createElement('tr');
        const cells = [j.title, j.company, j.size, j.address, j.role, j.techStack, j.career, j.salary, j.endDate];
        for (const c of cells) {
            const td = document.createElement('td');
            td.textContent = c || '-';
            tr.appendChild(td);
        }
        // actions cell appended as last column overlay (add save/edit buttons)
        const actionTd = document.createElement('td');
        const isSaved = saved.includes(j.id);
        const saveBtn = document.createElement('button');
        saveBtn.textContent = isSaved ? '저장취소' : '저장';
        saveBtn.addEventListener('click', () => {
            const userId = current?.id;
            if (isSaved) {
                StorageAPI.unsaveJob(userId, j.id);
            } else {
                StorageAPI.saveJob(userId, j.id);
            }
            renderJobsTable(StorageAPI.getJobs());
        });
        const editLink = document.createElement('a');
        editLink.href = `/edit?id=${j.id}`;
        editLink.style.marginLeft = '8px';
        editLink.textContent = '수정';
        actionTd.appendChild(saveBtn);
        actionTd.appendChild(editLink);
        tr.appendChild(actionTd);
        tbody.appendChild(tr);
    }
}

// In-page filter controls
function attachFilters(jobs){
    const sels = {
        company: document.getElementById('fCompany'),
        size: document.getElementById('fSize'),
        role: document.getElementById('fRole'),
        tech: document.getElementById('fTech'),
    };
    if (!sels.company) return;
    const unique = arr => Array.from(new Set(arr.filter(Boolean)));
    const fill = (sel, list, label) => {
        if (sel.options.length) return;
        const all = document.createElement('option'); all.value = '전체'; all.textContent = '전체'; sel.appendChild(all);
        for (const v of unique(list)) { const o=document.createElement('option'); o.value=o.textContent=v; sel.appendChild(o); }
    };
    fill(sels.company, jobs.map(j=>j.company));
    fill(sels.size, jobs.map(j=>j.size));
    fill(sels.role, jobs.map(j=>j.role));
    fill(sels.tech, jobs.map(j=>j.techStack));

    const apply = () => {
        const filtered = jobs.filter(j =>
            (sels.company.value==='전체'||!sels.company.value||j.company===sels.company.value) &&
            (sels.size.value==='전체'||!sels.size.value||j.size===sels.size.value) &&
            (sels.role.value==='전체'||!sels.role.value||j.role===sels.role.value) &&
            (sels.tech.value==='전체'||!sels.tech.value||j.techStack===sels.tech.value)
        );
        renderJobsTable(filtered);
    };
    for (const s of Object.values(sels)) { if (s) s.addEventListener('change', apply); }
    apply();
}

function renderUser(user) {
    document.getElementById('displayName').textContent = user.name || '-';
    document.getElementById('displayEmail').textContent = user.email || '-';
    document.getElementById('displayPhone').textContent = user.phone || '-';
}

function saveUser() {
    const payload = {
        name: document.getElementById('name').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
    };
    const u = StorageAPI.saveUser(payload);
    renderUser(u);
    alert('저장 완료');
}

// 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', function() {
    // 버튼 이벤트 (로컬 저장)
    document.getElementById('registerBtn').addEventListener('click', saveUser);
    document.getElementById('updateBtn').addEventListener('click', saveUser);

    // 달력 네비게이션
    document.getElementById('prevMonth').addEventListener('click', async () => {
        currentMonth.setMonth(currentMonth.getMonth() - 1);
        renderCalendar(fetchJobs());
    });
    
    document.getElementById('nextMonth').addEventListener('click', async () => {
        currentMonth.setMonth(currentMonth.getMonth() + 1);
        renderCalendar(fetchJobs());
    });

    // 초기 로드
    const user = StorageAPI.getUser();
    renderUser(user);
    const jobs = fetchJobs();
    // 달력은 현재 레이아웃에서는 사용하지 않지만, 데이터 기반 강조는 남겨 둠
    // renderCalendar(jobs);
    attachFilters(jobs);
});
