import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getServiceSupabase } from "@/lib/supabase";
import { resolveEditionId } from "@/lib/editions";

export const dynamic = "force-dynamic";

type WinnerRow = {
  position: number;
  number: number;
  drawn_at: string;
  participant: { name: string; phone: string } | null;
};

/**
 * GET — estado do sorteio da edição:
 *   pool de números, edição, lista de ganhadores (na ordem sorteada) e o
 *   total de sorteios configurado.
 */
export async function GET(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = getServiceSupabase();
  const editionId = await resolveEditionId(
    supabase,
    new URL(req.url).searchParams.get("edition"),
  );

  if (!editionId) {
    return NextResponse.json({
      ok: true,
      pool: [],
      edition: null,
      winners: [],
      totalDraws: 1,
    });
  }

  const [{ data: numbers }, { data: edition }, { data: winnerRows }] =
    await Promise.all([
      supabase
        .from("raffle_numbers")
        .select("number")
        .eq("edition_id", editionId)
        .order("number", { ascending: true }),
      supabase.from("editions").select("*").eq("id", editionId).maybeSingle(),
      supabase
        .from("raffle_winners")
        .select("position, number, drawn_at, participant:participants(name, phone)")
        .eq("edition_id", editionId)
        .order("position", { ascending: true }),
    ]);

  const winners = ((winnerRows ?? []) as unknown as WinnerRow[]).map((w) => ({
    position: w.position,
    number: w.number,
    name: w.participant?.name ?? "",
    phone: w.participant?.phone ?? "",
    drawn_at: w.drawn_at,
  }));

  return NextResponse.json({
    ok: true,
    pool: (numbers ?? []).map((n) => n.number),
    edition: edition ?? null,
    winners,
    totalDraws: edition?.total_draws ?? 1,
  });
}
