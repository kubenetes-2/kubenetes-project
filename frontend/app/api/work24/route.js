import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword') || '';
  const page = searchParams.get('page') || 1;
  const perPage = searchParams.get('perPage') || 10;
  
  const API_KEY = '184d5b92-d9ef-4629-b9dc-1947635119ac';
  const BASE_URL = 'https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L21.do';
  
  try {
    // API 요청 URL 구성
    const url = new URL(BASE_URL);
    url.searchParams.append('authKey', API_KEY);
    url.searchParams.append('callTp', 'L');
    url.searchParams.append('returnType', 'XML');  // XML 형식으로 요청
    url.searchParams.append('startPage', page);
    url.searchParams.append('display', perPage);
    if (keyword) url.searchParams.append('keyword', keyword);
    
    console.log('API 요청 URL:', url.toString());
    
    const response = await fetch(url.toString());
    const responseText = await response.text();
    console.log('API 응답:', responseText.substring(0, 500) + '...'); // 응답 일부만 로깅

    if (!response.ok) {
      throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
    }

    // XML 응답 파싱
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      isArray: (name) => name === 'list' || name === 'item' || name === 'dhsOpenEmpInfo'
    });
    
    const jsonObj = parser.parse(responseText);
    console.log('파싱된 데이터:', JSON.stringify(jsonObj, null, 2));

    // Info210L21OutVo 또는 dhsOpenEmpInfoList 구조 모두 지원
    let items = [];
    if (jsonObj && jsonObj.Info210L21OutVo) {
      items = jsonObj.Info210L21OutVo.list || [];
    } else if (jsonObj && jsonObj.dhsOpenEmpInfoList) {
      items = jsonObj.dhsOpenEmpInfoList.dhsOpenEmpInfo || [];
    }
    if (items && !Array.isArray(items)) {
      items = [items];
    }

    // 데이터 가공: dhsOpenEmpInfoList 우선 매핑, 없으면 기존 필드로 폴백
    const jobs = items.map(item => ({
      title: item.empWantedTitle || item.recruTitle || item.title || '제목 없음',
      company: item.empBusiNm || item.corpName || item.corp || '기업명 없음',
      corpDiv: item.coClcdNm || item.corpDiv || item.corpDivNm || '기업구분 정보 없음',
      empType: item.empWantedTypeNm || item.empType || item.empKind || '고용형태 정보 없음',
      career: item.career || item.careerNm || '경력 정보 없음',
      education: item.wantedEduCdNm || item.wantedEduCd || item.edu || item.education || '학력 정보 없음',
      address: item.workAddress || item.region || item.workRgnNm || '근무지 정보 없음',
      role: item.jobType || item.role || '직무 정보 없음',
      salary: item.salary || item.sal || item.salaryNm || '면접 후 결정',
      startDate: item.empWantedStdt || null,
      deadline: item.empWantedEndt || item.endDate || item.deadline || '상시 채용',
      link: item.empWantedHomepgDetail || null,
      logo: item.regLogImgNm || null,
    }));

    console.log('4. jobs(가공본):', JSON.stringify(jobs, null, 2));

    return NextResponse.json({ 
      ok: true, 
      jobs,
      items, // 추출된 중간 데이터
      rawData: jsonObj // 디버깅을 위한 원본 데이터
    });
    
  } catch (error) {
    console.error('Work24 API 오류:', error);
    return NextResponse.json(
      { 
        ok: false, 
        message: error.message || '채용 정보를 가져오는데 실패했습니다.',
        error: error.toString()
      },
      { status: 500 }
    );
  }
}
