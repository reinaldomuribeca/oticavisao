import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getServiceSupabase } from "@/lib/supabase";
import { resolveEditionId } from "@/lib/editions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase();
  const url = new URL(req.url);
  const editionId = await resolveEditionId(supabase, url.searchParams.get("edition"));

  if (!editionId) {
    return NextResponse.json({
      ok: true,
      stats: { participants: 0, numbers: 0, referrals: 0, top: null },
      edition: null,
    });
  }

  const [participantsCount, numbersCount, referralCount, top, edition] =
    await Promise.all([
      supabase
        .from("participants")
        .select("id", { count: "exact", head: true })
        .eq("edition_id", editionId),
      supabase
        .from("raffle_numbers")
        .select("id", { count: "exact", head: true })
        .eq("edition_id", editionId),
      supabase
        .from("participants")
        .select("id", { count: "exact", head: true })
        .eq("edition_id", editionId)
        .not("referred_by", "is", null),
      supabase
        .from("participants_with_stats")
        .select("id,name,phone,referral_count")
        .eq("edition_id", editionId)
        .order("referral_count", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("editions").select("*").eq("id", editionId).maybeSingle(),
    ]);

  return NextResponse.json({
    ok: true,
    stats: {
      participants: participantsCount.count ?? 0,
      numbers: numbersCount.count ?? 0,
      referrals: referralCount.count ?? 0,
      top: top.data ?? null,
    },
    edition: edition.data ?? null,
  });
}
