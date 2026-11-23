import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { listSaleNotificationsSince } from "@/lib/db";
import {
  maxIsoTimestamp,
  parseIsoTimestampParam,
} from "@/lib/date-utils";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

/**
 * Endpoint leve de notificações de VENDAS APROVADAS pertencentes ao usuário autenticado.
 * - `?init=1`: retorna apenas o watermark atual em ISO 8601 UTC (`serverNow`) sem disparar alertas antigos.
 * - `?since=<ISO>`: valida e normaliza a data em ISO 8601 UTC antes do SQL (evita erro PostgreSQL 22007)
 *   e retorna somente novas vendas aprovadas após o watermark da sessão.
 */
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  const { searchParams } = new URL(request.url);
  const isInit = searchParams.get("init") === "1";
  const rawSince = searchParams.get("since");
  const rawLimit = Number(searchParams.get("limit") || 20);
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(50, Math.round(rawLimit)))
    : 20;

  const serverNow = new Date().toISOString();

  if (isInit) {
    const recent = await listSaleNotificationsSince(user.id, null, 1);
    const latestTs = recent[0]?.createdAt ?? null;
    return NextResponse.json(
      {
        ok: true,
        serverNow: maxIsoTimestamp(latestTs, serverNow),
        events: [],
      },
      { headers: NO_STORE_HEADERS }
    );
  }

  const parsedSince = parseIsoTimestampParam(rawSince);
  if (!parsedSince.valid) {
    return NextResponse.json(
      {
        ok: false,
        error: parsedSince.error,
      },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const events = await listSaleNotificationsSince(
    user.id,
    parsedSince.iso,
    limit
  );
  const latestEventTs =
    events.length > 0 ? events[events.length - 1]?.createdAt : null;

  return NextResponse.json(
    {
      ok: true,
      serverNow: maxIsoTimestamp(latestEventTs, serverNow),
      events,
    },
    { headers: NO_STORE_HEADERS }
  );
}
