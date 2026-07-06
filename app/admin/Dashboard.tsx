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
  Trash2,
  Tv,
  Users,
  Ticket,
  UserPlus,
  Trophy,
  Plus,
  Pencil,
  CalendarClock,
} from "lucide-react";
import { formatPhoneBR } from "@/lib/utils";

// ISO (instante absoluto) -> valor de <input type="datetime-local"> em hora local (Brasília, do navegador do admin)
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

type Lead = {
  id: string;
  name: string;
  phone: string;
  raffle_numbers: number[];
  referral_count: number;
  referrer_name: string | null;
  created_at: string;
};

type Edition = {
  id: string;
  name: string;
  is_active: boolean;
  cadastros_encerrados: boolean;
  last_number: number;
  winner_number: number | null;
  drawn_at: string | null;
  raffle_date: string | null;
  created_at: string;
  closed_at: string | null;
};

type Stats = {
  ok: true;
  stats: {
    participants: number;
    numbers: number;
    referrals: number;
    top: { id: string; name: string; phone: string; referral_count: number } | null;
  };
  edition: Edition | null;
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
  const [edition, setEdition] = useState<Edition | null>(null);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [selectedEdition, setSelectedEdition] = useState<string>("");
  const [busyEdition, setBusyEdition] = useState(false);
  const [winners, setWinners] = useState<
    { position: number; number: number; name: string; phone: string }[]
  >([]);
  const [totalDraws, setTotalDraws] = useState(1);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("created_at");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showNewEdition, setShowNewEdition] = useState(false);
  const [showEditEdition, setShowEditEdition] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [dateDraft, setDateDraft] = useState("");
  const [savingDate, setSavingDate] = useState(false);
  const [drawsDraft, setDrawsDraft] = useState("1");
  const [savingDraws, setSavingDraws] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Carrega a lista de edições e seleciona a ativa
  useEffect(() => {
    fetch("/api/admin/editions")
      .then((r) => r.json())
      .then((d: { editions: Edition[] }) => {
        setEditions(d.editions ?? []);
        const active = (d.editions ?? []).find((e) => e.is_active);
        setSelectedEdition((prev) => prev || active?.id || (d.editions?.[0]?.id ?? ""));
      });
  }, []);

  // Stats da edição selecionada
  useEffect(() => {
    if (!selectedEdition) return;
    fetch(`/api/admin/stats?edition=${selectedEdition}`)
      .then((r) => r.json())
      .then((d: Stats) => {
        setStats(d.stats);
        setEdition(d.edition);
      });
  }, [selectedEdition]);

  // Ganhadores (todos os sorteios) da edição selecionada
  useEffect(() => {
    if (!selectedEdition) return;
    fetch(`/api/raffle?edition=${selectedEdition}`)
      .then((r) => r.json())
      .then((d) => {
        setWinners(d.winners ?? []);
        setTotalDraws(d.totalDraws ?? 1);
        setDrawsDraft(String(d.totalDraws ?? 1));
      })
      .catch(() => {
        setWinners([]);
        setTotalDraws(1);
        setDrawsDraft("1");
      });
  }, [selectedEdition]);

  // Leads da edição selecionada
  useEffect(() => {
    if (!selectedEdition) return;
    setLoading(true);
    const url = new URL("/api/admin/leads", window.location.origin);
    url.searchParams.set("edition", selectedEdition);
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
  }, [selectedEdition, page, sort, dir, q]);

  // Mantém o campo de data em sincronia com a edição selecionada
  useEffect(() => {
    setDateDraft(toLocalInput(edition?.raffle_date ?? null));
  }, [edition?.id, edition?.raffle_date]);

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

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/leads/${id}`, { method: "DELETE" });
      if (res.ok) {
        setLeads((prev) => prev.filter((l) => l.id !== id));
        setTotal((prev) => prev - 1);
        // Recarrega stats da edição atual
        if (selectedEdition) {
          fetch(`/api/admin/stats?edition=${selectedEdition}`)
            .then((r) => r.json())
            .then((d: Stats) => { setStats(d.stats); setEdition(d.edition); });
        }
      }
    } finally {
      setConfirmDelete(null);
      setDeleting(false);
    }
  }

  function refreshEditions() {
    fetch("/api/admin/editions")
      .then((r) => r.json())
      .then((d: { editions: Edition[] }) => setEditions(d.editions ?? []));
    if (selectedEdition) {
      fetch(`/api/admin/stats?edition=${selectedEdition}`)
        .then((r) => r.json())
        .then((d: Stats) => { setStats(d.stats); setEdition(d.edition); });
    }
  }

  async function createEdition() {
    if (!newName.trim() || !newDate) return;
    setBusyEdition(true);
    try {
      const res = await fetch("/api/admin/editions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          raffle_date: new Date(newDate).toISOString(),
        }),
      });
      const d = await res.json();
      if (res.ok && d.edition_id) {
        const list = await fetch("/api/admin/editions").then((r) => r.json());
        setEditions(list.editions ?? []);
        setSelectedEdition(d.edition_id);
        setPage(1);
        setShowNewEdition(false);
        setNewName("");
        setNewDate("");
      } else {
        window.alert(d.message ?? "Erro ao criar edição.");
      }
    } finally {
      setBusyEdition(false);
    }
  }

  async function saveTotalDraws() {
    if (!selectedEdition) return;
    const n = Math.trunc(Number(drawsDraft));
    if (!Number.isFinite(n) || n < 1) {
      window.alert("Informe um número de sorteios válido (mínimo 1).");
      return;
    }
    setSavingDraws(true);
    try {
      const res = await fetch(`/api/raffle/config?edition=${selectedEdition}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ total_draws: n }),
      });
      const d = await res.json();
      if (res.ok) {
        setTotalDraws(d.total_draws);
        setDrawsDraft(String(d.total_draws));
      } else {
        window.alert(d.message ?? "Não foi possível salvar a quantidade de sorteios.");
      }
    } finally {
      setSavingDraws(false);
    }
  }

  async function saveEditionDate() {
    if (!edition || !dateDraft) return;
    setSavingDate(true);
    try {
      const res = await fetch(`/api/admin/editions/${edition.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raffle_date: new Date(dateDraft).toISOString() }),
      });
      if (res.ok) {
        refreshEditions();
      } else {
        const d = await res.json().catch(() => ({}));
        window.alert(d.message ?? "Erro ao salvar a data.");
      }
    } finally {
      setSavingDate(false);
    }
  }

  async function toggleLock() {
    if (!edition) return;
    setBusyEdition(true);
    try {
      const res = await fetch(`/api/admin/editions/${edition.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cadastros_encerrados: !edition.cadastros_encerrados }),
      });
      if (res.ok) refreshEditions();
    } finally {
      setBusyEdition(false);
    }
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
            <Link href={selectedEdition ? `/admin/sorteio?edition=${selectedEdition}` : "/admin/sorteio"}>
              <Tv className="mr-2 h-4 w-4" /> ABRIR SORTEADOR
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <a href={selectedEdition ? `/api/admin/export?edition=${selectedEdition}` : "/api/admin/export"}>
              <Download className="mr-2 h-4 w-4" /> EXPORTAR CSV
            </a>
          </Button>
          <Button variant="ghost" size="lg" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      {/* Barra de edição */}
      <div className="mb-8 rounded-2xl border border-zinc-800 bg-ink-900/60 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Edição
            </span>
            <select
              value={selectedEdition}
              onChange={(e) => {
                setSelectedEdition(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-xl border border-zinc-700 bg-ink-900 px-3 text-sm text-zinc-200"
            >
              {editions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.is_active ? " (ativa)" : ""}
                </option>
              ))}
            </select>
          </div>

          {edition && (
            <Badge variant={edition.is_active ? "default" : "secondary"}>
              {edition.is_active
                ? edition.cadastros_encerrados
                  ? "Ativa · cadastros encerrados"
                  : "Ativa · cadastros abertos"
                : "Encerrada"}
            </Badge>
          )}

          <div className="ml-auto flex flex-wrap gap-2">
            {edition?.is_active && (
              <Button variant="secondary" size="sm" disabled={busyEdition} onClick={toggleLock}>
                {edition.cadastros_encerrados ? "Reabrir cadastros" : "Encerrar cadastros"}
              </Button>
            )}
            {edition && (
              <Button
                variant={showEditEdition ? "default" : "secondary"}
                size="sm"
                onClick={() => setShowEditEdition((v) => !v)}
              >
                <Pencil className="mr-1 h-4 w-4" /> Editar edição
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              disabled={busyEdition}
              onClick={() => setShowNewEdition((v) => !v)}
            >
              <Plus className="mr-1 h-4 w-4" /> Nova edição
            </Button>
          </div>
        </div>

        {/* Painel de edição da edição selecionada — data/hora e nº de sorteios */}
        {edition && showEditEdition && (
          <div className="mt-3 space-y-3 border-t border-zinc-800 pt-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold">
              Editar edição — {edition.name}
            </p>

            {/* Data/hora do sorteio (alimenta o contador do site) */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex w-40 items-center gap-1 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                <CalendarClock className="h-4 w-4" /> Data do sorteio
              </span>
              <input
                type="datetime-local"
                value={dateDraft}
                onChange={(e) => setDateDraft(e.target.value)}
                className="h-10 rounded-xl border border-zinc-700 bg-ink-900 px-3 text-sm text-zinc-200"
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={savingDate || !dateDraft}
                onClick={saveEditionDate}
              >
                {savingDate ? "Salvando…" : "Salvar data"}
              </Button>
              <span className="text-xs text-zinc-500">
                {edition.raffle_date
                  ? `Atual: ${new Date(edition.raffle_date).toLocaleString("pt-BR")}`
                  : "Sem data — o contador do site usa o valor padrão"}
              </span>
            </div>

            {/* Quantidade de sorteios (prêmios) — usada no Sorteador */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex w-40 items-center gap-1 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                <Trophy className="h-4 w-4" /> Sorteios (prêmios)
              </span>
              <input
                type="number"
                min={Math.max(1, winners.length)}
                value={drawsDraft}
                onChange={(e) => setDrawsDraft(e.target.value)}
                className="h-10 w-24 rounded-xl border border-zinc-700 bg-ink-900 px-3 text-center text-sm font-bold tabular-nums text-zinc-200"
                aria-label="Quantidade de sorteios"
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={savingDraws || !drawsDraft}
                onClick={saveTotalDraws}
              >
                {savingDraws ? "Salvando…" : "Salvar"}
              </Button>
              <span className="text-xs text-zinc-500">
                {winners.length} de {totalDraws} já sorteado
                {winners.length === 1 ? "" : "s"} · usado no Sorteador
              </span>
            </div>

            {winners.length > 0 && (
              <p className="text-xs text-amber-400/80">
                Já há {winners.length} ganhador{winners.length === 1 ? "" : "es"} nesta
                edição — não é possível reduzir abaixo de {winners.length}. Para diminuir,
                zere os ganhadores no Sorteador.
              </p>
            )}
          </div>
        )}

        {/* Formulário de nova edição (nome + data/hora obrigatórios) */}
        {showNewEdition && (
          <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-zinc-800 pt-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Nome
              </label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex.: Live Agosto/2026"
                className="h-10 w-[240px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Data e hora do sorteio
              </label>
              <input
                type="datetime-local"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="h-10 rounded-xl border border-zinc-700 bg-ink-900 px-3 text-sm text-zinc-200"
              />
            </div>
            <Button
              variant="default"
              size="sm"
              disabled={busyEdition || !newName.trim() || !newDate}
              onClick={createEdition}
            >
              Criar edição
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busyEdition}
              onClick={() => setShowNewEdition(false)}
            >
              Cancelar
            </Button>
          </div>
        )}
      </div>

      {winners.length > 0 && (
        <Card className="mb-8 border-emerald-500/30 bg-emerald-500/10 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm uppercase tracking-widest text-emerald-300">
              🏆 {winners.length >= totalDraws ? "Sorteio concluído" : "Sorteio em andamento"}
              {edition?.name ? ` — ${edition.name}` : ""}
            </p>
            <p className="text-xs text-emerald-300/80">
              {winners.length} de {totalDraws} prêmio{totalDraws === 1 ? "" : "s"} sorteado
              {winners.length === 1 ? "" : "s"}
            </p>
          </div>
          <ul className="mt-4 space-y-2">
            {winners.map((w) => (
              <li
                key={w.position}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-xs font-black text-emerald-950">
                  {w.position}º
                </span>
                <span className="font-mono text-sm font-bold tabular-nums text-emerald-200">
                  #{String(w.number).padStart(3, "0")}
                </span>
                <span className="font-display font-bold text-emerald-50">{w.name}</span>
                <span className="text-xs text-emerald-300/70">{formatPhoneBR(w.phone)}</span>
              </li>
            ))}
          </ul>
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
                <TableHead className="w-[120px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && leads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-zinc-500">
                    Carregando…
                  </TableCell>
                </TableRow>
              )}
              {!loading && leads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-zinc-500">
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
                  <TableCell className="text-right">
                    {confirmDelete === l.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deleting}
                          onClick={() => handleDelete(l.id)}
                          className="h-7 px-2 text-xs"
                        >
                          {deleting ? "…" : "Confirmar"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={deleting}
                          onClick={() => setConfirmDelete(null)}
                          className="h-7 px-2 text-xs"
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmDelete(l.id)}
                        className="h-7 w-7 p-0 text-zinc-500 hover:text-red-400"
                        title="Apagar lead"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
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
