import { cookies } from "next/headers";

const COOKIE_NAME = "ov_admin";
const SECRET = process.env.ADMIN_PASSWORD ?? "";

// Edge runtime (middleware) não tem node:crypto; usamos Web Crypto.
const enc = new TextEncoder();

async function hmacHex(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Comparação em tempo constante (sem dependência de node:crypto).
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Gera o valor do cookie a partir de um timestamp + assinatura HMAC. */
export async function makeAdminToken(): Promise<string> {
  const ts = Date.now().toString();
  const sig = await hmacHex(ts);
  return `${ts}.${sig}`;
}

export async function verifyAdminToken(token: string | undefined): Promise<boolean> {
  if (!token || !SECRET) return false;
  const [ts, sig] = token.split(".");
  if (!ts || !sig) return false;
  const expected = await hmacHex(ts);
  return timingSafeEqualHex(expected, sig);
}

export async function isAdminAuthed(): Promise<boolean> {
  const c = cookies().get(COOKIE_NAME)?.value;
  return verifyAdminToken(c);
}

export const ADMIN_COOKIE = COOKIE_NAME;
