import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getServiceSupabase } from "@/lib/supabase";
import { resolveEditionId } from "@/lib/editions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const number = Number(url.searchParams.get("number"));
  if (!Number.isFinite(number) || number <= 0) {
    return NextResponse.json({ error: "invalid_number" }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const editionId = await resolveEditionId(supabase, url.searchParams.get("edition"));
  if (!editionId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: rn } = await supabase
    .from("raffle_numbers")
    .select("participant_id")
    .eq("edition_id", editionId)
    .eq("number", number)
    .maybeSingle();
  if (!rn) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: p } = await supabase
    .from("participants")
    .select("name,phone")
    .eq("id", rn.participant_id)
    .maybeSingle();
  if (!p) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ name: p.name, phone: p.phone });
}
