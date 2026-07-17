import {
  ArticleViewsInputError,
  isUuid,
  PUBLIC_ARTICLE_VIEWS_WEBSITE_ID_ENV,
  parseArticlePaths,
} from '@/lib/public-article-views';
import { getPublicArticleViews } from '@/queries/sql';

const PUBLIC_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=60',
};

const ERROR_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
};

function viewsResponse(views: number, status = 200, headers = PUBLIC_HEADERS) {
  return Response.json({ views }, { status, headers });
}

export async function GET(request: Request) {
  try {
    const paths = parseArticlePaths(new URL(request.url));
    const websiteId = process.env[PUBLIC_ARTICLE_VIEWS_WEBSITE_ID_ENV];

    if (!isUuid(websiteId)) {
      return viewsResponse(0, 503, ERROR_HEADERS);
    }

    const views = await getPublicArticleViews(websiteId, paths);

    return viewsResponse(views);
  } catch (error) {
    if (error instanceof ArticleViewsInputError) {
      return viewsResponse(0, 400, ERROR_HEADERS);
    }

    // Keep internal database and configuration details out of this public response.
    return viewsResponse(0, 500, ERROR_HEADERS);
  }
}
