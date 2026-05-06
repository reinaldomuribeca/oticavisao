"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export function ReferralBanner() {
  const params = useSearchParams();
  const ref = params.get("ref");
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ref) return;
    setLoading(true);
    fetch(`/api/participants/referrer?code=${encodeURIComponent(ref)}`)
      .then((r) => r.json())
      .then((d) => setName(d?.name ?? null))
      .finally(() => setLoading(false));
  }, [ref]);

  if (!ref) return null;

  return (
    <Card className="mb-6 border-gold/40 bg-gradient-to-br from-gold/15 via-gold/5 to-transparent p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold text-ink-950">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <p className="font-display text-lg font-bold text-gold">
            {loading
              ? "Carregando convite..."
              : name
                ? `Você foi convidado por ${name}!`
                : "Você foi convidado!"}
          </p>
          <p className="text-sm text-zinc-300">
            Faça seu cadastro e os dois ganham — você entra no sorteio e seu
            amigo recebe +5 números bônus.
          </p>
        </div>
      </div>
    </Card>
  );
}
