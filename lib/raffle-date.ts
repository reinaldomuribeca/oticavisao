import { getServiceSupabase } from "@/lib/supabase";
import { getActiveEdition } from "@/lib/editions";

// Server-only: resolve o instante (ISO) do sorteio a partir da edição ativa.
// Usa o service role, então NÃO importe este módulo em componentes client.

export const FALLBACK_RAFFLE_DATE =
  process.env.NEXT_PUBLIC_RAFFLE_DATE ?? "2026-05-07T21:00:00-03:00";

/**
 * Data do sorteio da edição ativa; cai no fallback (env/default) se não houver
 * edição ativa, se ela não tiver data definida, ou em caso de erro no banco.
 */
export async function getRaffleDateISO(): Promise<string> {
  try {
    const active = await getActiveEdition(getServiceSupabase());
    return active?.raffle_date ?? FALLBACK_RAFFLE_DATE;
  } catch {
    return FALLBACK_RAFFLE_DATE;
  }
}
