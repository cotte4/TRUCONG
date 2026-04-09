# DIMADONG Deployment Split

## Recommended Production Shape

- `apps/web` on Vercel
- `apps/realtime` on Render as a Web Service
- PostgreSQL on Render Postgres, Neon, Supabase, or Railway Postgres
- Redis later if/when multi-instance realtime is introduced

This project is a better fit for a split deployment than an all-in-Vercel deployment because the web app is a normal Next.js frontend while the realtime backend is a long-lived NestJS + Socket.IO server.

## Why This Split

- Vercel is a strong fit for the Next.js frontend.
- The realtime backend expects a persistent Socket.IO server process.
- Render Web Services are a better fit for long-lived websocket-style backend traffic than trying to force the current realtime server into a frontend-function platform shape.

## Environment Variables

### Web on Vercel

Set these in the Vercel project for `apps/web`:

- `NEXT_PUBLIC_REALTIME_URL=https://your-realtime-service.onrender.com`
- `NEXT_PUBLIC_API_BASE_URL=https://your-realtime-service.onrender.com`

Optional:

- `NEXT_PUBLIC_SITE_URL=https://your-web-app.vercel.app`

### Realtime on Render

Set these in the Render service for `apps/realtime`:

- `PORT=4001`
- `CORS_ORIGIN=https://your-web-app.vercel.app`
- `DATABASE_URL=...`
- `DIRECT_URL=...`
- `ROOM_CODE_LENGTH=6`

Optional later:

- `REDIS_URL=...`

## Vercel Setup

Create a Vercel project pointing at `apps/web`.

Recommended settings:

- Framework: Next.js
- Root Directory: `apps/web`
- Install Command: `pnpm install`
- Build Command: `pnpm build`
- Output Directory: default

If Vercel is configured from the monorepo root instead, make sure the project still builds the web workspace and has the public realtime env vars above.

## Render Setup

Create a Render Web Service for the NestJS realtime server.

Recommended settings:

- Root Directory: repo root or `apps/realtime`, depending on your Render setup preference
- Build Command from repo root: `pnpm install && pnpm --filter @dimadong/realtime build`
- Start Command from repo root: `pnpm --filter @dimadong/realtime start:prod`

If you deploy from `apps/realtime` directly, use the equivalent local commands for that directory.

## Database

Before first production boot:

1. provision PostgreSQL
2. set `DATABASE_URL` and `DIRECT_URL`
3. run `pnpm db:generate`
4. run `pnpm db:push`

## Smoke Test

After both deployments are live:

1. open the Vercel URL
2. create a room
3. open the same room in another browser/device
4. verify join, ready, start, socket sync, and one full match
5. verify summary opens after match end

## Current MVP Limits

- chat persistence is not implemented
- reactions persistence is not implemented
- replacement flow is not implemented
- Redis-backed horizontal scaling is not implemented

For the current MVP, a single Render realtime instance plus Vercel web is the cleanest production path.
