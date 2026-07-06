import type { SupabaseClient } from "@supabase/supabase-js";

export type Edition = {
  id: string;
  name: string;
  is_active: boolean;
  cadastros_encerrados: boolean;
  last_number: number;
  winner_number: number | null;
  drawn_at: string | null;
  raffle_date: string | null;
  total_draws: number;
  created_at: string;
  closed_at: string | null;
};

/** Retorna a edição ativa (ou null se não houver nenhuma). */
export async function getActiveEdition(
  supabase: SupabaseClient,
): Promise<Edition | null> {
  const { data } = await supabase
    .from("editions")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  return (data as Edition | null) ?? null;
}

/**
 * Resolve qual edição usar: se `param` for o id de uma edição existente, usa-o;
 * caso contrário cai para a edição ativa. Retorna o id ou null se não houver
 * nenhuma edição.
 */
export async function resolveEditionId(
  supabase: SupabaseClient,
  param: string | null,
): Promise<string | null> {
  if (param) {
    const { data } = await supabase
      .from("editions")
      .select("id")
      .eq("id", param)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }
  const active = await getActiveEdition(supabase);
  return active?.id ?? null;
}
