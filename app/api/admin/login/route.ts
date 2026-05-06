import { NextResponse } from "next/server";
import { ADMIN_COOKIE, makeAdminToken } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!expected) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if ((body.password ?? "") !== expected) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, makeAdminToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // 12h
  });
  return res;
}
