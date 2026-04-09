# DIMADONG

## Stack
- Next.js 16 + React 19 in `apps/web`
- NestJS 11 + Socket.IO in `apps/realtime`
- TypeScript across apps and packages
- PostgreSQL + Prisma schema in `prisma/`
- Shared workspace packages in `packages/`

## Project Structure
- `apps/web`: home, manual, lobby, table UI
- `apps/realtime`: authoritative gameplay service, sockets, timers, health checks
- `packages/contracts`: shared event and state types
- `packages/game-engine`: state machine and game rules
- `packages/ui`: shared React UI primitives
- `prisma/schema.prisma`: durable data model
- `docs/`: architecture and runbooks

## Key Commands
- `npx pnpm install` - install workspace dependencies
- `npx pnpm dev:web` - start the Next.js app
- `npx pnpm dev:realtime` - start the NestJS realtime service
- `npx pnpm build` - build every workspace package
- `npx pnpm db:generate` - generate Prisma client

## Important Context
- The server is the source of truth for every gameplay mutation.
- The system is modeled around seats, not permanent user accounts.
- Wildcard legality and BONGS logic must stay in shared domain logic, not UI handlers.
- 3v3 exists only behind a feature flag until mobile readability is proven.

## Workflow
- Read `DIMADONG_TECHNICAL_PRD.md` before implementing features.
- Keep gameplay rules in shared packages, not duplicated across apps.
- Commit by feature milestone, not by file.
- Update the PRD when major technical choices change.
