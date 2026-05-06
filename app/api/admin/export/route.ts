import { isAdminAuthed } from "@/lib/admin-auth";
import { getServiceSupabase } from "@/lib/supabase";
import { toCSV } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAdminAuthed()) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("participants_with_stats")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return new Response(`Erro: ${error.message}`, { status: 500 });
  }

  const rows = (data ?? []).map((p) => ({
    nome: p.name,
    whatsapp: p.phone,
    numeros: ((p.raffle_numbers as number[]) ?? []).join(" "),
    qtd_numeros: ((p.raffle_numbers as number[]) ?? []).length,
    indicacoes: p.referral_count,
    indicado_por: p.referrer_name ?? "",
    codigo_indicacao: p.referral_code,
    cadastrado_em: p.created_at,
  }));

  const csv = toCSV(rows, [
    "nome",
    "whatsapp",
    "numeros",
    "qtd_numeros",
    "indicacoes",
    "indicado_por",
    "codigo_indicacao",
    "cadastrado_em",
  ]);

  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-otica-visao-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
