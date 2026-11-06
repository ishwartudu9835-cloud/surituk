# Surituk

A full-scale premium manga reading platform — a global destination for manga readers and creators, similar in scope to Webtoon and Crunchyroll.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/manga-platform run dev` — run the frontend (port 19485, proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed` — wipe DB and load demo data
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Wouter + TanStack Query + Framer Motion + shadcn/ui + Recharts
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/manga-platform/src/pages/` — all frontend pages
- `artifacts/manga-platform/src/App.tsx` — router, navbar, footer
- `artifacts/manga-platform/src/index.css` — dark theme CSS variables
- `artifacts/api-server/src/routes/` — all API route handlers
- `artifacts/api-server/src/app.ts` — Express app, routes mounted at `/api`
- `lib/db/src/schema/` — Drizzle ORM schema (source of truth)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react/src/generated/api.ts` — all generated React Query hooks

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → typed React Query hooks. Never write fetch calls by hand.
- Dark-mode-only UI. Brand: ink background (#0F0D0C), Surituk red (#E1191F) primary, warm gold accent, cream text (#F7EFE3). Headings in Playfair Display, body in Manrope (+ Noto Sans Devanagari). Logo mark at `public/surituk-mark.svg`.
- Chapter reader uses a full-screen layout without navbar/footer (separate `ReaderLayout`).
- Auth: email OTP + Google ID token → signed bearer token (localStorage). `lib/auth.ts` on the server, `src/lib/auth.tsx` on the client. Store, uploads, admin endpoints are hand-written in `routes/{auth,uploads,market,admin}.ts` and called via `src/lib/api.ts` (not Orval).
- Store money is in paise. Commission = COMMISSION_PERCENT of book price; shipping goes to creator. Payments via PhonePe Standard Checkout v2 (`lib/phonepe.ts`); mock payment page only when PhonePe keys are missing and NODE_ENV != production.
- Files: Cloudflare R2 when S3_* env set, else local `uploads/` (dev only).
- All routes are path-based through the shared proxy. Frontend at `/`, API at `/api`.

## Product

**Surituk** offers:
- **Home** — Hero banner with featured manga, trending, new releases, top monthly, genres, creator spotlight, and leaderboard widget
- **Browse** — Full catalog with search, genre filters, language, sort order; visual grid with status badges and hover stats
- **Manga Detail** — Banner, cover, metadata, chapter list, like button, related manga
- **Chapter Reader** — Full-screen immersive reader with prev/next chapter nav, click-to-toggle UI
- **Leaderboard** — Weekly/monthly manga and creator rankings with podium spotlight for top 3
- **Contests & Quizzes** — Active/upcoming/ended contests with expandable rules, prizes, and winners
- **Community** — Discussion threads, reviews, polls, announcements; post creation dialog with type selection
- **Creator Profile** — Public page with stats, social links, views chart, revenue chart, manga list
- **Creator Dashboard** — Private studio with overview stats, weekly views chart, top manga, manga management, upload forms for manga and chapters, revenue breakdown with pie and bar charts
- **User Profile** — Points, tokens, reading history with progress bars, bookmarks, notifications
- **Genre Pages** — Filtered manga grid per genre with color-coded hero
- **Info Pages** — About, Contact, Terms, Privacy, DMCA

## Seed data

- 5 creators (Hiroshi Takeda, Yuki Matsumoto, Kento Aoyama, Sakura Nishi, Ryu Nakamura)
- 10 genres with colors
- 12 manga titles across all genres
- 12 chapters (5 for manga 1, 4 for manga 2, 3 for manga 3) with 18 pages each
- 3 users (shadow_reader, neon_dreamer, midnight_ink)
- 3 contests (1 active, 1 upcoming, 1 ended)
- 5 community posts across all types
- Reading history, bookmarks, notifications for user 1

## User preferences

_None recorded yet._

## Gotchas

- Routes like `/manga/featured` must be defined BEFORE `/manga/:id` in Express or they'll be swallowed by the param route.
- The API server must be rebuilt (workflow restart) to pick up route changes — it compiles with esbuild.
- `pnpm --filter @workspace/manga-platform run typecheck` (not `build`) to verify frontend — `build` needs `PORT` env var.
- Always import hooks from `@workspace/api-client-react`, never write raw fetch calls.
- Chapter reader page uses `ReaderLayout` (no nav/footer), wired in `App.tsx` before the main `<Switch>`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `lib/api-spec/openapi.yaml` before adding new API endpoints
- Run `pnpm --filter @workspace/api-spec run codegen` after editing the OpenAPI spec
