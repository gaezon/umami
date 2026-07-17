# 公开文章阅读量接口

该接口供 Astro 博客公开读取单篇文章的累计 pageviews。它只接受文章路径；站点 ID 由 Umami 服务端配置，不会通过请求或响应暴露。

## Umami 配置

在部署环境中设置：

```text
PUBLIC_ARTICLE_VIEWS_WEBSITE_ID=<博客在 Umami 中的 website UUID>
```

接口路径为：

```text
GET /api/public/article-views
```

成功响应由 CDN 缓存 10 分钟（`s-maxage=600`），浏览器缓存 1 分钟，并允许跨域只读请求。

## 请求参数

使用一个或两个重复的 `path` 查询参数：

```text
GET /api/public/article-views?path=%2Fposts%2Fhello-world
GET /api/public/article-views?path=%2Fposts%2Fhello-world&path=%2Fen%2Fposts%2Fhello-world
```

- 参数名只能是 `path`，数量必须为 1～2 个。
- 每个路径解码后最多 500 个字符，整个查询字符串最多 2048 个字符。
- 路径必须以 `/posts/` 或 `/en/posts/` 开头，且必须指向具体文章。
- 传入中英文两个路径时，数据库使用 OR 条件合并计数。因此无论请求从中文页还是英文页发起，只要传入同一组翻译路径，都会得到相同的合计阅读量。
- 历史数据中 `/posts/example#章节` 这类路径会自动归入 `/posts/example`。调用方通常只需传 `location.pathname`；如确需在查询参数中传 `#`，必须将其编码为 `%23`。

## 响应格式

无论成功或失败，响应 JSON 都只有一个字段：

```json
{ "views": 123 }
```

- `200`：查询成功。
- `400`：路径、参数数量或长度不合法，返回 `{ "views": 0 }`。
- `500`：查询异常，返回 `{ "views": 0 }`。
- `503`：服务端未正确配置站点 ID，返回 `{ "views": 0 }`。

Astro 接入时应先检查 `response.ok`，不要把错误响应中的 `0` 当作真实阅读量。示例：

```ts
const params = new URLSearchParams();
params.append('path', '/posts/hello-world');
params.append('path', '/en/posts/hello-world');

const response = await fetch(`${UMAMI_ORIGIN}/api/public/article-views?${params}`);
if (!response.ok) throw new Error('Unable to load article views');

const data: { views: number } = await response.json();
```

该文档仅说明后续接入约定；本次改动不包含 AstroPaper-blog 的任何修改。
