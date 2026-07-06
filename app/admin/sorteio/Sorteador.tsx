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
  RefreshCcw,
  Save,
  Trophy,
  Zap,
} from "lucide-react";
import { formatPhoneBR } from "@/lib/utils";

type Winner = { number: number; name: string; phone: string };
type Phase = "idle" | "spinning" | "slowing" | "revealing" | "revealed" | "saved";

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
  // burst inicial
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
  const [savedWinner, setSavedWinner] = useState<Winner | null>(null);
  const [loadingPool, setLoadingPool] = useState(true);
  const [editionId, setEditionId] = useState<string>("");
  const [editionName, setEditionName] = useState<string>("");

  const [phase, setPhase] = useState<Phase>("idle");
  const [displayed, setDisplayed] = useState<number | null>(null);
  const [winner, setWinner] = useState<Winner | null>(null);
  const [typed, setTyped] = useState("");
  const [saving, setSaving] = useState(false);
  const [mirrored, setMirrored] = useState(false);

  const tickRef = useRef<number | null>(null);
  const phaseTimers = useRef<number[]>([]);

  // Carrega pool + estado salvo
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
      const param = new URLSearchParams(window.location.search).get("edition");
      const qs = param ? `?edition=${param}` : "";
      const r = await fetch(`/api/raffle${qs}`);
      const d = await r.json();
      setPool(d.pool ?? []);
      setEditionId(d.edition?.id ?? param ?? "");
      setEditionName(d.edition?.name ?? "");
      if (d.winner) {
        setSavedWinner(d.winner);
        setPhase("saved");
      }
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

  function startDraw() {
    if (pool.length === 0) return;
    clearTimers();
    setSavedWinner(null);
    setWinner(null);
    setTyped("");

    // Sorteia o vencedor agora (do pool real, garantindo associação a um participante)
    const finalNumber = pool[Math.floor(Math.random() * pool.length)];

    setPhase("spinning");

    // Fase 1 (rápido)
    tickRef.current = window.setInterval(() => {
      setDisplayed(pool[Math.floor(Math.random() * pool.length)]);
    }, 60);

    phaseTimers.current.push(
      window.setTimeout(() => {
        // Fase 2 (desacelerando)
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
      window.setTimeout(async () => {
        // Fase 3: revela
        if (tickRef.current) clearTimeout(tickRef.current);
        setDisplayed(finalNumber);
        setPhase("revealing");
        fireConfetti();

        // Busca dados do vencedor pra mostrar o nome
        try {
          const r = await fetch(
            `/api/raffle/lookup?number=${finalNumber}${editionId ? `&edition=${editionId}` : ""}`,
          );
          if (r.ok) {
            const d = await r.json();
            const w: Winner = {
              number: finalNumber,
              name: d.name ?? "",
              phone: d.phone ?? "",
            };
            setWinner(w);
            // typewriter
            let i = 0;
            const typer = window.setInterval(() => {
              i++;
              setTyped(w.name.slice(0, i));
              if (i >= w.name.length) clearInterval(typer);
            }, 70);
          }
        } catch {
          /* ignore */
        }

        phaseTimers.current.push(
          window.setTimeout(() => setPhase("revealed"), 1200),
        );
      }, SPIN_MS + SLOW_MS),
    );
  }

  async function saveResult() {
    if (!winner) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/raffle${editionId ? `?edition=${editionId}` : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: winner.number }),
      });
      if (r.ok) {
        const d = await r.json();
        setSavedWinner(d.winner);
        setPhase("saved");
      }
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    clearTimers();
    setPhase("idle");
    setWinner(null);
    setSavedWinner(null);
    setTyped("");
    setDisplayed(null);
  }

  const isSpinning = phase === "spinning" || phase === "slowing";
  const showReveal = phase === "revealing" || phase === "revealed";

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-black">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(245,197,66,0.15),transparent_60%)]" />
      <div className="absolute inset-0 -z-10 grid-noise opacity-30" />

      {/* Botão de espelhar — fica FORA do espelhamento, sempre clicável e legível */}
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

      {/* Conteúdo espelhável — flip horizontal para aparecer certo na live */}
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
        {/* IDLE */}
        {phase === "idle" && !savedWinner && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl text-center"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-gold">
              <Zap className="h-3 w-3" /> Pronto para sortear
            </div>
            <h1 className="font-display text-5xl font-black uppercase leading-none sm:text-7xl">
              <span className="text-shine-gold">Sorteador</span>
            </h1>
            <p className="mt-4 text-zinc-400">
              {loadingPool ? "Carregando pool..." : "Tudo pronto. Quando estiver na live, clique para iniciar."}
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
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
                  Faixa de números
                </p>
                <p className="mt-2 font-display text-3xl font-black text-zinc-100">
                  {pool.length
                    ? `#${pad(pool[0])} – #${pad(pool[pool.length - 1])}`
                    : "—"}
                </p>
              </Card>
            </div>

            <Button
              size="xl"
              className="mt-12 h-20 w-full animate-pulse-gold text-xl"
              onClick={startDraw}
              disabled={pool.length === 0}
            >
              <Trophy className="mr-3 h-6 w-6" /> INICIAR SORTEIO
            </Button>
          </motion.div>
        )}

        {/* SPINNING / REVEALING */}
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
                  {showReveal ? "VENCEDOR!" : "Sorteando..."}
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

                {showReveal && winner && (
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
                className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
              >
                <Button size="xl" onClick={saveResult} disabled={saving} className="w-full sm:w-auto">
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> SALVANDO...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-5 w-5" /> SALVAR RESULTADO
                    </>
                  )}
                </Button>
                <Button variant="ghost" size="lg" onClick={reset}>
                  <RefreshCcw className="mr-2 h-4 w-4" /> Sortear de novo
                </Button>
              </motion.div>
            )}
          </div>
        )}

        {/* SAVED */}
        {phase === "saved" && savedWinner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl"
          >
            <Card className="overflow-hidden border-gold bg-gradient-to-br from-ink-900 via-ink-900 to-gold/10 p-10 text-center">
              <Trophy className="mx-auto h-16 w-16 text-gold" />
              <p className="mt-4 text-xs uppercase tracking-[0.4em] text-gold/80">
                Resultado oficial
              </p>
              <p className="mt-4 font-display text-7xl font-black text-shine-gold">
                #{pad(savedWinner.number)}
              </p>
              <p className="mt-6 font-display text-3xl font-extrabold text-zinc-50">
                {savedWinner.name}
              </p>
              <p className="mt-1 text-zinc-400">{formatPhoneBR(savedWinner.phone)}</p>

              <div className="mt-10 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                <Button variant="secondary" size="lg" onClick={reset}>
                  <RefreshCcw className="mr-2 h-4 w-4" /> Realizar novo sorteio
                </Button>
                <Button asChild variant="ghost" size="lg">
                  <Link href="/admin">Voltar ao painel</Link>
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
      </div>
    </main>
  );
}
