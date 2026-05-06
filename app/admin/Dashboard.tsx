"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  LogOut,
  Search,
  Tv,
  Users,
  Ticket,
  UserPlus,
  Trophy,
} from "lucide-react";
import { formatPhoneBR } from "@/lib/utils";

type Lead = {
  id: string;
  name: string;
  phone: string;
  raffle_numbers: number[];
  referral_count: number;
  referrer_name: string | null;
  created_at: string;
};

type Stats = {
  ok: true;
  stats: {
    participants: number;
    numbers: number;
    referrals: number;
    top: { id: string; name: string; phone: string; referral_count: number } | null;
  };
  config: {
    winner_number: number | null;
    drawn_at: string | null;
    is_locked: boolean;
  } | null;
};

type LeadsResp = {
  ok: true;
  leads: Lead[];
  page: number;
  pageSize: number;
  total: number;
};

const SORT_OPTIONS = [
  { value: "created_at", label: "Data de cadastro" },
  { value: "name", label: "Nome" },
  { value: "phone", label: "WhatsApp" },
  { value: "referral_count", label: "Indicações" },
];

export function Dashboard() {
  const [stats, setStats] = useState<Stats["stats"] | null>(null);
  const [config, setConfig] = useState<Stats["config"]>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("created_at");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((d: Stats) => {
        setStats(d.stats);
        setConfig(d.config);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    const url = new URL("/api/admin/leads", window.location.origin);
    url.searchParams.set("page", String(page));
    url.searchParams.set("sort", sort);
    url.searchParams.set("dir", dir);
    if (q) url.searchParams.set("q", q);
    fetch(url.toString())
      .then((r) => r.json())
      .then((d: LeadsResp) => {
        setLeads(d.leads);
        setTotal(d.total);
        setPageSize(d.pageSize);
      })
      .finally(() => setLoading(false));
  }, [page, sort, dir, q]);

  const cards = useMemo(
    () => [
      {
        icon: <Users className="h-5 w-5" />,
        label: "Cadastrados",
        value: stats?.participants ?? "—",
      },
      {
        icon: <Ticket className="h-5 w-5" />,
        label: "Números gerados",
        value: stats?.numbers ?? "—",
      },
      {
        icon: <UserPlus className="h-5 w-5" />,
        label: "Indicações",
        value: stats?.referrals ?? "—",
      },
      {
        icon: <Trophy className="h-5 w-5" />,
        label: "Top indicador",
        value: stats?.top
          ? `${stats.top.name.split(" ")[0]} (${stats.top.referral_count})`
          : "—",
      },
    ],
    [stats],
  );

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin";
  }

  return (
    <main className="container max-w-7xl py-10">
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500">
            Ótica Visão · Admin
          </p>
          <h1 className="font-display text-3xl font-extrabold uppercase">
            Painel de <span className="text-gold">controle</span>
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="default" size="lg">
            <Link href="/admin/sorteio">
              <Tv className="mr-2 h-4 w-4" /> ABRIR SORTEADOR
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <a href="/api/admin/export">
              <Download className="mr-2 h-4 w-4" /> EXPORTAR CSV
            </a>
          </Button>
          <Button variant="ghost" size="lg" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      {config?.winner_number != null && (
        <Card className="mb-8 border-emerald-500/30 bg-emerald-500/10 p-5">
          <p className="text-sm uppercase tracking-widest text-emerald-300">
            🏆 Sorteio realizado
          </p>
          <p className="mt-1 font-display text-2xl font-extrabold text-emerald-100">
            Número vencedor: #{String(config.winner_number).padStart(3, "0")}
          </p>
          {config.drawn_at && (
            <p className="text-xs text-emerald-300/80">
              {new Date(config.drawn_at).toLocaleString("pt-BR")}
            </p>
          )}
        </Card>
      )}

      <section className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                {c.label}
              </span>
              <span className="text-gold">{c.icon}</span>
            </div>
            <p className="mt-3 font-display text-3xl font-extrabold tabular-nums text-zinc-100">
              {c.value}
            </p>
          </Card>
        ))}
      </section>

      <Card className="p-6">
        <CardContent className="p-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold uppercase">Leads</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Buscar por nome ou telefone"
                  className="h-10 w-[260px] pl-9"
                />
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="h-10 rounded-xl border border-zinc-700 bg-ink-900 px-3 text-sm text-zinc-200"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    Ordenar: {o.label}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDir(dir === "asc" ? "desc" : "asc")}
              >
                {dir === "asc" ? "↑ Asc" : "↓ Desc"}
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Números</TableHead>
                <TableHead>Indicações</TableHead>
                <TableHead>Cadastrado em</TableHead>
                <TableHead>Indicado por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && leads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-zinc-500">
                    Carregando…
                  </TableCell>
                </TableRow>
              )}
              {!loading && leads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-zinc-500">
                    Nenhum lead encontrado.
                  </TableCell>
                </TableRow>
              )}
              {leads.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {formatPhoneBR(l.phone)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {l.raffle_numbers.slice(0, 6).map((n) => (
                        <Badge key={n} variant="secondary" className="font-mono">
                          #{String(n).padStart(3, "0")}
                        </Badge>
                      ))}
                      {l.raffle_numbers.length > 6 && (
                        <Badge variant="outline">+{l.raffle_numbers.length - 6}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={l.referral_count > 0 ? "default" : "secondary"}>
                      {l.referral_count}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-zinc-400">
                    {new Date(l.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-sm text-zinc-400">
                    {l.referrer_name ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-zinc-500">
              {total} lead{total === 1 ? "" : "s"} • página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
