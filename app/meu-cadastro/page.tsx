import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { MeuCadastroClient } from "./MeuCadastroClient";

export default function MeuCadastroPage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-radial-gold" />
      <div className="absolute inset-0 -z-10 grid-noise opacity-40" />

      <div className="container max-w-2xl pt-10">
        <Button asChild variant="ghost" size="sm" className="mb-8">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Link>
        </Button>

        <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-ink-800/40" />}>
          <MeuCadastroClient />
        </Suspense>
      </div>
    </main>
  );
}
