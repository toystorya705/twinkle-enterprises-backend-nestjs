# Twinkle Enterprises NestJS Backend

Clean NestJS backend for the Twinkle Enterprises CRM and e-commerce platform.

This project is intentionally separate from the React/Vite frontend and the old Next.js API prototype.

## Quick Start

```bash
npm install
npm run prisma:generate
npm run start:dev
```

Swagger runs at:

```text
http://localhost:3000/api/docs
```

The frontend-compatible API prefix is:

```text
http://localhost:3000/api
```

## Architecture

- NestJS modules under `src/modules`
- Prisma/PostgreSQL data access under `src/prisma`
- Global config under `src/config`
- Cross-cutting API concerns under `src/common`
- Shared helpers under `src/shared`

The response envelope matches the existing frontend contract:

```ts
{
  success: boolean;
  data: unknown | null;
  message?: string | null;
  error?: { code?: string; message: string; details?: unknown } | null;
}
```

## Production Security Notes

- Set `NODE_ENV=production`, a strong `JWT_SECRET`, strict `CORS_ORIGIN` values, and `TRUST_PROXY=true` when running behind Nginx, Caddy, Render, Railway, or another trusted proxy.
- Put Cloudflare or an equivalent edge proxy in front of the API. Enable WAF managed rules, bot fight mode, HTTPS-only mode, and cache static `/uploads/*` assets where appropriate.
- Apply edge rate limits for `/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/reset-password`, and `/api/uploads`; keep the NestJS throttler enabled as the application-level backstop.
- Configure the reverse proxy with request body limits matching `UPLOAD_MAX_FILE_SIZE`, connection/read timeouts near `REQUEST_TIMEOUT_MS`, gzip/brotli for JSON responses, and access logs.
- Store uploaded files on persistent storage in production. The API stores relative paths in the database and serves full public URLs based on `PUBLIC_BASE_URL`.
- Run `npm run prisma:deploy` during deployment and `npm run prisma:seed` once with `SEED_ADMIN_PASSWORD` set to create the first Super Admin.
