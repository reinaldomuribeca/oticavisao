import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { getActiveEdition } from "@/lib/editions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = (url.searchParams.get("code") ?? "").trim();
  if (!code) return NextResponse.json({ name: null });

  const supabase = getServiceSupabase();
  const activeEdition = await getActiveEdition(supabase);
  if (!activeEdition) return NextResponse.json({ name: null });

  const { data } = await supabase
    .from("participants")
    .select("name")
    .eq("edition_id", activeEdition.id)
    .eq("referral_code", code)
    .maybeSingle();

  return NextResponse.json({ name: data?.name?.split(" ")[0] ?? null });
}
