import { NextRequest } from 'next/server';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { middleware } from './middleware';

describe('stealth middleware public article views allowlist', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('allows the exact public article views endpoint without an access token', async () => {
    vi.stubEnv('ACCESS_TOKEN', 'private-access-token');
    const response = await middleware(
      new NextRequest(
        'https://analytics.example.com/api/public/article-views?path=%2Fposts%2Fhello',
      ),
    );

    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  test('does not allow a lookalike endpoint', async () => {
    vi.stubEnv('ACCESS_TOKEN', 'private-access-token');
    const response = await middleware(
      new NextRequest('https://analytics.example.com/api/public/article-views/private'),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('no-store, max-age=0');
  });
});
