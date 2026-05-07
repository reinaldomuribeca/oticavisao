import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CountdownTimer } from "@/components/CountdownTimer";
import { Gift, Share2, Tv, AlertTriangle, Sparkles, Instagram } from "lucide-react";

const RAFFLE_DATE =
  process.env.NEXT_PUBLIC_RAFFLE_DATE ?? "2026-05-07T20:00:00-03:00";

const REGRAS = [
  "É OBRIGATÓRIO seguir o Instagram @oticasvisaojp para participar do sorteio. Participantes que não seguirem o perfil serão desclassificados.",
  "O sorteio será realizado AO VIVO na live do dia 07 de maio de 2026, com início às 20h00.",
  "O cadastro é GRATUITO e garante 1 número da sorte automaticamente.",
  "A cada amigo indicado que realizar o cadastro pelo seu link, você ganha +5 números adicionais.",
  "SÓ CONCORRE QUEM ESTIVER PRESENTE NA LIVE no momento do sorteio. Ausentes serão desclassificados automaticamente.",
  "É VEDADO realizar mais de um cadastro com números de telefone diferentes. Realizaremos a conferência de todos os participantes e quem descumprir qualquer uma das regras será DESCLASSIFICADO.",
  "O número vencedor será sorteado AO VIVO, com total transparência, na plataforma de transmissão.",
  "A live será repleta de promoções exclusivas e imperdíveis.",
  "O resultado é definitivo e irrecorrível.",
];

