import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Cliente público (browser ou SSR sem privilégios). */
export function getBrowserSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error("Supabase env vars não configuradas (URL/ANON_KEY).");
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false },
  });
}

/** Cliente server-side com service role. NUNCA expor ao browser. */
export function getServiceSupabase(): SupabaseClient {
  if (!url || !serviceKey) {
    throw new Error("Supabase env vars não configuradas (URL/SERVICE_ROLE_KEY).");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

export type Participant = {
  id: string;
  name: string;
  phone: string;
  raffle_numbers: number[];
  referral_code: string;
  referred_by: string | null;
  created_at: string;
};

export type RaffleNumber = {
  id: string;
  participant_id: string;
  number: number;
  origin: "cadastro" | "indicacao";
  created_at: string;
};

export type RaffleConfig = {
  id: string;
  winner_number: number | null;
  drawn_at: string | null;
  is_locked: boolean;
};
