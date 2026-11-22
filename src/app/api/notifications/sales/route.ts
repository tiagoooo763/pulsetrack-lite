import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { listSaleNotificationsSince } from "@/lib/db";

/**
 * Endpoint leve de notificações de VENDAS APROVADAS pertencentes ao usuário autenticado.
 * - `?init=1`: retorna apenas o watermark atual (`serverNow`) sem disparar alertas antigos.
 * - `?since=<ISO>`: retorna somente novas vendas aprovadas após o watermark da sessão.
 */
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const isInit = searchParams.get("init") === "1";
  const since = searchParams.get("since")?.trim() || null;
  const serverNow = new Date().toISOString();

  if (isInit) {
    const recent = await listSaleNotificationsSince(user.id, null, 1);
    const latestTs = recent[0]?.createdAt;
    return NextResponse.json({
      ok: true,
      serverNow: latestTs && latestTs > serverNow ? latestTs : serverNow,
      events: [],
    });
  }

  const events = await listSaleNotificationsSince(user.id, since, 20);
  const latestEventTs =
    events.length > 0 ? events[events.length - 1]?.createdAt : null;

  return NextResponse.json({
    ok: true,
    serverNow:
      latestEventTs && latestEventTs > serverNow ? latestEventTs : serverNow,
    events,
  });
}
