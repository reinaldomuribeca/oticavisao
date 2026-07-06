import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET — lista todas as edições (mais recente primeiro)
export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("editions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: "server", message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, editions: data ?? [] });
}

// POST { name } — cria nova edição (encerra a ativa atual)
export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const name = (body.name ?? "").toString().trim();
  if (name.length < 1) {
    return NextResponse.json({ error: "validation", message: "Nome obrigatório." }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase.rpc("create_edition", { p_name: name });
  if (error) {
    return NextResponse.json({ error: "server", message: error.message }, { status: 500 });
  }
  const payload = data as Record<string, unknown>;
  if (payload?.error) {
    return NextResponse.json(payload, { status: 400 });
  }
  return NextResponse.json(payload);
}
