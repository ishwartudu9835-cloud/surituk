# Surituk — Stories that bind

**Live karne ki poori guide: [SETUP-GUIDE.md](SETUP-GUIDE.md)**

Manga reading + creator platform with a creator Store (eBooks + print), Google / email-OTP login, PhonePe payments and AdSense slots.
React + Vite frontend, Express API, PostgreSQL.

## Run locally

Requirements: Node 22+, pnpm, a PostgreSQL database (local, Neon or Supabase).

```bash
pnpm install
cp .env.example .env          # then fill in DATABASE_URL
export $(cat .env | xargs)

pnpm --filter @workspace/db run push         # create tables
pnpm --filter @workspace/scripts run seed    # demo data (wipes DB!)

# terminal 1 — API on :8080
pnpm --filter @workspace/api-server run dev
# terminal 2 — website on :5173 (proxies /api to :8080)
pnpm --filter @workspace/manga-platform run dev
```

Open http://localhost:5173

## Brand

| Token | Value |
|---|---|
| Ink (background) | `#0F0D0C` |
| Surituk red (primary) | `#E1191F` |
| Cream (text) | `#F7EFE3` |
| Gold (accent) | `#E8B44A` |
| Headings | Playfair Display |
| Body | Manrope, Noto Sans Devanagari |

Logo files: `artifacts/manga-platform/public/surituk-mark.svg` (red), `surituk-mark-cream.svg`, `favicon.svg`, `surituk-mark.png`.
Theme lives in `artifacts/manga-platform/src/index.css`.
