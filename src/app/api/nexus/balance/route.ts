import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getLatestBalanceSnapshot,
  getUserSetting,
  saveBalanceSnapshot,
} from "@/lib/db";
import { safeLog } from "@/lib/sanitize";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const balance = await getLatestBalanceSnapshot("NEXUS", user.id);
  return NextResponse.json({ ok: true, balance });
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const userId = user.id;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    // 1. Atualização manual de saldo informada pelo usuário
    if (typeof body.available === "number" || typeof body.available === "string") {
      const available = Number(body.available) || 0;
      const pending = Number(body.pending) || 0;
      const fundLock = Number(body.fundLock ?? body.fund_lock) || 0;

      const saved = await saveBalanceSnapshot(
        {
          available,
          pending,
          fundLock,
        },
        "NEXUS",
        userId
      );

      safeLog("info", "Saldo da Nexus atualizado com sucesso.", {
        available,
        gateway: "NEXUS",
      });

      return NextResponse.json({
        ok: true,
        balance: saved,
        message: "Saldo da Nexus atualizado com sucesso.",
      });
    }

    // 2. Sincronização automática com a API da Nexus (credenciais exclusivas do usuário)
    const nexusApiKey = await getUserSetting(userId, "NEXUS_API_KEY");
    const nexusSecretKey = await getUserSetting(userId, "NEXUS_SECRET_KEY");

    if (!nexusApiKey) {
      const current = await getLatestBalanceSnapshot("NEXUS", userId);
      return NextResponse.json({
        ok: false,
        error:
          "Chave de API da Nexus não cadastrada. Insira a chave em Integração & API ou informe o saldo manualmente.",
        balance: current,
      });
    }

    try {
      const apiUrl =
        (await getUserSetting(userId, "NEXUS_API_URL")) ||
        "https://api.nexuspay.com.br/v1/balance";
      const apiRes = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${nexusApiKey}`,
          "x-secret-key": nexusSecretKey || "",
        },
      });

      if (apiRes.ok) {
        const json = await apiRes.json();
        const available = Number(json.available ?? json.data?.available ?? 0);
        const pending = Number(json.pending ?? json.data?.pending ?? 0);
        const fundLock = Number(json.fund_lock ?? json.data?.fund_lock ?? 0);

        const saved = await saveBalanceSnapshot(
          { available, pending, fundLock },
          "NEXUS",
          userId
        );

        return NextResponse.json({
          ok: true,
          balance: saved,
          message: "Saldo sincronizado diretamente com a API da Nexus.",
        });
      }
    } catch {
      // Falha de rede na API da Nexus
    }

    const current = await getLatestBalanceSnapshot("NEXUS", userId);
    return NextResponse.json({
      ok: false,
      error:
        "Não foi possível consultar a API da Nexus automaticamente. Você pode lançar o saldo disponível diretamente.",
      balance: current,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
