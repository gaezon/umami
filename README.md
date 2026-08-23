> **This is a personal fork, not the official Umami project.**  
> **这是个人 fork，不是 [Umami](https://github.com/umami-software/umami) 官方项目。**
>
> Source of the original work: [github.com/umami-software/umami](https://github.com/umami-software/umami)  
> Copyright (c) 2022 [Umami Software, Inc.](https://umami.is) — [MIT License](./LICENSE)

# Umami (personal fork)

This repository is a personal deployment of [Umami](https://umami.is), a privacy-first analytics platform. It tracks [upstream `master`](https://github.com/umami-software/umami) and adds a small set of local patches. It is **not affiliated with, endorsed by, or maintained by Umami Software, Inc.**

For the official project, docs, releases, and support, use:

- Code: [github.com/umami-software/umami](https://github.com/umami-software/umami)
- Docs: [umami.is/docs](https://umami.is/docs/)
- Demo: [cloud.umami.is](https://cloud.umami.is/share/LGazGOecbDtaIwDr/umami.is)

## Changes in this fork

These are the local additions on top of upstream. They are not part of official Umami.

- **Stealth access control** — hide the dashboard from scanners unless a signed cookie is present. See [STEALTH_ACCESS.md](./STEALTH_ACCESS.md).
- **Public article-views API** — `GET /api/public/article-views` for blog pageview counts. See [PUBLIC_ARTICLE_VIEWS.md](./PUBLIC_ARTICLE_VIEWS.md).
- **CI** — Vercel deploy workflows and automatic upstream sync.

If you want stock Umami, clone and run the [official repository](https://github.com/umami-software/umami) instead. Official Docker images also do **not** include these patches.

## License

This project remains under the [MIT License](./LICENSE).

The original software is copyright Umami Software, Inc. and its [contributors](https://github.com/umami-software/umami/graphs/contributors). Modifications in this fork are copyright the fork author, as noted in `LICENSE`. Keeping this repository public does not change that: the MIT condition is to preserve the copyright notice and license text, which this tree does.

---

## Installing from source

### Requirements

- Node.js 18.18+
- PostgreSQL 12.14+

### Get this fork and install packages

```bash
git clone https://github.com/gaezon/umami.git
cd umami
pnpm install
```

To work from official Umami instead:

```bash
git clone https://github.com/umami-software/umami.git
```

### Configure

Create an `.env` file:

```bash
DATABASE_URL=postgresql://username:mypassword@localhost:5432/mydb
```

Optional: set `API_URL` to change the base URL used by internal UI API calls. Relative paths are served under `BASE_PATH`; absolute URLs are proxied through the local `/api` route. For example, `API_URL=/internal-api` or `API_URL=https://api.example.com/api`.

Optional: set `TWO_FACTOR_ENCRYPTION_KEY` to a 64-character hex string to enable two-factor authentication. Generate one with `openssl rand -hex 32`. Two-factor authentication is unavailable until this key is set.

Fork-specific variables are documented in [STEALTH_ACCESS.md](./STEALTH_ACCESS.md) and [PUBLIC_ARTICLE_VIEWS.md](./PUBLIC_ARTICLE_VIEWS.md).

### Build and start

```bash
pnpm run build
pnpm run start
```

The first build creates database tables and a login user with username **admin** and password **umami**. The app listens on `http://localhost:3000` by default.

Official install documentation: [umami.is/docs](https://umami.is/docs/).

## Docker

Official images do not contain this fork's patches:

```bash
docker pull docker.umami.is/umami-software/umami:latest
```

To run **this** tree with Compose (PostgreSQL included):

```bash
docker compose up -d
```

## Updates

This fork is meant to stay close to upstream. After pulling, reinstall and rebuild:

```bash
git pull
pnpm install
pnpm build
```

Upstream itself is [umami-software/umami](https://github.com/umami-software/umami).
