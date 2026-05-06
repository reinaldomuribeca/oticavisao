import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Sparkles } from "lucide-react";
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
