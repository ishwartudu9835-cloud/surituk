import app from "./app";
import { logger } from "./lib/logger";
import { ensureDefaultGenres, runMigrations } from "./lib/bootstrap";
import { backfillSlugs } from "./lib/slug";

const rawPort = process.env["PORT"] ?? "8080";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  void runMigrations().then(ensureDefaultGenres).then(backfillSlugs).catch((e) => console.error("startup tasks failed", e));
});
