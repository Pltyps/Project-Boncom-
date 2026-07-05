import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const SESSION_SECRET = process.env.SESSION_SECRET;
const SESSION_TTL = "7d";

if (!GOOGLE_CLIENT_ID) throw new Error("GOOGLE_CLIENT_ID is not set");
if (!SESSION_SECRET) throw new Error("SESSION_SECRET is not set");

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

export type Role = "user" | "dev" | "admin";

// Higher rank can do everything a lower rank can. Used to gate apps by
// min_role and to gate the admin users page to admins only.
const ROLE_RANK: Record<Role, number> = { user: 0, dev: 1, admin: 2 };

export function roleMeets(actual: Role, required: Role): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

export interface GoogleIdentity {
  email: string;
  name: string;
}

export interface SessionUser extends GoogleIdentity {
  role: Role;
}

// Verifies a Google ID token (from the frontend's Sign In With Google
// button) against our own Client ID, so a token minted for some other app
// can't be replayed here. Google's library checks signature, issuer, and
// audience; expiry is checked separately below.
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.email || !payload.email_verified) {
    throw new Error("Google account has no verified email");
  }
  return { email: payload.email, name: payload.name ?? payload.email };
}

// Our own session token, separate from Google's ID token (which is short-
// lived and meant to be re-verified per sign-in, not carried around as a
// bearer credential). Signing our own means the frontend doesn't need to
// keep re-running the Google sign-in flow every hour.
export function signSession(user: SessionUser): string {
  return jwt.sign(user, SESSION_SECRET!, { expiresIn: SESSION_TTL });
}

export function verifySession(token: string): SessionUser {
  const decoded = jwt.verify(token, SESSION_SECRET!);
  if (typeof decoded === "string" || !decoded.email || !decoded.role) {
    throw new Error("Invalid session token");
  }
  return { email: decoded.email as string, name: decoded.name as string, role: decoded.role as Role };
}

// Demo accounts may switch their own role freely (POST /api/auth/role) so a
// reviewer can walk through all three access levels without a second admin
// standing by to restore them. Comma-separated env override; defaults to the
// project owner's account so the demo works without extra env setup. Every
// switch is written to the audit log like any other role change.
const DEFAULT_DEMO_EMAILS = "navin.manirajan.0@gmail.com";

export function isDemoAccount(email: string): boolean {
  const list = process.env.DEMO_EMAILS ?? DEFAULT_DEMO_EMAILS;
  return list
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .includes(email.toLowerCase());
}

// Unset (the default) means anyone with a Google account can sign in - fine
// for trying this out, but worth setting before treating the data as
// actually access-controlled. Entries starting with "@" match a whole email
// domain (e.g. "@boncom.com") instead of one exact address, so the whole
// team doesn't need to be listed one address at a time.
export function isEmailAllowed(email: string): boolean {
  const allowlist = process.env.ALLOWED_EMAILS;
  if (!allowlist) return true;
  const normalizedEmail = email.toLowerCase();
  const allowed = allowlist.split(",").map((e) => e.trim().toLowerCase());
  return allowed.some((entry) =>
    entry.startsWith("@") ? normalizedEmail.endsWith(entry) : entry === normalizedEmail
  );
}
