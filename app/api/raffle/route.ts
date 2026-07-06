import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getServiceSupabase } from "@/lib/supabase";
import { resolveEditionId } from "@/lib/editions";

export const dynamic = "force-dynamic";

/**
 * GET — info do sorteio da edição (pool de números, vencedor salvo, edição).
 */
export async function GET(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = getServiceSupabase();
  const editionId = await resolveEditionId(supabase, new URL(req.url).searchParams.get("edition"));

  if (!editionId) {
    return NextResponse.json({ ok: true, pool: [], winner: null, edition: null });
  }

  const [{ data: numbers }, { data: edition }] = await Promise.all([
    supabase
      .from("raffle_numbers")
      .select("number")
      .eq("edition_id", editionId)
      .order("number", { ascending: true }),
    supabase.from("editions").select("*").eq("id", editionId).maybeSingle(),
  ]);

  let winner: { number: number; name: string; phone: string } | null = null;
  if (edition?.winner_number != null) {
    const { data: rn } = await supabase
      .from("raffle_numbers")
      .select("participant_id")
      .eq("edition_id", editionId)
      .eq("number", edition.winner_number)
      .maybeSingle();
    if (rn?.participant_id) {
      const { data: p } = await supabase
        .from("participants")
        .select("name,phone")
        .eq("id", rn.participant_id)
        .maybeSingle();
      if (p) winner = { number: edition.winner_number, name: p.name, phone: p.phone };
    }
  }

  return NextResponse.json({
    ok: true,
    pool: (numbers ?? []).map((n) => n.number),
    winner,
    edition: edition ?? null,
  });
}

/**
 * POST { number } (?edition=) — persiste o vencedor na edição.
 */
export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { number?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const number = Number(body.number);
  if (!Number.isFinite(number) || number <= 0) {
    return NextResponse.json({ error: "invalid_number" }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const editionId = await resolveEditionId(supabase, new URL(req.url).searchParams.get("edition"));
  if (!editionId) {
    return NextResponse.json({ error: "no_edition" }, { status: 400 });
  }

  const { data: rn } = await supabase
    .from("raffle_numbers")
    .select("participant_id")
    .eq("edition_id", editionId)
    .eq("number", number)
    .maybeSingle();
  if (!rn) {
    return NextResponse.json({ error: "number_not_in_pool" }, { status: 400 });
  }

  const { error } = await supabase.rpc("save_winner", {
    p_edition_id: editionId,
    p_winner: number,
  });
  if (error) {
    return NextResponse.json({ error: "server", message: error.message }, { status: 500 });
  }

  const { data: p } = await supabase
    .from("participants")
    .select("name,phone")
    .eq("id", rn.participant_id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    winner: { number, name: p?.name ?? "", phone: p?.phone ?? "" },
  });
}
