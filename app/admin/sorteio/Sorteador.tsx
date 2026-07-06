"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft,
  FlipHorizontal,
  Loader2,
  PartyPopper,
  RotateCcw,
  Trophy,
  Zap,
} from "lucide-react";

type Winner = {
  position: number;
  number: number;
  name: string;
  phone: string;
};
type Drawn = Winner & { total: number; done: boolean };
type Phase = "idle" | "spinning" | "slowing" | "revealing" | "revealed";

const SPIN_MS = 5000;
const SLOW_MS = 3000;

function pad(n: number) {
  return n.toString().padStart(3, "0");
}

function fireConfetti() {
  const end = Date.now() + 3500;
  const colors = ["#F5C542", "#FDEFB6", "#ffffff", "#E5B22C"];
  (function frame() {
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 75,
      origin: { x: 0, y: 0.6 },
      colors,
    });
    confetti({
      particleCount: 5,
      angle: 120,
      spread: 75,
      origin: { x: 1, y: 0.6 },
      colors,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
  confetti({
    particleCount: 200,
    spread: 90,
    origin: { y: 0.6 },
    startVelocity: 50,
    colors,
  });
}

export function Sorteador() {
  const [pool, setPool] = useState<number[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [totalDraws, setTotalDraws] = useState(1);
  const [editionName, setEditionName] = useState("");
  const [loadingPool, setLoadingPool] = useState(true);

  const [phase, setPhase] = useState<Phase>("idle");
  const [displayed, setDisplayed] = useState<number | null>(null);
  const [current, setCurrent] = useState<Drawn | null>(null);
  const [typed, setTyped] = useState("");
  const [drawing, setDrawing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mirrored, setMirrored] = useState(false);

  const tickRef = useRef<number | null>(null);
  const phaseTimers = useRef<number[]>([]);

  // Carrega pool + ganhadores + configuração
  useEffect(() => {
    void refresh();
  }, []);

  // Restaura a preferência de espelhamento (persiste entre sessões)
  useEffect(() => {
    try {
      setMirrored(localStorage.getItem("ov_sorteador_mirror") === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function editionQS() {
    try {
      const p = new URLSearchParams(window.location.search).get("edition");
      return p ? `?edition=${p}` : "";
    } catch {
      return "";
    }
  }

  function toggleMirror() {
    setMirrored((m) => {
      const next = !m;
      try {
        localStorage.setItem("ov_sorteador_mirror", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  async function refresh() {
    setLoadingPool(true);
    try {
      const r = await fetch(`/api/raffle${editionQS()}`);
      const d = await r.json();
      setPool(d.pool ?? []);
      setEditionName(d.edition?.name ?? "");
      setTotalDraws(d.totalDraws ?? 1);
      setWinners(d.winners ?? []);
    } finally {
      setLoadingPool(false);
    }
  }

  function clearTimers() {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    phaseTimers.current.forEach((id) => clearTimeout(id));
    phaseTimers.current = [];
  }

  async function startDraw() {
    if (pool.length === 0 || drawing) return;
    setError(null);
    setDrawing(true);

    // 1) Sorteia no servidor (aleatório, honesto, sem repetir ganhador). Já comita.
    let drawn: Drawn;
    try {
      const r = await fetch(`/api/raffle/draw${editionQS()}`, { method: "POST" });
      const d = await r.json();
      if (!r.ok || d.error) {
        setError(d.message ?? "Não foi possível sortear.");
        setDrawing(false);
        return;
      }
      drawn = d as Drawn;
    } catch {
      setError("Falha de conexão ao sortear.");
      setDrawing(false);
      return;
    }

    // 2) Animação — apenas visual. "Cai" no número que o servidor sorteou.
    setCurrent(drawn);
    setTyped("");
    clearTimers();
    setPhase("spinning");

    tickRef.current = window.setInterval(() => {
      setDisplayed(pool[Math.floor(Math.random() * pool.length)]);
    }, 60);

    phaseTimers.current.push(
      window.setTimeout(() => {
        if (tickRef.current) clearInterval(tickRef.current);
        setPhase("slowing");
        let interval = 90;
        const slow = () => {
          setDisplayed(pool[Math.floor(Math.random() * pool.length)]);
          interval = Math.min(450, interval * 1.18);
          tickRef.current = window.setTimeout(slow, interval) as unknown as number;
        };
        slow();
      }, SPIN_MS),
    );

    phaseTimers.current.push(
      window.setTimeout(() => {
        if (tickRef.current) clearTimeout(tickRef.current);
        setDisplayed(drawn.number);
        setPhase("revealing");
        fireConfetti();

        let i = 0;
        const typer = window.setInterval(() => {
          i++;
          setTyped(drawn.name.slice(0, i));
          if (i >= drawn.name.length) clearInterval(typer);
        }, 70);

        phaseTimers.current.push(
          window.setTimeout(() => {
            setPhase("revealed");
            setWinners((w) => [
              ...w,
              {
                position: drawn.position,
                number: drawn.number,
                name: drawn.name,
                phone: drawn.phone,
              },
            ]);
            setDrawing(false);
          }, 1200),
        );
      }, SPIN_MS + SLOW_MS),
    );
  }

  function backToIdle() {
    clearTimers();
    setPhase("idle");
    setCurrent(null);
    setTyped("");
    setDisplayed(null);
  }

  async function resetWinners() {
    if (
      !window.confirm(
        "Zerar TODOS os ganhadores desta edição? Use apenas para testes.",
      )
    ) {
      return;
    }
    setResetting(true);
    setError(null);
    try {
      const r = await fetch(`/api/raffle/reset${editionQS()}`, { method: "POST" });
      if (r.ok) {
        setWinners([]);
        backToIdle();
      } else {
        const d = await r.json();
        setError(d.message ?? "Não foi possível zerar os ganhadores.");
      }
    } catch {
      setError("Falha de conexão ao zerar.");
    } finally {
      setResetting(false);
    }
  }

  const drawnCount = winners.length;
  const allDone = drawnCount >= totalDraws;
  const nextIndex = drawnCount + 1;
  const isSpinning = phase === "spinning" || phase === "slowing";
  const showReveal = phase === "revealing" || phase === "revealed";

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-black">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(245,197,66,0.15),transparent_60%)]" />
      <div className="absolute inset-0 -z-10 grid-noise opacity-30" />

      {/* Botão de espelhar — FORA do espelhamento, sempre clicável e legível */}
      <button
        type="button"
        onClick={toggleMirror}
        aria-pressed={mirrored}
        title="Espelhar a tela (para exibir corretamente na live, já que a câmera inverte a imagem)"
        className={`fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-widest transition ${
          mirrored
            ? "border-gold bg-gold text-ink-950"
            : "border-gold/30 bg-ink-900/80 text-gold/80 hover:border-gold/60"
        }`}
      >
        <FlipHorizontal className="h-4 w-4" />
        {mirrored ? "Espelhado" : "Espelhar"}
      </button>

      {/* Conteúdo espelhável */}
      <div style={mirrored ? { transform: "scaleX(-1)" } : undefined}>
        <header className="container flex items-center justify-between pt-6">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao painel
            </Link>
          </Button>
          <span className="text-xs uppercase tracking-[0.4em] text-gold/70">
            {editionName ? `${editionName} · ` : ""}Sorteador AO VIVO
          </span>
        </header>

        <div className="container flex min-h-[calc(100vh-80px)] flex-col items-center justify-center py-12">
          {/* IDLE / SETUP */}
          {phase === "idle" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-2xl text-center"
            >
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-gold">
                {allDone ? (
                  <>
                    <Trophy className="h-3 w-3" /> Sorteios concluídos
                  </>
                ) : (
                  <>
                    <Zap className="h-3 w-3" /> Sorteio {nextIndex} de {totalDraws}
                  </>
                )}
              </div>
              <h1 className="font-display text-5xl font-black uppercase leading-none sm:text-7xl">
                <span className="text-shine-gold">Sorteador</span>
              </h1>
              <p className="mt-4 text-zinc-400">
                {loadingPool
                  ? "Carregando..."
                  : allDone
                    ? "Todos os prêmios já foram sorteados."
                    : "Tudo pronto. Clique para sortear o próximo prêmio."}
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                A quantidade de sorteios é definida no painel admin.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <Card className="border-gold/30 bg-ink-900/80 p-6">
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                    Total de números
                  </p>
                  <p className="mt-2 font-display text-5xl font-black text-shine-gold">
                    {pool.length}
                  </p>
                </Card>
                <Card className="border-gold/30 bg-ink-900/80 p-6">
                  <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                    Ganhadores
                  </p>
                  <p className="mt-2 font-display text-5xl font-black text-zinc-100">
                    {drawnCount}
                    <span className="text-2xl text-zinc-500"> / {totalDraws}</span>
                  </p>
                </Card>
              </div>

              {/* Lista de ganhadores já sorteados */}
              {winners.length > 0 && (
                <Card className="mt-6 border-gold/20 bg-ink-900/60 p-5 text-left">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gold/80">
                    Ganhadores
                  </p>
                  <ul className="space-y-2">
                    {winners.map((w) => (
                      <li
                        key={w.position}
                        className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-ink-900/70 px-3 py-2"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold text-xs font-black text-ink-950">
                          {w.position}º
                        </span>
                        <span className="font-mono text-sm font-bold tabular-nums text-shine-gold">
                          #{pad(w.number)}
                        </span>
                        <span className="truncate font-display font-bold text-zinc-100">
                          {w.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {error && (
                <p className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
                  {error}
                </p>
              )}

              {!allDone ? (
                <Button
                  size="xl"
                  className="mt-8 h-20 w-full animate-pulse-gold text-xl"
                  onClick={startDraw}
                  disabled={pool.length === 0 || drawing}
                >
                  {drawing ? (
                    <>
                      <Loader2 className="mr-3 h-6 w-6 animate-spin" /> SORTEANDO...
                    </>
                  ) : (
                    <>
                      <Trophy className="mr-3 h-6 w-6" />
                      {nextIndex === 1
                        ? "INICIAR SORTEIO"
                        : `SORTEAR ${nextIndex}º PRÊMIO`}
                    </>
                  )}
                </Button>
              ) : (
                <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
                  <p className="font-display text-xl font-extrabold text-emerald-200">
                    🏆 Todos os {totalDraws} sorteios foram realizados!
                  </p>
                </div>
              )}

              {/* Zerar ganhadores (apenas para testes) */}
              {winners.length > 0 && (
                <button
                  type="button"
                  onClick={resetWinners}
                  disabled={resetting}
                  className="mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-500 underline-offset-4 transition hover:text-red-400 hover:underline disabled:opacity-50"
                >
                  {resetting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                  Zerar ganhadores (teste)
                </button>
              )}
            </motion.div>
          )}

          {/* SPINNING / REVEAL */}
          {(isSpinning || showReveal) && (
            <div className="relative w-full max-w-3xl text-center">
              <motion.div
                animate={
                  phase === "revealing" || phase === "revealed"
                    ? { scale: [1, 1.15, 1] }
                    : { scale: 1 }
                }
                transition={{ duration: 0.6 }}
                className="relative"
              >
                <div
                  className={`pointer-events-none absolute inset-0 -z-10 rounded-[3rem] ${
                    showReveal
                      ? "bg-[radial-gradient(circle,rgba(245,197,66,0.45),transparent_60%)] blur-3xl"
                      : "bg-[radial-gradient(circle,rgba(245,197,66,0.18),transparent_70%)] blur-2xl"
                  }`}
                />
                <Card
                  className={`relative overflow-hidden border-gold/50 bg-gradient-to-br from-ink-900 via-ink-900 to-ink-800 px-6 py-16 transition-all sm:py-24 ${
                    showReveal ? "border-gold shadow-[0_0_120px_rgba(245,197,66,0.5)]" : ""
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.5em] text-gold/80">
                    {showReveal
                      ? `VENCEDOR — ${current?.position ?? nextIndex}º PRÊMIO`
                      : `Sorteando ${current?.position ?? nextIndex}º prêmio...`}
                  </p>

                  <div className="mt-6 font-display text-[clamp(5rem,18vw,14rem)] font-black leading-none">
                    <AnimatePresence mode="popLayout">
                      <motion.span
                        key={`${displayed}-${phase}`}
                        initial={{ y: isSpinning ? 40 : 0, opacity: isSpinning ? 0.4 : 1, scale: showReveal ? 0.6 : 1 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: -40, opacity: 0 }}
                        transition={{ duration: phase === "spinning" ? 0.05 : phase === "slowing" ? 0.18 : 0.5 }}
                        className={`inline-block tabular-nums ${
                          showReveal ? "text-shine-gold" : "text-zinc-200"
                        } ${phase === "spinning" ? "blur-[1px]" : phase === "slowing" ? "blur-[0.5px]" : ""}`}
                      >
                        #{displayed != null ? pad(displayed) : "000"}
                      </motion.span>
                    </AnimatePresence>
                  </div>

                  {showReveal && current && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="mt-8"
                    >
                      <p className="text-sm uppercase tracking-widest text-gold/80">
                        Parabéns
                      </p>
                      <p className="mt-2 font-display text-3xl font-extrabold text-zinc-50 sm:text-5xl">
                        {typed}
                        <span className="ml-1 inline-block animate-pulse text-gold">|</span>
                      </p>
                    </motion.div>
                  )}

                  {phase === "revealed" && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-10 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2 text-sm font-black uppercase tracking-widest text-ink-950"
                    >
                      <PartyPopper className="h-4 w-4" /> 🏆 VENCEDOR!
                    </motion.div>
                  )}
                </Card>
              </motion.div>

              {phase === "revealed" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1 }}
                  className="mt-8 flex flex-col items-center gap-2"
                >
                  <Button size="xl" onClick={backToIdle} className="w-full sm:w-auto">
                    {drawnCount >= totalDraws ? (
                      <>
                        <Trophy className="mr-2 h-5 w-5" /> VER RESULTADO FINAL
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-5 w-5" /> CONTINUAR (
                        {drawnCount}/{totalDraws})
                      </>
                    )}
                  </Button>
                  <p className="text-xs uppercase tracking-widest text-zinc-500">
                    Resultado salvo automaticamente
                  </p>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
