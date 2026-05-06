import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Mantém só dígitos. */
export function onlyDigits(value: string): string {
  return value.replace(/\D+/g, "");
}

/** Formata um telefone BR no padrão (XX) XXXXX-XXXX enquanto o usuário digita. */
export function formatPhoneBR(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  const len = digits.length;
  if (len === 0) return "";
  if (len < 3) return `(${digits}`;
  if (len < 8) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (len <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Telefone é considerado válido com 10 ou 11 dígitos (DDD + número). */
export function isValidPhoneBR(value: string): boolean {
  const d = onlyDigits(value);
  return d.length === 10 || d.length === 11;
}

/** Escapa um campo para CSV (RFC 4180). */
function csvField(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCSV(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.map(csvField).join(",");
  const body = rows
    .map((row) => columns.map((c) => csvField(row[c])).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

export function classifyOriginCount(numbers: { origin: string }[]) {
  const cadastro = numbers.filter((n) => n.origin === "cadastro").length;
  const indicacao = numbers.filter((n) => n.origin === "indicacao").length;
  return { cadastro, indicacao, total: numbers.length };
}
