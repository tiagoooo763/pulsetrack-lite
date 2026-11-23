/**
 * Utilitários seguros para normalização e validação de datas/timestamps em ISO 8601 UTC.
 * Previne erros PostgreSQL 22007 (`invalid input syntax for type timestamp with time zone`)
 * causados por Date.prototype.toString() (ex.: "Sun Nov 22 2026 17:54:15 GMT+0000 (...)").
 */

const MIN_VALID_YEAR = 2000;
const MAX_VALID_YEAR = 2100;

function isReasonableDate(d: Date): boolean {
  const ms = d.getTime();
  if (!Number.isFinite(ms)) return false;
  const year = d.getUTCFullYear();
  return year >= MIN_VALID_YEAR && year <= MAX_VALID_YEAR;
}

/**
 * Normaliza formatos textuais do PostgreSQL (ex.: "2026-11-22 17:54:15.123456+00"
 * ou "2026-11-22 14:54:15-03") para ISO 8601 parseável de forma consistente pelo V8.
 */
function normalizeDateInputString(raw: string): string {
  let out = raw.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(out)) {
    out = out.replace(" ", "T");
  }
  // Converte offset curto do Postgres ("+00", "-03") para "+00:00" / "-03:00"
  if (/[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?[+-]\d{2}$/.test(out)) {
    out = `${out}:00`;
  } else if (/[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?[+-]\d{4}$/.test(out)) {
    out = out.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  }
  return out;
}

/**
 * Converte qualquer valor de data (Date, ISO string, timestamp PG ou RFC-2822)
 * para uma string ISO 8601 UTC válida (`YYYY-MM-DDTHH:mm:ss.sssZ`).
 */
export function toIsoTimestamp(
  value: unknown,
  fallback?: string
): string {
  const safeFallback = fallback ?? new Date().toISOString();
  if (value === null || value === undefined || value === "") {
    return safeFallback;
  }

  if (value instanceof Date) {
    return isReasonableDate(value) ? value.toISOString() : safeFallback;
  }

  if (typeof value === "number") {
    const d = new Date(value);
    return isReasonableDate(d) ? d.toISOString() : safeFallback;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return safeFallback;

    const d = new Date(normalizeDateInputString(trimmed));
    if (isReasonableDate(d)) {
      return d.toISOString();
    }
  }

  return safeFallback;
}

export function toNullableIsoTimestamp(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    return isReasonableDate(value) ? value.toISOString() : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const d = new Date(normalizeDateInputString(trimmed));
    return isReasonableDate(d) ? d.toISOString() : null;
  }
  return null;
}

export type ParseTimestampParamResult =
  | { valid: true; iso: string | null }
  | { valid: false; error: string };

/**
 * Valida e normaliza parâmetros de data recebidos via querystring/body antes de executar SQL.
 * Aceita ISO 8601 com ou sem offset (ex.: -03:00, Z) e strings GMT legadas, convertendo sempre para ISO UTC.
 * Rejeita valores inválidos sem enviar ao PostgreSQL.
 */
export function parseIsoTimestampParam(
  raw: string | null | undefined
): ParseTimestampParamResult {
  if (raw === null || raw === undefined || raw.trim() === "") {
    return { valid: true, iso: null };
  }

  const trimmed = raw.trim();
  if (trimmed.length > 100) {
    return { valid: false, error: "Parâmetro de data inválido (muito longo)." };
  }

  // Rejeita strings puramente numéricas arbitrárias como "12345" ou palavras soltas
  if (/^\d+$/.test(trimmed) && trimmed.length < 10) {
    return { valid: false, error: "Formato de data inválido. Utilize ISO 8601." };
  }

  const parsed = new Date(normalizeDateInputString(trimmed));
  if (!isReasonableDate(parsed)) {
    return {
      valid: false,
      error: "Formato de data inválido. Utilize ISO 8601 (ex.: 2026-11-22T18:00:00.000Z).",
    };
  }

  return { valid: true, iso: parsed.toISOString() };
}

/**
 * Compara duas datas em milissegundos (nunca lexicograficamente).
 * Retorna o maior timestamp em formato ISO 8601 UTC.
 */
export function maxIsoTimestamp(a: string | null | undefined, b: string): string {
  const isoB = toIsoTimestamp(b);
  if (!a) return isoB;
  const isoA = toNullableIsoTimestamp(a);
  if (!isoA) return isoB;
  return Date.parse(isoA) > Date.parse(isoB) ? isoA : isoB;
}
