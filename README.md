# Quiz Platform (Heroku-first)

Multi-tenant quiz SaaS baseline for schools and publishers.

## Monorepo
- `apps/api`: NestJS API + Prisma + RBAC core
- `apps/web`: Next.js dashboard shell
- `packages/shared`: shared types/utilities

## Quick start
1. `cp .env.example .env`
2. `npm install`
3. `npm run db:generate`
4. `npm run db:migrate`
5. `npm run dev`

## Heroku
- API web dyno uses `Procfile`
- Worker dyno runs background jobs
- Release phase runs migrations
