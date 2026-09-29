// Auth helpers: password hashing + cookie-based session tokens.
// We keep it lightweight (JWT in an httpOnly cookie). No external auth lib needed.

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { db } from "./db";

const COOKIE_NAME = "sdp_session";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SECRET = process.env.AUTH_SECRET || "dev-secret-change-me";

// Hash a plain password before saving it to the DB.
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Check a plain password against the stored hash.
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Create a signed token for a user id and store it in an httpOnly cookie.
export async function createSession(userId: string): Promise<void> {
  const token = jwt.sign({ sub: userId }, SECRET, {
    expiresIn: TOKEN_TTL_SECONDS,
  });
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true, // never readable by JavaScript in the browser
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TOKEN_TTL_SECONDS,
  });
}

// Clear the session cookie (logout).
export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

// Read the current user from the cookie. Returns null if not logged in.
export async function getCurrentUser() {
  try {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const payload = jwt.verify(token, SECRET) as { sub: string };
    if (!payload?.sub) return null;
    const user = await db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true },
    });
    return user;
  } catch {
    return null;
  }
}
