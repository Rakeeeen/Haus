/**
 * The SHA-256 of a text, as hex — or null where the browser can't make one. Used to recognise a person by their email without keeping the
 * email itself in the page's code (which anyone can read): the code holds the hash, and the viewer's own email is hashed to compare.
 */
export async function sha256Hex(text: string): Promise<string | null> {
  try {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

/** The hash of an email as a person would type it: trimmed, and with its capitals made small. */
export const emailHash = (email: string | null | undefined): Promise<string | null> =>
  email ? sha256Hex(email.trim().toLowerCase()) : Promise.resolve(null);
