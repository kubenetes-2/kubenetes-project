// 메인 애플리케이션 JavaScript
let currentMonth = new Date();

async function fetchJobs() {
    try {
        const res = await axios.get('/api/jobs');
        return res.data || [];
    } catch (err) {
        console.error('채용공고 데이터 로드 실패:', err);
        return [];
    }
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

async function saveUser(method) {
    const payload = {
        name: document.getElementById('name').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
    };
    try {
        const res = await axios({
            url: '/api/user',
            method,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify(payload)
        });
        const u = res.data.user || payload;
        document.getElementById('displayName').textContent = u.name || '-';
        document.getElementById('displayEmail').textContent = u.email || '-';
        document.getElementById('displayPhone').textContent = u.phone || '-';
        alert(method === 'POST' ? '등록 완료' : '수정 완료');
    } catch (e) {
        alert('저장 실패');
        console.error(e);
    }
}

// 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', function() {
    // 버튼 이벤트
    document.getElementById('registerBtn').addEventListener('click', () => saveUser('POST'));
    document.getElementById('updateBtn').addEventListener('click', () => saveUser('PUT'));

    // 달력 네비게이션
    document.getElementById('prevMonth').addEventListener('click', async () => {
        currentMonth.setMonth(currentMonth.getMonth() - 1);
        renderCalendar(await fetchJobs());
    });
    
    document.getElementById('nextMonth').addEventListener('click', async () => {
        currentMonth.setMonth(currentMonth.getMonth() + 1);
        renderCalendar(await fetchJobs());
    });

    // 초기 로드
    (async () => {
        renderCalendar(await fetchJobs());
    })();
});
