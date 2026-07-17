import { describe, expect, test } from 'vitest';
import {
  ARTICLE_PATH_MAX_LENGTH,
  ARTICLE_VIEWS_QUERY_MAX_LENGTH,
  ArticleViewsInputError,
  isUuid,
  parseArticlePaths,
} from './public-article-views';

function requestUrl(query: string) {
  return new URL(`https://analytics.example.com/api/public/article-views?${query}`);
}

describe('parseArticlePaths', () => {
  test('accepts one article path', () => {
    expect(parseArticlePaths(requestUrl('path=%2Fposts%2Fhello-world'))).toEqual([
      '/posts/hello-world',
    ]);
  });

  test('accepts and preserves both Chinese and English article paths', () => {
    const url = requestUrl('path=%2Fposts%2F%E4%BD%A0%E5%A5%BD&path=%2Fen%2Fposts%2Fhello-world');

    expect(parseArticlePaths(url)).toEqual(['/posts/你好', '/en/posts/hello-world']);
  });

  test('normalizes historical section fragments to their article path', () => {
    expect(parseArticlePaths(requestUrl('path=%2Fposts%2Fhello%23%E7%AB%A0%E8%8A%82'))).toEqual([
      '/posts/hello',
    ]);
  });

  test.each([
    '',
    'path=%2Fabout',
    'path=%2Fposts%2F',
    'path=%2Fposts%2F..%2Fsecret',
    'path=%2Fposts%2Fhello%3Fpreview%3D1',
    'path=%2Fposts%2Fhello%23',
    'path=%2Fposts%2Fa&path=%2Fen%2Fposts%2Fa&path=%2Fposts%2Fb',
    'path=%2Fposts%2Fa&websiteId=secret',
  ])('rejects invalid query %s', query => {
    expect(() => parseArticlePaths(requestUrl(query))).toThrow(ArticleViewsInputError);
  });

  test('enforces decoded path and encoded query length limits', () => {
    expect(() =>
      parseArticlePaths(requestUrl(`path=/posts/${'a'.repeat(ARTICLE_PATH_MAX_LENGTH)}`)),
    ).toThrow(ArticleViewsInputError);
    expect(() =>
      parseArticlePaths(requestUrl(`path=/posts/a&${'x'.repeat(ARTICLE_VIEWS_QUERY_MAX_LENGTH)}`)),
    ).toThrow(ArticleViewsInputError);
  });
});

describe('isUuid', () => {
  test('only accepts UUIDs suitable for a server-side website id', () => {
    expect(isUuid('123e4567-e89b-42d3-a456-426614174000')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});
