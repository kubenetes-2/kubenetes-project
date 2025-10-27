// 수정 페이지 JavaScript
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('editForm');
    
    // URL에서 ID 파라미터 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const jobId = urlParams.get('id');
    
    if (jobId) {
        document.getElementById('jobId').value = jobId;
        loadJobData(jobId);
    }
    
    form.addEventListener('submit', async e => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form));
        try {
            await axios.put(`/api/jobs/${data.id}`, data);
            window.location.href = '/';
        } catch (error) {
            console.error('수정 실패:', error);
            alert('수정 중 오류가 발생했습니다.');
        }
    });
    
    async function loadJobData(id) {
        try {
            const response = await axios.get(`/api/jobs/${id}`);
            const job = response.data;
            
            document.getElementById('title').value = job.title || '';
            document.getElementById('company').value = job.company || '';
            document.getElementById('scale').value = job.size || '';
            document.getElementById('address').value = job.address || '';
            document.getElementById('position').value = job.role || '';
            document.getElementById('skills').value = job.stack || '';
            document.getElementById('career').value = job.career || '';
            document.getElementById('salary').value = job.salary || '';
            document.getElementById('deadline').value = job.deadline || '';
        } catch (error) {
            console.error('데이터 로드 실패:', error);
            alert('데이터를 불러오는데 실패했습니다.');
        }
    }
});
