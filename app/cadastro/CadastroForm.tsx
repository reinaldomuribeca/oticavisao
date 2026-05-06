"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPhoneBR, isValidPhoneBR, onlyDigits } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export function CadastroForm() {
  const router = useRouter();
  const params = useSearchParams();
  const ref = params.get("ref") ?? "";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError("Informe seu nome completo.");
      return;
    }
    if (!isValidPhoneBR(phone)) {
      setError("Informe um WhatsApp válido com DDD.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: onlyDigits(phone),
          ref: ref || null,
        }),
      });
      const data = await res.json();

      if (data.error === "duplicate") {
        // Telefone já cadastrado — manda direto pra área dele
        router.push(`/meu-cadastro?phone=${onlyDigits(phone)}&existed=1`);
        return;
      }
      if (!res.ok || data.error) {
        setError(data.message ?? "Erro ao cadastrar. Tente novamente.");
        setSubmitting(false);
        return;
      }
      router.push(`/meu-cadastro?phone=${onlyDigits(phone)}&welcome=1`);
    } catch {
      setError("Falha de conexão. Tente novamente.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="name">Nome completo</Label>
        <Input
          id="name"
          autoComplete="name"
          placeholder="Seu nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          required
        />
      </div>

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
        <p className="text-xs text-zinc-500">
          Usaremos pra entrar em contato caso você seja o vencedor.
        </p>
      </div>

      {error && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <Button type="submit" size="xl" className="w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> ENVIANDO...
          </>
        ) : (
          "GARANTIR MEU NÚMERO"
        )}
      </Button>

      <p className="text-center text-xs text-zinc-500">
        Ao se cadastrar, você concorda com o regulamento do sorteio e autoriza o
        contato em caso de premiação.
      </p>
    </form>
  );
}
