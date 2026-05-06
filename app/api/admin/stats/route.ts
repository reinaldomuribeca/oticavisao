import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  const [participantsCount, numbersCount, referralCount, top, config] =
    await Promise.all([
      supabase.from("participants").select("id", { count: "exact", head: true }),
      supabase.from("raffle_numbers").select("id", { count: "exact", head: true }),
      supabase
        .from("participants")
        .select("id", { count: "exact", head: true })
        .not("referred_by", "is", null),
      supabase
        .from("participants_with_stats")
        .select("id,name,phone,referral_count")
        .order("referral_count", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("raffle_config").select("*").maybeSingle(),
    ]);

  return NextResponse.json({
    ok: true,
    stats: {
      participants: participantsCount.count ?? 0,
      numbers: numbersCount.count ?? 0,
      referrals: referralCount.count ?? 0,
      top: top.data ?? null,
    },
    config: config.data ?? null,
  });
}
