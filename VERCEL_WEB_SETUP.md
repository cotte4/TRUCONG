# Vercel Web Setup

## Target

Deploy `apps/web` to Vercel and point it at the separately hosted realtime backend.

## Team

- Team name: `corchito's projects`
- Team id: `team_xmFIv8SLScb7fPGh5Ki0autv`

## Recommended Project Name

- `dimadong-web`

## Vercel Project Settings

Create the Vercel project with these settings:

- Framework Preset: `Next.js`
- Root Directory: `apps/web`
- Install Command: `pnpm install`
- Build Command: `pnpm build`
- Output Directory: default

## Required Environment Variables

Set these in the Vercel project:

- `NEXT_PUBLIC_REALTIME_URL=https://your-realtime-service.onrender.com`
- `NEXT_PUBLIC_API_BASE_URL=https://your-realtime-service.onrender.com`

The same values are documented in [apps/web/.env.example](C:/Users/fran-/OneDrive/Escritorio/TRUCONG/apps/web/.env.example).

## Link And Deploy From CLI

From the repo root:

```bash
npx vercel link --scope corchitos-projects
```

When prompted:

- choose the existing scope `corchitos-projects`
- create a new project
- name it `dimadong-web`
- set the root directory to `apps/web`

Then deploy:

```bash
npx vercel --prod --scope corchitos-projects
```

## After Link

Once the project is linked, a local file should exist here:

- `.vercel/project.json`

At that point, the Vercel plugin can be used more directly to inspect deployments and project state.

## Important

This only covers the frontend deployment.

The realtime backend should still be deployed separately, for example on Render, and the public backend URL should be used in the Vercel env vars above.
