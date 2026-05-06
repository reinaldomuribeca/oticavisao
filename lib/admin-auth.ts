import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE_NAME = "ov_admin";
const SECRET = process.env.ADMIN_PASSWORD ?? "";

function hmac(value: string): string {
  return crypto.createHmac("sha256", SECRET).update(value).digest("hex");
}

/** Gera o valor do cookie a partir de um timestamp + assinatura HMAC. */
export function makeAdminToken(): string {
  const ts = Date.now().toString();
  return `${ts}.${hmac(ts)}`;
}

export function verifyAdminToken(token: string | undefined): boolean {
  if (!token || !SECRET) return false;
  const [ts, sig] = token.split(".");
  if (!ts || !sig) return false;
  const expected = hmac(ts);
  // Comparação em tempo constante
  if (expected.length !== sig.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

export function isAdminAuthed(): boolean {
  const c = cookies().get(COOKIE_NAME)?.value;
  return verifyAdminToken(c);
}

export const ADMIN_COOKIE = COOKIE_NAME;
