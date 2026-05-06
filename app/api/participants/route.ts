import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { name?: string; phone?: string; ref?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = (body.name ?? "").toString().trim();
  const phone = (body.phone ?? "").toString().replace(/\D+/g, "");
  const ref = body.ref ? body.ref.toString().trim() : null;

  if (name.length < 2 || phone.length < 10 || phone.length > 11) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase.rpc("register_participant", {
    p_name: name,
    p_phone: phone,
    p_ref_code: ref,
  });

  if (error) {
    console.error("register_participant error", error);
    return NextResponse.json({ error: "server", message: error.message }, { status: 500 });
  }

  // RPC retorna json; pode trazer error: 'duplicate' | 'locked'
  const payload = data as Record<string, unknown>;
  if (payload?.error) {
    return NextResponse.json(payload, { status: payload.error === "duplicate" ? 409 : 400 });
  }
  return NextResponse.json(payload);
}
