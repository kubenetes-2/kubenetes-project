'use client';

import { useState, useEffect } from 'react';
import styles from './jobs.module.css';

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/work24?page=${page}&keyword=${encodeURIComponent(searchTerm)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch jobs');
        }
        const data = await response.json();
        if (data.ok) {
          setJobs(data.jobs);
        } else {
          throw new Error(data.message || 'Failed to load jobs');
        }
      } catch (err) {
        setError(err.message);
        console.error('Error fetching jobs:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, [page, searchTerm]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1); // Reset to first page on new search
  };

  if (loading) {
    return <div className={styles.loading}>Loading job listings...</div>;
  }

  if (error) {
    return <div className={styles.error}>Error: {error}</div>;
  }

  return (
    <div className={styles.container}>
      <h1>채용 공고</h1>
      
      <form onSubmit={handleSearch} className={styles.searchForm}>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="검색어를 입력하세요 (예: 개발자, 디자이너...)"
          className={styles.searchInput}
        />
        <button type="submit" className={styles.searchButton}>
          검색
        </button>
      </form>

      <div className={styles.jobsGrid}>
        {jobs.length > 0 ? (
          jobs.map((job, index) => (
            <div key={index} className={styles.jobCard}>
              <h2>{job.title || '제목 없음'}</h2>
              <p className={styles.company}>{job.company || '기업명 없음'}</p>
              <p className={styles.info}><strong>근무지:</strong> {job.address || '미정'}</p>
              <p className={styles.info}><strong>직무:</strong> {job.role || '미정'}</p>
              <p className={styles.info}><strong>경력:</strong> {job.career || '경력 무관'}</p>
              <p className={styles.info}><strong>급여:</strong> {job.salary || '면접 후 결정'}</p>
              <p className={styles.deadline}>
                <strong>마감일:</strong> {job.deadline || '상시 채용'}
              </p>
            </div>
          ))
        ) : (
          <p className={styles.noResults}>검색 결과가 없습니다.</p>
        )}
      </div>

      <div className={styles.pagination}>
        <button 
          onClick={() => setPage(p => Math.max(1, p - 1))} 
          disabled={page === 1}
          className={styles.pageButton}
        >
          이전
        </button>
        <span className={styles.pageNumber}>페이지 {page}</span>
        <button 
          onClick={() => setPage(p => p + 1)}
          disabled={jobs.length === 0}
          className={styles.pageButton}
        >
          다음
        </button>
      </div>
    </div>
  );
}
