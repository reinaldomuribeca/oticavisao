import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Sparkles, Instagram, AlertTriangle } from "lucide-react";
import { CadastroForm } from "./CadastroForm";
import { ReferralBanner } from "./ReferralBanner";

export default function CadastroPage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-radial-gold" />
      <div className="absolute inset-0 -z-10 grid-noise opacity-40" />

      <div className="container max-w-xl pt-10">
        <Button asChild variant="ghost" size="sm" className="mb-8">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Link>
        </Button>

        <Suspense fallback={null}>
          <ReferralBanner />
        </Suspense>

        {/* Aviso Instagram obrigatório */}
        <a
          href="https://www.instagram.com/oticasvisaojp"
          target="_blank"
          rel="noopener noreferrer"
          className="mb-6 flex items-center gap-4 rounded-2xl border border-gold/50 bg-gradient-to-r from-gold/20 via-gold/8 to-transparent p-5 transition hover:border-gold hover:bg-gold/25"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold text-ink-950">
            <Instagram className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gold">
              Requisito obrigatório
            </p>
            <p className="mt-0.5 font-display text-lg font-extrabold leading-tight text-zinc-100">
              Siga <span className="text-gold">@oticasvisaojp</span> no Instagram
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">
              Obrigatório para concorrer — clique aqui para seguir agora
            </p>
          </div>
        </a>

        {/* Alerta de regras */}
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div className="space-y-1.5 text-sm font-semibold text-red-200">
            <p>
              Participantes que <span className="underline">não seguirem</span> o Instagram{" "}
              <strong>@oticasvisaojp</strong> serão automaticamente desclassificados no momento do sorteio.
            </p>
            <p>
              É <span className="underline">vedado</span> realizar mais de um cadastro com números de telefone
              diferentes. Todos os participantes serão conferidos e quem descumprir qualquer regra será{" "}
              <strong>desclassificado</strong>.
            </p>
          </div>
        </div>

        <Card className="p-6 sm:p-10">
          <CardContent className="p-0">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-gold">
              <Sparkles className="h-3 w-3" /> Garanta seu número
            </div>

            <h1 className="font-display text-3xl font-extrabold uppercase leading-tight sm:text-4xl">
              Cadastro <span className="text-gold">grátis</span>
            </h1>
            <p className="mt-2 text-zinc-400">
              Preencha os dados abaixo e ganhe automaticamente seu primeiro número
              da sorte.
            </p>

            <Suspense fallback={<div className="mt-8 h-72 animate-pulse rounded-xl bg-ink-800/40" />}>
              <CadastroForm />
            </Suspense>

            <p className="mt-6 text-center text-xs text-zinc-500">
              Já tem cadastro?{" "}
              <Link href="/meu-cadastro" className="text-gold hover:underline">
                Acesse seus números
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
