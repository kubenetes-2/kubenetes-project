// 새 공고 등록 JavaScript
document.addEventListener('DOMContentLoaded', function() {
    const $ = id => document.getElementById(id);
    
    document.getElementById('submitBtn').addEventListener('click', async () => {
        const payload = {
            title: $('title').value.trim(),
            company: $('company').value.trim(),
            size: $('size').value.trim(),
            address: $('address').value.trim(),
            role: $('role').value.trim(),
            techStack: $('techStack').value.trim(),
            career: $('career').value.trim(),
            salary: $('salary').value.trim(),
            endDate: $('endDate').value,
        };
        
        if (!payload.title || !payload.company || !payload.endDate) {
            alert('공고명 / 기업명 / 마감일은 필수입니다.');
            return;
        }
        
        const created = StorageAPI.addJob(payload);
        if (created) {
            alert('등록되었습니다.');
            location.href = '/';
        } else {
            alert('등록 실패');
        }
    });
});
