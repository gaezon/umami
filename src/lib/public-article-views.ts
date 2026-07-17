export const PUBLIC_ARTICLE_VIEWS_ENDPOINT = '/api/public/article-views';
export const PUBLIC_ARTICLE_VIEWS_WEBSITE_ID_ENV = 'PUBLIC_ARTICLE_VIEWS_WEBSITE_ID';

export const ARTICLE_PATH_MAX_LENGTH = 500;
export const ARTICLE_VIEWS_QUERY_MAX_LENGTH = 2048;

const ARTICLE_PATH_PREFIXES = ['/posts/', '/en/posts/'] as const;

export class ArticleViewsInputError extends Error {}

export function parseArticlePaths(url: URL): string[] {
  if (url.search.length > ARTICLE_VIEWS_QUERY_MAX_LENGTH) {
    throw new ArticleViewsInputError('Query is too long');
  }

  if ([...url.searchParams.keys()].some(key => key !== 'path')) {
    throw new ArticleViewsInputError('Unknown query parameter');
  }

  const values = url.searchParams.getAll('path');

  if (values.length < 1 || values.length > 2) {
    throw new ArticleViewsInputError('One or two paths are required');
  }

  const paths = values.map(value => {
    const hasInvalidCharacter = [...value].some(character => {
      const code = character.charCodeAt(0);

      return code <= 31 || code === 127 || character === '\\' || character === '?';
    });

    if (!value || value.length > ARTICLE_PATH_MAX_LENGTH || hasInvalidCharacter) {
      throw new ArticleViewsInputError('Invalid article path');
    }

    const hashIndex = value.indexOf('#');
    const path = hashIndex === -1 ? value : value.slice(0, hashIndex);
    const fragment = hashIndex === -1 ? '' : value.slice(hashIndex + 1);

    if (
      (hashIndex !== -1 && (!fragment || fragment.includes('#'))) ||
      !ARTICLE_PATH_PREFIXES.some(prefix => path.startsWith(prefix)) ||
      ARTICLE_PATH_PREFIXES.includes(path as (typeof ARTICLE_PATH_PREFIXES)[number]) ||
      path.includes('//') ||
      path.split('/').some(segment => segment === '.' || segment === '..')
    ) {
      throw new ArticleViewsInputError('Invalid article path');
    }

    return path;
  });

  return [...new Set(paths)];
}

export function isUuid(value: string | undefined): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
  );
}
