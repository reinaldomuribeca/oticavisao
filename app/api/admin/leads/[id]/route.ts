import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = params;
  const supabase = getServiceSupabase();

  const { data, error } = await supabase.rpc("delete_participant", { p_id: id });

  if (error) {
    return NextResponse.json({ error: "server", message: error.message }, { status: 500 });
  }

  if (data?.error) {
    const status = data.error === "not_found" ? 404 : 400;
    return NextResponse.json({ error: data.error, message: data.message }, { status });
  }

  return NextResponse.json({ ok: true });
}
