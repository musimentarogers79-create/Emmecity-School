import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SchoolUser } from "./school-data";

export const SUPPORT_COOKIE_NAME = "schoolops_support_session";
export const SUPPORT_USER_IDENTIFIER = "__corenexa_support_identity__";
export const SUPPORT_SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
export const SUPPORT_USER_NAME = "Corenexa Support";

export function supportUserIdForSchool(schoolId: string): string {
  const bytes = createHash("sha256").update(`corenexa-support-user-v1:${schoolId}`).digest().subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function createSupportSession() {
  const sessionSecret = process.env["SESSION_SECRET"];
  if (!sessionSecret) throw new Error("Support session signing is not configured.");
  const expiresAtMs = Date.now() + SUPPORT_SESSION_DURATION_MS;
  const payload = `${expiresAtMs}.${randomBytes(32).toString("hex")}`;
  const signature = createHmac("sha256", sessionSecret).update(payload).digest("hex");
  return { token: `${payload}.${signature}`, expiresAt: new Date(expiresAtMs).toISOString() };
}

export function isValidSupportSession(token: string | undefined) {
  const sessionSecret = process.env["SESSION_SECRET"];
  if (!sessionSecret || !process.env["SCHOOL_SUPPORT_PASSWORD"] || !token) return false;
  const [expiresAt, nonce, signature, extra] = token.split(".");
  if (extra !== undefined || !expiresAt || !nonce || !signature || !/^\d+$/u.test(expiresAt) || !/^[a-f0-9]{64}$/u.test(nonce) || !/^[a-f0-9]{64}$/u.test(signature) || Number(expiresAt) <= Date.now()) return false;
  const expected = createHmac("sha256", sessionSecret).update(`${expiresAt}.${nonce}`).digest();
  const actual = Buffer.from(signature, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function supportSessionExpiry(token: string): string {
  return new Date(Number(token.split(".")[0])).toISOString();
}

export function isSupportUser(user: Pick<SchoolUser, "identifier">) {
  return user.identifier.toLowerCase() === SUPPORT_USER_IDENTIFIER;
}