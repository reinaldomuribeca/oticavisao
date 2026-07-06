import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getServiceSupabase } from "@/lib/supabase";
import { resolveEditionId } from "@/lib/editions";

export const dynamic = "force-dynamic";

/**
 * POST (?edition=) — sorteia o PRÓXIMO ganhador da edição.
 * A seleção é feita no banco (order by random), excluindo quem já ganhou,
 * e gravada de forma atômica. O resultado já vem persistido.
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

  const { data, error } = await supabase.rpc("draw_next_winner", {
    p_edition_id: editionId,
  });
  if (error) {
    return NextResponse.json(
      { error: "server", message: error.message },
      { status: 500 },
    );
  }
  // A RPC retorna { error, message } para condições de negócio (completed/exhausted).
  if (data && (data as { error?: string }).error) {
    return NextResponse.json(data, { status: 409 });
  }

  return NextResponse.json(data);
}
