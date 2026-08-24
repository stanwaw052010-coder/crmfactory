import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db/prisma";

/**
 * Сесії.
 *
 * У cookie лежить підписаний JWT (HS256, httpOnly, sameSite=lax).
 * Але сам JWT — не остання інстанція: у ньому тільки id сесії та її секрет,
 * а живість перевіряється в БД. Так logout і «вийти з усіх пристроїв»
 * працюють миттєво, а вкрадений токен можна відкликати.
 */

const COOKIE_NAME = "crmf_session";
const SESSION_DAYS = 30;

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET не налаштовано або закороткий (потрібно ≥32 символів). Див. .env.example",
    );
  }
  return new TextEncoder().encode(secret);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  userId: string,
  meta?: { userAgent?: string | null; ip?: string | null },
) {
  const rawToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt,
      userAgent: meta?.userAgent?.slice(0, 255) ?? null,
      ip: meta?.ip ?? null,
    },
  });

  const jwt = await new SignJWT({ sid: session.id, tok: rawToken })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("crm.factory")
    .setExpirationTime(expiresAt)
    .sign(secretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return session;
}

/** Повертає userId, якщо cookie валідна і сесія жива. */
export async function readSession(): Promise<{ userId: string; sessionId: string } | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;

  try {
    const { payload } = await jwtVerify(raw, secretKey(), { issuer: "crm.factory" });
    const sid = payload.sid as string | undefined;
    const tok = payload.tok as string | undefined;
    if (!sid || !tok) return null;

    const session = await prisma.session.findUnique({ where: { id: sid } });
    if (!session) return null;
    if (session.tokenHash !== hashToken(tok)) return null;
    if (session.expiresAt.getTime() < Date.now()) {
      await prisma.session.delete({ where: { id: sid } }).catch(() => {});
      return null;
    }
    return { userId: session.userId, sessionId: session.id };
  } catch {
    return null;
  }
}

export async function destroySession() {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  store.delete(COOKIE_NAME);
  if (!raw) return;
  try {
    const { payload } = await jwtVerify(raw, secretKey(), { issuer: "crm.factory" });
    const sid = payload.sid as string | undefined;
    if (sid) await prisma.session.delete({ where: { id: sid } }).catch(() => {});
  } catch {
    /* cookie зіпсована — вона вже видалена, більше робити нічого */
  }
}

/** Активна організація зберігається в окремій cookie (перемикач workspace). */
const ORG_COOKIE = "crmf_org";

export async function setActiveOrganization(organizationId: string) {
  const store = await cookies();
  store.set(ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function readActiveOrganization(): Promise<string | null> {
  const store = await cookies();
  return store.get(ORG_COOKIE)?.value ?? null;
}

export async function clearActiveOrganization() {
  const store = await cookies();
  store.delete(ORG_COOKIE);
}
