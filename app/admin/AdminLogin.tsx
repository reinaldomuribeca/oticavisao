"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, Loader2 } from "lucide-react";

export function AdminLogin({ nextPath }: { nextPath?: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (r.status === 401) {
        setError("Senha incorreta.");
        setLoading(false);
        return;
      }
      if (!r.ok) {
        setError("Erro ao autenticar.");
        setLoading(false);
        return;
      }
      window.location.href = nextPath ?? "/admin";
    } catch {
      setError("Falha de conexão.");
      setLoading(false);
    }
  }

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="absolute inset-0 -z-10 bg-radial-gold opacity-50" />

      <Card className="w-full max-w-md p-8">
        <CardContent className="p-0">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 text-gold">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="font-display text-3xl font-extrabold uppercase">
            Painel <span className="text-gold">Admin</span>
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Acesso restrito. Informe a senha para continuar.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            {error && (
              <p className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ENTRANDO...
                </>
              ) : (
                "ENTRAR"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
