// 수정 페이지 JavaScript
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('editForm');
    const urlParams = new URLSearchParams(window.location.search);
    const jobId = urlParams.get('id');

    if (jobId) {
        document.getElementById('jobId').value = jobId;
        const job = StorageAPI.getJob(jobId);
        if (job) {
            document.getElementById('title').value = job.title || '';
            document.getElementById('company').value = job.company || '';
            document.getElementById('scale').value = job.size || '';
            document.getElementById('address').value = job.address || '';
            document.getElementById('position').value = job.role || '';
            document.getElementById('skills').value = job.techStack || '';
            document.getElementById('career').value = job.career || '';
            document.getElementById('salary').value = job.salary || '';
            document.getElementById('deadline').value = job.endDate || '';
        }
    }

    form.addEventListener('submit', e => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form));
        const updated = StorageAPI.updateJob(data.id, {
            title: data.title,
            company: data.company,
            size: data.scale,
            address: data.address,
            role: data.position,
            techStack: data.skills,
            career: data.career,
            salary: data.salary,
            endDate: data.deadline,
        });
        if (updated) {
            window.location.href = '/';
        } else {
            alert('수정 대상이 없습니다.');
        }
    });
});
