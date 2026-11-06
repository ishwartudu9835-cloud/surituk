# Surituk — Live karne ki poori guide (Hinglish)

Website ke 3 hisse hain:

| Hissa | Kahan chalega | Kya karta hai |
|---|---|---|
| **Website (frontend)** | Cloudflare Pages | Jo log dekhte hain |
| **Backend (API)** | Render.com (free) | Login, upload, payment, orders |
| **Database** | Neon.tech (free Postgres) | Saara data |
| **Files** | Cloudflare R2 | Covers, chapter pages, book PDFs |

Is order me karo 👇

---

## 1. GitHub pe code daalo
1. github.com pe naya **private** repo banao, jaise `surituk`.
2. Is zip ka saara code usme upload/push karo.

## 2. Database — Neon
1. neon.tech → Sign up → **New Project** (region: AWS Asia Pacific – Singapore, India ke sabse paas).
2. **Connection string** copy karo (`postgres://...sslmode=require`). Ye `DATABASE_URL` hai. Kisi ko share mat karna.
3. Tables banane ke liye (computer pe kuch install kiye bina):
   Neon Console → **SQL Editor** → repo ki `db/schema.sql` file ka poora content paste karo → **Run**.
4. (Optional) Demo manga/creators chahiye to `db/demo-data.sql` bhi paste karke Run karo. Isme Store ke books nahi hain — wo creators khud daalenge.

## 3. Files — Cloudflare R2
1. Cloudflare Dashboard → **R2** → 2 buckets banao: `surituk-public` aur `surituk-private`.
2. `surituk-public` → Settings → **Public access → R2.dev subdomain → Allow**. Jo URL mile (`https://pub-xxxx.r2.dev`) wo `S3_PUBLIC_URL` hai.
3. `surituk-private` ko **public mat karna** — isme bechi hui books ki PDF rahengi.
4. R2 → **Manage API tokens → Create token** (Object Read & Write). Access Key ID, Secret, aur endpoint (`https://<account-id>.r2.cloudflarestorage.com`) copy karo.

## 4. Email OTP — Brevo (Render free pe yahi chalega)
Render ka free plan SMTP ports block karta hai, isliye Gmail SMTP wahan kaam nahi karta. Brevo HTTPS se email bhejta hai:
1. brevo.com → free account banao.
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender** → apna Gmail daalo → email me aaya link dabake verify karo.
3. **SMTP & API → API Keys → Generate a new API key** → copy karo.
4. Render me `BREVO_API_KEY` = wo key, `MAIL_FROM_EMAIL` = verified Gmail.
5. Baad me apna domain (surituk.com) Brevo me verify karoge to emails spam me kam jayengi.

### (Option B) Email OTP — Gmail SMTP (sirf paid Render / VPS pe)
1. Jis Gmail se OTP bhejna hai, uspe **2-Step Verification** on karo.
2. myaccount.google.com/apppasswords → app password banao (16 letters). Ye `SMTP_PASS` hai, Gmail address `SMTP_USER`.
3. Gmail din me ~500 email tak bhejta hai. Zyada users ho jaayein to Brevo / Resend ka SMTP use karo (sirf SMTP_HOST/USER/PASS badlenge).

## 5. Google Login
1. console.cloud.google.com → naya project → **APIs & Services → OAuth consent screen** (External, app name Surituk).
2. **Credentials → Create credentials → OAuth client ID → Web application**.
3. **Authorized JavaScript origins** me apni website daalo: `https://surituk.pages.dev` (aur custom domain ho to wo bhi). Local test ke liye `http://localhost:5173`.
4. Client ID copy karo → `GOOGLE_CLIENT_ID`. (Client secret ki zaroorat nahi.)

## 6. PhonePe Payment Gateway
1. business.phonepe.com pe merchant account banao (PAN, bank, KYC lagega). **Note:** physical + digital goods bechna hai, ye business details me batana.
2. Dashboard → **Developer settings** se **Client ID, Client Secret, Client Version** lo.
3. Pehle `PHONEPE_ENV=sandbox` rakh ke test karo, phir `production`.
4. **Webhook** set karo: URL `https://surituk-api.onrender.com/api/payments/phonepe/webhook`, username/password apne se banao → `PHONEPE_WEBHOOK_USER` / `PHONEPE_WEBHOOK_PASS`.
   (Webhook na bhi ho to bhi chalega — payment ke baad page khud PhonePe se status check karta hai.)