export default function HomePage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden">
      {/* Fundo dramático */}
      <div className="absolute inset-0 -z-10 bg-radial-gold" />
      <div className="absolute inset-0 -z-10 grid-noise opacity-40" />
      <div className="absolute -top-40 left-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-gold/10 blur-[120px]" />

      {/* HERO */}
      <section className="container flex flex-col items-center pt-16 text-center sm:pt-24">
        <Badge variant="outline" className="mb-6 px-4 py-2 text-xs uppercase tracking-[0.3em]">
          <Sparkles className="mr-2 h-3 w-3" /> Sorteio AO VIVO
        </Badge>

        <h1 className="font-display text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
          <span className="block text-zinc-100">ÓTICA</span>
          <span className="text-shine-gold block">VISÃO</span>
        </h1>

        <p className="mt-6 max-w-2xl text-base text-zinc-300 sm:text-xl">
          Cadastre-se grátis, indique seus amigos e concorra ao sorteio
          <span className="text-gold"> AO VIVO </span>
          em uma live recheada de promoções imperdíveis.
        </p>

        <div className="mt-10 sm:mt-14">
          <CountdownTimer targetISO={RAFFLE_DATE} />
        </div>

        <div className="mt-12 flex w-full max-w-xl flex-col gap-3 sm:flex-row">
          <Button asChild size="xl" className="flex-1 animate-pulse-gold">
            <Link href="/cadastro">QUERO PARTICIPAR</Link>
          </Button>
          <Button asChild size="xl" variant="secondary" className="flex-1">
            <Link href="/meu-cadastro">JÁ ME CADASTREI</Link>
          </Button>
        </div>

        <p className="mt-4 text-xs uppercase tracking-widest text-zinc-500">
          100% gratuito • sem pegadinha • cadastro em 30 segundos
        </p>
      </section>

      {/* COMO FUNCIONA */}
      <section className="container mt-28 sm:mt-36">
        <div className="text-center">
          <Badge variant="outline" className="mb-4">PASSO A PASSO</Badge>
          <h2 className="font-display text-3xl font-extrabold uppercase sm:text-5xl">
            Como <span className="text-gold">funciona</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-400">
            Três passos pra garantir suas chances. Quanto mais você indica, mais números você junta.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {[
            {
              icon: <Gift className="h-7 w-7" />,
              step: "01",
              title: "Faça seu cadastro",
              desc: "Em 30 segundos você ganha automaticamente 1 número da sorte.",
            },
            {
              icon: <Share2 className="h-7 w-7" />,
              step: "02",
              title: "Compartilhe seu link",
              desc: "Cada amigo que se cadastrar pelo seu link te dá +5 números extras. Sem limite.",
            },
            {
              icon: <Tv className="h-7 w-7" />,
              step: "03",
              title: "Esteja na live 07/05 às 20h",
              desc: "O sorteio acontece ao vivo e só concorrem participantes presentes na live.",
            },
          ].map((s) => (
            <Card
              key={s.step}
              className="relative overflow-hidden p-6 transition hover:-translate-y-1 hover:border-gold/50"
            >
              <span className="absolute -right-6 -top-8 font-display text-9xl font-black text-gold/5">
                {s.step}
              </span>
              <div className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/15 text-gold">
                  {s.icon}
                </div>
                <h3 className="mt-5 font-display text-xl font-bold">{s.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{s.desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* REGRAS */}
      <section className="container mt-28 sm:mt-36">
        <div className="text-center">
          <Badge variant="outline" className="mb-4">REGULAMENTO</Badge>
          <h2 className="font-display text-3xl font-extrabold uppercase sm:text-5xl">
            Regras do <span className="text-gold">sorteio</span>
          </h2>
        </div>

        {/* Destaque Instagram */}
        <a
          href="https://www.instagram.com/oticasvisaojp"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-10 flex items-center justify-center gap-4 rounded-2xl border border-gold/40 bg-gradient-to-r from-gold/15 via-gold/5 to-transparent p-6 transition hover:border-gold/70 hover:bg-gold/20"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gold text-ink-950">
            <Instagram className="h-7 w-7" />
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold">
              Obrigatório para participar
            </p>
            <p className="mt-0.5 font-display text-xl font-extrabold text-zinc-100">
              Siga <span className="text-gold">@oticasvisaojp</span> no Instagram
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              Participantes que não seguirem o perfil serão desclassificados. Clique para seguir.
            </p>
          </div>
        </a>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {REGRAS.map((regra, i) => (
            <Card
              key={i}
              className="flex items-start gap-4 p-5 transition hover:border-gold/40"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-black text-ink-950">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed text-zinc-200 sm:text-base">{regra}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="container mt-28 sm:mt-36">
        <Card className="relative overflow-hidden border-gold/30 bg-gradient-to-br from-ink-900 via-ink-900 to-ink-800 p-10 text-center sm:p-16">
          <div className="absolute inset-0 bg-radial-gold opacity-60" />
          <div className="relative">
            <h3 className="font-display text-3xl font-extrabold uppercase sm:text-5xl">
              Não perca <span className="text-shine-gold">essa chance</span>
            </h3>
            <p className="mx-auto mt-4 max-w-xl text-zinc-300">
              Quanto mais cedo você se cadastrar e começar a indicar, mais números você acumula até o sorteio.
            </p>
            <Button asChild size="xl" className="mt-8 animate-pulse-gold">
              <Link href="/cadastro">QUERO MEU NÚMERO AGORA</Link>
            </Button>
          </div>
        </Card>
      </section>

      {/* FOOTER */}
      <footer className="container mt-24 pb-10">
        <Card className="border-red-500/40 bg-red-500/5 p-6">
          <CardContent className="flex items-start gap-4 p-0">
            <AlertTriangle className="mt-1 h-6 w-6 shrink-0 text-red-400" />
            <p className="text-sm font-semibold uppercase tracking-wide text-red-200 sm:text-base">
              ATENÇÃO: Apenas participantes presentes na live no momento do sorteio estão aptos a ganhar.
            </p>
          </CardContent>
        </Card>

        <p className="mt-8 text-center text-xs text-zinc-500">
          © {new Date().getFullYear()} Ótica Visão — Sorteio promocional sem qualquer custo de participação.
        </p>
      </footer>
    </main>
  );
}
