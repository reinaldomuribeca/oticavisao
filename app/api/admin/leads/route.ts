import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const ALLOWED_SORT = new Set(["created_at", "name", "phone", "referral_count"]);
const PAGE_SIZE = 20;

export async function GET(req: Request) {
  if (!isAdminAuthed()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const search = (url.searchParams.get("q") ?? "").trim();
  const sort = url.searchParams.get("sort") ?? "created_at";
  const dir = (url.searchParams.get("dir") ?? "desc") === "asc" ? "asc" : "desc";

  const supabase = getServiceSupabase();
  const sortField = ALLOWED_SORT.has(sort) ? sort : "created_at";

  let query = supabase
    .from("participants_with_stats")
    .select("*", { count: "exact" });

  if (search) {
    const digits = search.replace(/\D+/g, "");
    if (digits.length >= 3) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${digits}%`);
    } else {
      query = query.ilike("name", `%${search}%`);
    }
  }

  query = query
    .order(sortField, { ascending: dir === "asc" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ error: "server", message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    leads: data ?? [],
    page,
    pageSize: PAGE_SIZE,
    total: count ?? 0,
  });
}
