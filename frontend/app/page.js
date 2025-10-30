'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

export default function Home() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('채용 정보 요청 중...');
        
        const response = await fetch(`/api/work24?keyword=${encodeURIComponent(searchTerm)}`);
        const data = await response.json();
        
        console.log('API 응답 데이터:', data);
        
        if (!response.ok) {
          throw new Error(data.message || '서버에서 오류가 발생했습니다.');
        }
        
        if (data.ok) {
          if (Array.isArray(data.jobs) && data.jobs.length > 0) {
            setJobs(data.jobs);
            console.log(`${data.jobs.length}개의 채용 공고를 불러왔습니다.`);
          } else {
            console.log('채용 정보가 없습니다. 응답 데이터:', data);
            setError('검색 결과가 없습니다. 다른 검색어로 시도해 주세요.');
            setJobs([]);
          }
        } else {
          throw new Error(data.message || '데이터 처리 중 오류가 발생했습니다.');
        }
      } catch (err) {
        console.error('채용 정보 로딩 중 오류 발생:', err);
        setError(`오류: ${err.message}`);
        setJobs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, [searchTerm]);

  const handleSearch = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newSearchTerm = formData.get('search') || '';
    console.log('New search term:', newSearchTerm);
    setSearchTerm(newSearchTerm);
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>채용 정보를 불러오는 중입니다...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <p>오류: {error}</p>
        <button onClick={() => window.location.reload()} className={styles.retryButton}>
          다시 시도하기
        </button>
      </div>
    );
  }

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>채용 공고</h1>
      
      <form onSubmit={handleSearch} className={styles.searchForm}>
        <input
          type="text"
          name="search"
          placeholder="검색어를 입력하세요 (예: 개발자, 디자이너...)"
          className={styles.searchInput}
          defaultValue={searchTerm}
        />
        <button type="submit" className={styles.searchButton}>
          검색
        </button>
      </form>

      <div className={styles.jobsContainer}>
        {jobs.length > 0 ? (
          <div className={styles.jobsGrid}>
            {jobs.map((job, index) => (
              <div key={index} className={styles.jobCard}>
                <h2>{job.title || '제목 없음'}</h2>
                <div className={styles.jobDetails}>
                  <p><strong>기업명:</strong> {job.company || '기업명 없음'}</p>
                  <p><strong>기업구분:</strong> {job.corpDiv || '기업구분 정보 없음'}</p>
                  <p><strong>고용형태:</strong> {job.empType || '고용형태 정보 없음'}</p>
                  <p><strong>경력:</strong> {job.career || '경력 무관'}</p>
                  <p><strong>학력:</strong> {job.education || '학력 정보 없음'}</p>
                </div>
                <div className={styles.jobDetails}>
                  <p><strong>근무지:</strong> {job.address || '미정'}</p>
                  <p><strong>직무:</strong> {job.role || '미정'}</p>
                  <p><strong>급여:</strong> {job.salary || '면접 후 결정'}</p>
                  <p className={styles.deadline}>
                    <strong>마감일:</strong> {job.deadline || '상시 채용'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.noResults}>
            <p>검색 결과가 없습니다.</p>
            <button onClick={() => setSearchTerm('')} className={styles.clearButton}>
              검색 초기화
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
