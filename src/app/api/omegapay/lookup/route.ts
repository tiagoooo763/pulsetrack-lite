import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  resolveTransactionStatus,
  upsertTransaction,
  upsertTransfer,
} from "@/lib/db";
import {
  fetchOmegaPayTransaction,
  fetchOmegaPayTransfer,
  OmegaPayApiError,
} from "@/lib/omegapay-client";
import { sanitizeData, safeLog } from "@/lib/sanitize";

async function runLookup(params: {
  userId: string;
  type: string;
  id?: string;
  clientIdentifier?: string;
  syncToDb: boolean;
}) {
  const { userId, type, id, clientIdentifier, syncToDb } = params;

  try {
    if (type === "transfer") {
      const transfer = await fetchOmegaPayTransfer({ id, clientIdentifier }, userId);
      const sanitized = sanitizeData(transfer);

      if (syncToDb && transfer.id) {
        const sentCompleted = Array.isArray(transfer.withdrawSent)
          ? transfer.withdrawSent
              .filter((s) => s.status === "COMPLETED")
              .reduce((sum, s) => sum + Number(s.amount || 0), 0)
          : 0;

        await upsertTransfer({
          userId,
          id: transfer.id,
          clientIdentifier: transfer.clientIdentifier,
          amount: Number(transfer.amount || 0),
          receivedAmount:
            transfer.status === "COMPLETED"
              ? sentCompleted > 0
                ? sentCompleted
                : Number(transfer.amount || 0)
              : 0,
          feeAmount: 0,
          currency: transfer.currency || "BRL",
          status: transfer.status,
          lastEvent: "API_LOOKUP",
          message: transfer.rejectedReason ?? null,
          createdAt: transfer.createdAt,
          updatedAt: transfer.updatedAt,
        });
      }

      return NextResponse.json({
        ok: true,
        type: "transfer",
        result: sanitized,
        data: sanitized,
      });
    }

    const tx = await fetchOmegaPayTransaction({ id, clientIdentifier }, userId);
    const sanitized = sanitizeData(tx);

    if (syncToDb && tx.id) {
      const resolvedStatus = resolveTransactionStatus("API_LOOKUP", tx.status);
      const grossAmount = Number(tx.chargeAmount || tx.amount || 0);
      const netAmount = Number(tx.amount || 0);
      const feeAmount = Math.max(0, Number((grossAmount - netAmount).toFixed(2)));

      await upsertTransaction({
        userId,
        id: tx.id,
        clientIdentifier: tx.clientIdentifier,
        paymentMethod: tx.paymentMethod || "PIX",
        currency: tx.currency || "BRL",
        grossAmount,
        feeAmount: feeAmount > 0 ? feeAmount : null,
        netAmount: feeAmount > 0 ? netAmount : null,
        status: resolvedStatus,
        lastEvent: "API_LOOKUP",
        createdAt: tx.createdAt,
        paidAt: tx.payedAt,
      });
    }

    return NextResponse.json({
      ok: true,
      type: "transaction",
      result: sanitized,
      data: sanitized,
    });
  } catch (err: unknown) {
    if (err instanceof OmegaPayApiError) {
      safeLog("warn", "Falha na consulta pontual à API OmegaPay.", {
        type,
        statusCode: err.statusCode,
        errorCode: err.errorCode,
      });
      return NextResponse.json(
        {
          ok: false,
          error: err.message,
          errorCode: err.errorCode,
        },
        { status: err.statusCode }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Erro inesperado ao realizar consulta na OmegaPay.",
      },
      { status: 500 }
    );
  }
}

/**
 * Consulta pontual (sem polling) aos endpoints oficiais:
 * - Buscar transação: GET /api/v1/gateway/transactions?id=...&clientIdentifier=...
 * - Buscar transferência: GET /api/v1/gateway/transfers?id=...&clientIdentifier=...
 */
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "transaction";
  const id = searchParams.get("id") || undefined;
  const clientIdentifier = searchParams.get("clientIdentifier") || undefined;
  const syncToDb = searchParams.get("sync") !== "false";

  return runLookup({
    userId: user.id,
    type,
    id,
    clientIdentifier,
    syncToDb,
  });
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const type = typeof body.type === "string" ? body.type : "transaction";
  const field = typeof body.field === "string" ? body.field : undefined;
  const value = typeof body.value === "string" ? body.value.trim() : undefined;

  let id = typeof body.id === "string" ? body.id.trim() : undefined;
  let clientIdentifier =
    typeof body.clientIdentifier === "string"
      ? body.clientIdentifier.trim()
      : undefined;

  if (value && field === "clientIdentifier") {
    clientIdentifier = value;
  } else if (value && !id) {
    id = value;
  }

  const syncToDb = body.sync !== false;

  return runLookup({
    userId: user.id,
    type,
    id,
    clientIdentifier,
    syncToDb,
  });
}
