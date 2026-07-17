import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { getPublicArticleViews } = vi.hoisted(() => ({
  getPublicArticleViews: vi.fn(),
}));

vi.mock('@/queries/sql', () => ({ getPublicArticleViews }));

import { GET } from './route';

const WEBSITE_ID = '123e4567-e89b-42d3-a456-426614174000';

function request(query: string) {
  return new Request(`https://analytics.example.com/api/public/article-views?${query}`);
}

describe('public article views route', () => {
  beforeEach(() => {
    process.env.PUBLIC_ARTICLE_VIEWS_WEBSITE_ID = WEBSITE_ID;
    getPublicArticleViews.mockReset();
  });

  afterEach(() => {
    delete process.env.PUBLIC_ARTICLE_VIEWS_WEBSITE_ID;
  });

  test('returns only the combined views and enables CDN caching', async () => {
    getPublicArticleViews.mockResolvedValue(42);

    const response = await GET(request('path=%2Fposts%2Fhello&path=%2Fen%2Fposts%2Fhello'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ views: 42 });
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=60, s-maxage=600, stale-while-revalidate=60',
    );
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(getPublicArticleViews).toHaveBeenCalledWith(WEBSITE_ID, [
      '/posts/hello',
      '/en/posts/hello',
    ]);
  });

  test('returns the same minimal shape for invalid public input', async () => {
    const response = await GET(request('path=%2Fadmin'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ views: 0 });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(getPublicArticleViews).not.toHaveBeenCalled();
  });

  test('does not expose a database failure', async () => {
    getPublicArticleViews.mockRejectedValue(new Error('postgresql://user:password@database'));

    const response = await GET(request('path=%2Fposts%2Fhello'));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ views: 0 });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  test('does not query when the server-side website id is missing', async () => {
    delete process.env.PUBLIC_ARTICLE_VIEWS_WEBSITE_ID;

    const response = await GET(request('path=%2Fposts%2Fhello'));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ views: 0 });
    expect(getPublicArticleViews).not.toHaveBeenCalled();
  });
});
