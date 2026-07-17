import clickhouse from '@/lib/clickhouse';
import { EVENT_TYPE } from '@/lib/constants';
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';

const FUNCTION_NAME = 'getPublicArticleViews';

type ViewsResult = { views: number | string | bigint };

export async function getPublicArticleViews(websiteId: string, paths: string[]): Promise<number> {
  const result = await runQuery({
    [PRISMA]: () => relationalQuery(websiteId, paths),
    [CLICKHOUSE]: () => clickhouseQuery(websiteId, paths),
  });
  const views = Number(result?.[0]?.views ?? 0);

  if (!Number.isSafeInteger(views) || views < 0) {
    throw new Error('Invalid article views result');
  }

  return views;
}

function relationalQuery(websiteId: string, paths: string[]): Promise<ViewsResult[]> {
  const conditions = paths
    .map(
      (_, index) =>
        `(website_event.url_path = {{path${index}}} or left(website_event.url_path, char_length({{path${index}}}) + 1) = {{path${index}}} || '#')`,
    )
    .join(' or ');
  const queryParams = Object.fromEntries(paths.map((path, index) => [`path${index}`, path]));

  return prisma.rawQuery(
    `
    select cast(count(*) as bigint) as "views"
    from website_event
    where website_event.website_id = {{websiteId::uuid}}
      and website_event.event_type = ${EVENT_TYPE.pageView}
      and (${conditions})
    `,
    { websiteId, ...queryParams },
    FUNCTION_NAME,
  );
}

function clickhouseQuery(websiteId: string, paths: string[]): Promise<ViewsResult[]> {
  const conditions = paths
    .map(
      (_, index) =>
        `(url_path = {path${index}:String} or startsWith(url_path, concat({path${index}:String}, '#')))`,
    )
    .join(' or ');
  const queryParams = Object.fromEntries(paths.map((path, index) => [`path${index}`, path]));

  return clickhouse.rawQuery(
    `
    select count(*) as views
    from website_event
    where website_id = {websiteId:UUID}
      and event_type = ${EVENT_TYPE.pageView}
      and (${conditions})
    `,
    { websiteId, ...queryParams },
    FUNCTION_NAME,
  );
}
