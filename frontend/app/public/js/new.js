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
        
        try {
            // FE가 /api 를 백엔드로 프록시하므로 상대경로 사용
            await axios.post('/api/jobs', payload, { timeout: 6000 });
            alert('등록되었습니다.');
            location.href = '/';
        } catch (e) {
            console.error(e);
            alert('등록 중 오류가 발생했습니다.');
        }
    });
});
