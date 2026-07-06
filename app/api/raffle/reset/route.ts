import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getServiceSupabase } from "@/lib/supabase";
import { resolveEditionId } from "@/lib/editions";

export const dynamic = "force-dynamic";

/**
 * POST (?edition=) — zera os ganhadores da edição (para testes).
 */
export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  const editionId = await resolveEditionId(
    supabase,
    new URL(req.url).searchParams.get("edition"),
  );
  if (!editionId) {
    return NextResponse.json({ error: "no_edition" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("reset_winners", {
    p_edition_id: editionId,
  });
  if (error) {
    return NextResponse.json(
      { error: "server", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}
