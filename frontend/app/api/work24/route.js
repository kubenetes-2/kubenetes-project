import { NextResponse } from 'next/server';

const BACKEND_API_BASE = process.env.BACKEND_API_URL
  || process.env.NEXT_PUBLIC_BACKEND_API_URL
  || 'http://backend-proxy.dev-front.svc.cluster.local:8000';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword') || '';
  const page = searchParams.get('page') || '1';
  const perPage = searchParams.get('perPage') || '10';

  try {
    const targetUrl = new URL('/api/import/work24', BACKEND_API_BASE);
    targetUrl.searchParams.set('page', page);
    targetUrl.searchParams.set('perPage', perPage);
    if (keyword) targetUrl.searchParams.set('keyword', keyword);

    const response = await fetch(targetUrl.toString(), { cache: 'no-store' });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Backend Work24 proxy failed: ${response.status} ${response.statusText} ${body}`);
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[frontend/api/work24] proxy error:', error);
    return NextResponse.json(
      {
        ok: false,
        message: error.message || '채용 정보를 가져오는데 실패했습니다.',
        error: error.toString(),
      },
      { status: 500 },
    );
  }
}
