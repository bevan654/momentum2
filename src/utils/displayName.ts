/**
 * Privacy-safe display helpers for usernames + emails.
 *
 * The app stores both `username` (chosen, public) and `email` (private). Anywhere
 * we render a name visible to *other users* — search results, feed posts, comments,
 * leaderboards — we should never show the raw email, since the email is treated
 * as private account data.
 */

/** A privacy-safe name to show to other users. Username if present; otherwise masked email. */
export function safeDisplayName(username: string | null | undefined, email: string | null | undefined): string {
  if (username && username.trim().length > 0) return username;
  return maskEmail(email);
}

/**
 * Masks an email so it's not directly readable by anyone who can see it.
 * `bevan.shajan@flinders.edu.au` → `b****`
 *
 * We deliberately drop the `@domain` part: revealing the institution / provider
 * is itself a privacy leak (e.g. flinders.edu.au identifies a specific university).
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return 'User';
  const local = email.split('@')[0];
  if (!local) return 'User';
  const first = local.charAt(0);
  return `${first}${'*'.repeat(4)}`;
}
