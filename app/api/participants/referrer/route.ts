import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = (url.searchParams.get("code") ?? "").trim();
  if (!code) return NextResponse.json({ name: null });

  const supabase = getServiceSupabase();
  const { data } = await supabase
    .from("participants")
    .select("name")
    .eq("referral_code", code)
    .maybeSingle();

  return NextResponse.json({ name: data?.name?.split(" ")[0] ?? null });
}
