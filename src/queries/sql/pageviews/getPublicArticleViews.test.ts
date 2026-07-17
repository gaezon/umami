import { beforeEach, describe, expect, test, vi } from 'vitest';

const { clickhouseRawQuery, database, relationalRawQuery } = vi.hoisted(() => ({
  clickhouseRawQuery: vi.fn(),
  database: { current: 'prisma' },
  relationalRawQuery: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: { rawQuery: relationalRawQuery },
}));

vi.mock('@/lib/clickhouse', () => ({
  default: { rawQuery: clickhouseRawQuery },
}));

vi.mock('@/lib/db', () => ({
  PRISMA: 'prisma',
  CLICKHOUSE: 'clickhouse',
  runQuery: (queries: Record<string, () => unknown>) => queries[database.current](),
}));

import { getPublicArticleViews } from './getPublicArticleViews';

describe('getPublicArticleViews', () => {
  beforeEach(() => {
    database.current = 'prisma';
    clickhouseRawQuery.mockReset();
    relationalRawQuery.mockReset();
  });

  test('combines two paths with OR and includes historical hash variants', async () => {
    relationalRawQuery.mockResolvedValue([{ views: BigInt(37) }]);

    await expect(
      getPublicArticleViews('123e4567-e89b-42d3-a456-426614174000', [
        '/posts/hello',
        '/en/posts/hello',
      ]),
    ).resolves.toBe(37);

    const [sql, params] = relationalRawQuery.mock.calls[0];

    expect(sql).toContain("{{path0}} || '#') or (website_event.url_path = {{path1}}");
    expect(sql).toContain("{{path1}} || '#'");
    expect(sql).toContain('website_event.event_type = 1');
    expect(params).toEqual({
      websiteId: '123e4567-e89b-42d3-a456-426614174000',
      path0: '/posts/hello',
      path1: '/en/posts/hello',
    });
  });

  test('uses equivalent OR and hash matching with ClickHouse', async () => {
    database.current = 'clickhouse';
    clickhouseRawQuery.mockResolvedValue([{ views: 37 }]);

    await expect(
      getPublicArticleViews('123e4567-e89b-42d3-a456-426614174000', [
        '/posts/hello',
        '/en/posts/hello',
      ]),
    ).resolves.toBe(37);

    const [sql, params] = clickhouseRawQuery.mock.calls[0];

    expect(sql).toContain("concat({path0:String}, '#'))) or (url_path = {path1:String}");
    expect(sql).toContain("concat({path1:String}, '#')");
    expect(sql).toContain('event_type = 1');
    expect(params).toEqual({
      websiteId: '123e4567-e89b-42d3-a456-426614174000',
      path0: '/posts/hello',
      path1: '/en/posts/hello',
    });
  });
});
