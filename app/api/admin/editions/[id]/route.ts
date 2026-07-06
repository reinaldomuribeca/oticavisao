import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// PATCH { cadastros_encerrados: boolean } — encerra/reabre cadastros da edição
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { cadastros_encerrados?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (typeof body.cadastros_encerrados !== "boolean") {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase.rpc("set_registration_lock", {
    p_edition_id: params.id,
    p_locked: body.cadastros_encerrados,
  });
  if (error) {
    return NextResponse.json({ error: "server", message: error.message }, { status: 500 });
  }
  const payload = data as Record<string, unknown>;
  if (payload?.error) {
    return NextResponse.json(payload, { status: 404 });
  }
  return NextResponse.json(payload);
}
