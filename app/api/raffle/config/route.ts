import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getServiceSupabase } from "@/lib/supabase";
import { resolveEditionId } from "@/lib/editions";

export const dynamic = "force-dynamic";

const MAX_DRAWS = 100;

/**
 * POST { total_draws } (?edition=) — define quantos sorteios (prêmios) a
 * edição terá. Não pode ser menor que o número de ganhadores já sorteados.
 */
export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { total_draws?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const total = Math.trunc(Number(body.total_draws));
  if (!Number.isFinite(total) || total < 1 || total > MAX_DRAWS) {
    return NextResponse.json({ error: "invalid_total" }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const editionId = await resolveEditionId(
    supabase,
    new URL(req.url).searchParams.get("edition"),
  );
  if (!editionId) {
    return NextResponse.json({ error: "no_edition" }, { status: 400 });
  }

  // Não deixa configurar menos sorteios do que já foram realizados.
  const { count } = await supabase
    .from("raffle_winners")
    .select("id", { count: "exact", head: true })
    .eq("edition_id", editionId);
  const drawn = count ?? 0;
  if (total < drawn) {
    return NextResponse.json(
      {
        error: "below_drawn",
        message: `Já foram sorteados ${drawn} ganhadores. Zere os ganhadores antes de reduzir.`,
      },
      { status: 409 },
    );
  }

  const { error } = await supabase
    .from("editions")
    .update({ total_draws: total })
    .eq("id", editionId);
  if (error) {
    return NextResponse.json(
      { error: "server", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, total_draws: total });
}
