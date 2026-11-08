import type { Request, Response } from "express";

/**
 * Keeps throwaway / fake accounts from liking, replying, voting and rating:
 *  - must be logged in with a verified email (email OTP or Google)
 *  - must have finished the welcome setup (name, genres, age check)
 *  - must not be blocked by an admin
 * Sign-up itself is limited per network (see auth.ts) and disposable email services are refused.
 */
export function requireTrusted(req: Request, res: Response): boolean {
  const u = req.user as (Request["user"] & { onboarded?: boolean; blocked?: boolean; email?: string | null }) | undefined;
  if (!u) { res.status(401).json({ error: "Please log in first" }); return false; }
  if (u.blocked) { res.status(403).json({ error: "Your account can't interact in the community. Contact support if this is a mistake." }); return false; }
  if (!u.email) { res.status(403).json({ error: "Please log in with a verified email first" }); return false; }
  if (!u.onboarded && u.role !== "admin" && !u.creatorId) { res.status(403).json({ error: "Finish setting up your profile first", needsOnboarding: true }); return false; }
  return true;
}

/** Common throwaway-email services. Accounts from these can't sign up. */
export const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.info", "guerrillamailblock.com", "sharklasers.com", "grr.la",
  "10minutemail.com", "10minutemail.net", "temp-mail.org", "tempmail.com", "tempmail.net", "tempmailo.com", "temp-mail.io",
  "throwawaymail.com", "yopmail.com", "yopmail.net", "getnada.com", "nada.email", "dispostable.com", "maildrop.cc",
  "mintemail.com", "mohmal.com", "trashmail.com", "trashmail.de", "fakeinbox.com", "emailondeck.com", "tempinbox.com",
  "mailnesia.com", "mytemp.email", "spamgourmet.com", "burnermail.io", "inboxkitten.com", "tempr.email", "discard.email",
  "mail.tm", "mailpoof.com", "moakt.com", "emailfake.com", "fakemail.net", "luxusmail.org", "1secmail.com", "1secmail.net",
  "1secmail.org", "byom.de", "spambox.us", "trbvm.com", "cool.fr.nf", "jetable.org", "mail-temp.com", "tmpmail.org", "tmpmail.net",
  "minuteinbox.com", "emltmp.com", "tmail.ws", "linshiyouxiang.net", "zetmail.com", "dropmail.me", "10mail.org", "fexpost.com",
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return DISPOSABLE_DOMAINS.has(domain) || [...DISPOSABLE_DOMAINS].some(d => domain.endsWith(`.${d}`));
}
