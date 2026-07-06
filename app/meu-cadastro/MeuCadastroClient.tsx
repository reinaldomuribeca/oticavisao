"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyLinkButton, WhatsAppShareButton } from "@/components/ShareButton";
import {
  formatPhoneBR,
  formatRaffleDateShort,
  isValidPhoneBR,
  onlyDigits,
} from "@/lib/utils";
import { Loader2, PartyPopper, Search, Ticket } from "lucide-react";

type MePayload = {
  ok: true;
  raffle_date: string | null;
  participant: {
    id: string;
    name: string;
    phone: string;
    referral_code: string;
    referral_count: number;
    raffle_numbers: { number: number; origin: "cadastro" | "indicacao" }[];
    created_at: string;
  };
};

const baseUrl =
  (typeof window !== "undefined" ? window.location.origin : "") ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  "";

export function MeuCadastroClient() {
  const params = useSearchParams();
  const initialPhone = params.get("phone") ?? "";
  const welcome = params.get("welcome") === "1";
  const existed = params.get("existed") === "1";

  const [phone, setPhone] = useState(formatPhoneBR(initialPhone));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MePayload["participant"] | null>(null);
  const [raffleDate, setRaffleDate] = useState<string | null>(null);

  useEffect(() => {
    if (initialPhone && isValidPhoneBR(initialPhone)) {
      void lookup(initialPhone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lookup(rawPhone: string) {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/participants/me?phone=${encodeURIComponent(onlyDigits(rawPhone))}`,
      );
      if (r.status === 404) {
        setError("Telefone não encontrado. Confira o número ou faça seu cadastro.");
        setData(null);
      } else {
        const d = (await r.json()) as MePayload;
        setData(d.participant);
        setRaffleDate(d.raffle_date ?? null);
      }
    } catch {
      setError("Falha de conexão.");
    } finally {
      setLoading(false);
    }
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPhoneBR(phone)) {
      setError("Informe um WhatsApp válido com DDD.");
      return;
    }
    void lookup(phone);
  }

  if (!data) {
    return (
      <Card className="p-6 sm:p-10">
        <CardContent className="p-0">
          <h1 className="font-display text-3xl font-extrabold uppercase">
            Meu <span className="text-gold">cadastro</span>
          </h1>
          <p className="mt-2 text-zinc-400">
            Informe o WhatsApp que você usou no cadastro para acessar seus números.
          </p>
          <form onSubmit={onSearch} className="mt-8 space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="phone">WhatsApp</Label>
              <Input
                id="phone"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(formatPhoneBR(e.target.value))}
                required
              />
            </div>
            {error && (
              <p className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
                {error}
              </p>
            )}
            <Button type="submit" size="xl" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> BUSCANDO...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-5 w-5" /> ACESSAR MEU CADASTRO
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  const link = `${baseUrl}/cadastro?ref=${data.referral_code}`;
  const sortedNumbers = [...data.raffle_numbers].sort((a, b) => a.number - b.number);
  const fallbackDate =
    process.env.NEXT_PUBLIC_RAFFLE_DATE ?? "2026-05-07T21:00:00-03:00";
  const when = formatRaffleDateShort(raffleDate ?? fallbackDate);

  return (
    <div className="space-y-6">
      {welcome && (
        <Card className="border-emerald-500/30 bg-emerald-500/10 p-5">
          <div className="flex items-start gap-3">
            <PartyPopper className="mt-0.5 h-6 w-6 shrink-0 text-emerald-300" />
            <div>
              <p className="font-display text-lg font-bold text-emerald-200">
                Cadastro confirmado!
              </p>
              <p className="text-sm text-emerald-100/90">
                Seu primeiro número da sorte já foi gerado. Agora compartilhe seu
                link e ganhe +5 números a cada amigo cadastrado.
              </p>
            </div>
          </div>
        </Card>
      )}
      {existed && !welcome && (
        <Card className="border-gold/40 bg-gold/10 p-5">
          <p className="text-sm text-gold">
            Esse telefone já estava cadastrado — recuperamos seus dados abaixo.
          </p>
        </Card>
      )}

      {/* Card principal */}
      <Card className="overflow-hidden p-6 sm:p-10">
        <CardContent className="p-0">
          <p className="text-xs uppercase tracking-widest text-zinc-500">Olá,</p>
          <h1 className="font-display text-3xl font-extrabold uppercase leading-tight sm:text-4xl">
            {data.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">{formatPhoneBR(data.phone)}</p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/15 via-gold/5 to-transparent p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-gold/80">
                Você tem
              </p>
              <p className="mt-1 font-display text-5xl font-black text-shine-gold">
                {sortedNumbers.length}
              </p>
              <p className="text-sm text-zinc-300">
                {sortedNumbers.length === 1 ? "número" : "números"} no sorteio
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-ink-900/60 p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Indicações realizadas
              </p>
              <p className="mt-1 font-display text-5xl font-black text-zinc-100">
                {data.referral_count}
              </p>
              <p className="text-sm text-zinc-400">
                +{data.referral_count * 5} números bônus já creditados
              </p>
            </div>
          </div>

          <div className="mt-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Seus números
            </p>
            <div className="flex flex-wrap gap-2">
              {sortedNumbers.map((n) => (
                <Badge
                  key={n.number}
                  variant={n.origin === "cadastro" ? "default" : "outline"}
                  className="px-3 py-1.5 font-mono text-sm tabular-nums"
                  title={n.origin === "cadastro" ? "Cadastro" : "Indicação"}
                >
                  <Ticket className="mr-1.5 h-3 w-3" />#
                  {n.number.toString().padStart(3, "0")}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Indicação */}
      <Card className="p-6 sm:p-10">
        <CardContent className="space-y-4 p-0">
          <div>
            <Badge variant="outline" className="mb-2">+5 NÚMEROS POR AMIGO</Badge>
            <h2 className="font-display text-2xl font-extrabold uppercase">
              Compartilhe seu <span className="text-gold">link</span>
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Cada pessoa que se cadastrar pelo seu link te dá +5 números.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-ink-900/80 p-3">
            <p className="break-all text-sm font-mono text-zinc-200">{link}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <CopyLinkButton link={link} />
            <WhatsAppShareButton link={link} whenText={when} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-500/30 bg-red-500/5 p-5">
        <p className="text-center text-sm font-semibold uppercase tracking-wider text-red-200">
          ⚠️ Esteja na live no dia {when} para concorrer!
        </p>
      </Card>
    </div>
  );
}
