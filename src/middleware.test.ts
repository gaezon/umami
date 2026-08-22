import { unstable_doesMiddlewareMatch } from 'next/dist/experimental/testing/server/middleware-testing-utils.js';
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { config, middleware } from './middleware';

const doesMiddlewareMatch = (pathname: string) =>
  unstable_doesMiddlewareMatch({
    config,
    url: `https://analytics.example.com${pathname}`,
  });

describe('stealth middleware matcher boundaries', () => {
  test.each([
    ['/api/send', false],
    ['/api/send/foo', true],
    ['/api/public/article-views', false],
    ['/api/public/article-views/private', true],
    ['/api/public/article-views-anything', true],
    ['/umami', false],
    ['/umami-whatever', true],
  ])('%s matches Middleware: %s', (pathname, expected) => {
    expect(doesMiddlewareMatch(pathname)).toBe(expected);
  });
});

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
