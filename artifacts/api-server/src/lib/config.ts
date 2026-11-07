/** Central place for environment configuration. */
const env = process.env;

export const isProd = env.NODE_ENV === "production";

/** Features switched off for now (code kept for a later phase). Turn on with env = "true". */
export const features = {
  store: env.STORE_ENABLED === "true",
  contests: env.CONTESTS_ENABLED === "true",
};

export const config = {
  /** Public URL of the website (used for payment redirects and links in emails). */
  frontendUrl: (env.FRONTEND_URL ?? "http://localhost:5173").replace(/\/+$/, ""),
  /** Public URL of this API (used for locally stored file URLs). */
  apiUrl: (env.API_PUBLIC_URL ?? "").replace(/\/+$/, ""),
  sessionSecret: env.SESSION_SECRET ?? (isProd ? "" : "dev-secret-change-me"),
  googleClientId: env.GOOGLE_CLIENT_ID ?? "",
  adminEmails: (env.ADMIN_EMAILS ?? "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean),

  /** Surituk's cut of every store sale, in percent. */
  commissionPercent: Number(env.COMMISSION_PERCENT ?? 20),
  minPayoutPaise: Number(env.MIN_PAYOUT_RUPEES ?? 500) * 100,

  /** Brevo HTTP email API (works on hosts that block SMTP ports, e.g. Render free). */
  brevoApiKey: env.BREVO_API_KEY ?? "",
  mailFromEmail: env.MAIL_FROM_EMAIL ?? env.SMTP_USER ?? "",
  mailFromName: env.MAIL_FROM_NAME ?? "Surituk",

  smtp: {
    host: env.SMTP_HOST ?? "",
    port: Number(env.SMTP_PORT ?? 465),
    user: env.SMTP_USER ?? "",
    pass: env.SMTP_PASS ?? "",
    from: env.MAIL_FROM ?? (env.SMTP_USER ? `Surituk <${env.SMTP_USER}>` : "Surituk <no-reply@surituk.com>"),
  },

  /** Any S3-compatible storage (Cloudflare R2, Neon storage, AWS S3…). AWS_* names also accepted. */
  s3: {
    endpoint: env.S3_ENDPOINT || env.AWS_ENDPOINT_URL_S3 || "",
    region: env.S3_REGION || env.AWS_REGION || "auto",
    accessKeyId: env.S3_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: env.S3_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY || "",
    publicBucket: env.S3_PUBLIC_BUCKET || env.S3_BUCKET || "",
    /** Optional. If empty, images are served through this API at /api/files/... */
    publicBaseUrl: (env.S3_PUBLIC_URL ?? "").replace(/\/+$/, ""),
    privateBucket: env.S3_PRIVATE_BUCKET || env.S3_PUBLIC_BUCKET || env.S3_BUCKET || "",
  },
  uploadDir: env.UPLOAD_DIR ?? "./uploads",

  phonepe: {
    clientId: env.PHONEPE_CLIENT_ID ?? "",
    clientSecret: env.PHONEPE_CLIENT_SECRET ?? "",
    clientVersion: env.PHONEPE_CLIENT_VERSION ?? "1",
    env: (env.PHONEPE_ENV ?? "sandbox") as "sandbox" | "production",
    webhookUser: env.PHONEPE_WEBHOOK_USER ?? "",
    webhookPass: env.PHONEPE_WEBHOOK_PASS ?? "",
  },
};

if (isProd && !config.sessionSecret) {
  throw new Error("SESSION_SECRET must be set in production");
}

export const phonepeEnabled = Boolean(config.phonepe.clientId && config.phonepe.clientSecret);
/** Fake payment page for local testing only. Never available in production. */
export const mockPaymentsEnabled = !phonepeEnabled && !isProd;
export const s3Enabled = Boolean(config.s3.endpoint && config.s3.accessKeyId && config.s3.publicBucket);
