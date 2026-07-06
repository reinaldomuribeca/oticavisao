import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getActiveEdition } from "@/lib/editions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const phone = (url.searchParams.get("phone") ?? "").replace(/\D+/g, "");
  if (phone.length < 10 || phone.length > 11) {
    return NextResponse.json({ error: "validation" }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const activeEdition = await getActiveEdition(supabase);
  if (!activeEdition) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: participant, error } = await supabase
    .from("participants")
    .select("id, name, phone, referral_code, created_at")
    .eq("edition_id", activeEdition.id)
    .eq("phone", phone)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "server", message: error.message }, { status: 500 });
  }
  if (!participant) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Carrega números (com origem) e contagem de indicações
  const [{ data: numbers }, { count: referralCount }] = await Promise.all([
    supabase
      .from("raffle_numbers")
      .select("number, origin")
      .eq("participant_id", participant.id)
      .order("number", { ascending: true }),
    supabase
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", participant.id),
  ]);

  return NextResponse.json({
    ok: true,
    raffle_date: activeEdition.raffle_date,
    participant: {
      ...participant,
      raffle_numbers: numbers ?? [],
      referral_count: referralCount ?? 0,
    },
  });
}
