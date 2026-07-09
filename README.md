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