## 7. Backend — Render
1. render.com → **New → Blueprint** → apna GitHub repo chuno (`render.yaml` already hai).
2. Saare env vars bharo (list `.env.example` me hai).
   - `FRONTEND_URL` = apni Cloudflare website ka link
   - `API_PUBLIC_URL` = Render ka link (jaise `https://surituk-api.onrender.com`)
   - `ADMIN_EMAILS` = apna email (Admin panel milega)
3. Tables Neon ke SQL Editor se ban chuke hain (step 2). Ya computer se bhi bana sakte ho:
   ```bash
   pnpm install
   DATABASE_URL="neon-wala-string" pnpm --filter @workspace/db run push
   # demo data chahiye to (sab data mita deta hai!):
   DATABASE_URL="neon-wala-string" pnpm --filter @workspace/scripts run seed
   ```
   ⚠️ Live site pe asli users aane ke baad **seed kabhi mat chalana**.
4. Free plan 15 min idle ke baad so jaata hai (pehla request ~30 sec slow). Traffic aane pe $7/month Starter le lena.

## 8. Website — Cloudflare Pages (Git se, taaki har update auto deploy ho)
1. Cloudflare → **Workers & Pages → Create → Pages → Connect to Git** → GitHub → repo `surituk` → **Begin setup**.
2. Settings:
   - Production branch: `main`
   - Framework preset: `None`
   - Build command: `pnpm install --frozen-lockfile && pnpm --filter @workspace/manga-platform run build`
   - Build output directory: `artifacts/manga-platform/dist/public`
   - Environment variables:
     - `VITE_API_URL` = Render ka link (jaise `https://surituk-api.onrender.com`)
     - `NODE_VERSION` = `22`
     - `PNPM_VERSION` = `10.28.0`
     - ⚠️ `NODE_ENV` **mat** daalna — usse build tools install nahi hote aur build fail hota hai.
     - (AdSense approve hone ke baad) `VITE_ADSENSE_CLIENT`, `VITE_ADSENSE_SLOT_BANNER`, `VITE_ADSENSE_SLOT_READER`
3. **Save and Deploy**. Jo `.pages.dev` link mile, wo Render ke `FRONTEND_URL` me daalo.
4. Custom domain (surituk.com) bhi yahin **Custom domains** se jod sakte ho.

## 9. Google AdSense
1. Site live + kuch asli content hone ke baad adsense.google.com pe apply karo.
2. Approve hone pe **Ads → By ad unit → Display ads** se 2–3 ad units banao, unke slot ID env me daalo.
3. `artifacts/manga-platform/public/ads.txt` file banao, andar likho:
   `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`
4. Ads kahan lage hain: Home, Browse, Manga page, aur **chapter ke end** me (pages ke beech nahi). Login/payment pages pe ads nahi hain — AdSense policy ke liye zaroori hai.
5. ⚠️ AdSense sirf **original / licensed** content pe approve hota hai. Kisi aur ki manga copy karke daaloge to account ban ho sakta hai.

---

## Paise ka flow (Store)
- Buyer PhonePe se pay karta hai → paisa **aapke** PhonePe merchant account me aata hai.
- Har sale pe book price ka **20% Surituk ka**, baaki **80% + poori shipping fee creator ki**.
- eBook ki kamai turant "available" ho jaati hai; print ki kamai creator ke "shipped" mark karne ke baad.
- Creator **Sales & Payouts** se withdraw request karta hai (min ₹500) → aap **Admin** page pe dekh ke uske UPI pe paisa bhejte ho → "Mark paid" + UPI ref daalte ho.
- Print books creator khud courier karta hai, aur tracking number daalta hai. Buyer ko notification jaata hai.

## Local pe chalana (testing)
```bash
pnpm install
cp .env.example .env    # sirf DATABASE_URL zaroori hai
pnpm --filter @workspace/db run push
pnpm --filter @workspace/scripts run seed
pnpm --filter @workspace/api-server run dev        # terminal 1
pnpm --filter @workspace/manga-platform run dev    # terminal 2 → http://localhost:5173
```
Local me bina SMTP/PhonePe ke bhi sab chalta hai: OTP code screen pe dikh jaata hai, aur payment ke liye "Test payment" page aata hai.
Demo logins: `reader@surituk.demo`, `creator@surituk.demo`.
