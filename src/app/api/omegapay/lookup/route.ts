import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
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

/**
 * Consulta pontual (sem polling) aos endpoints oficiais:
 * - Buscar transação: GET /api/v1/gateway/transactions?id=...&clientIdentifier=...
 * - Buscar transferência: GET /api/v1/gateway/transfers?id=...&clientIdentifier=...
 */
export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "transaction";
  const id = searchParams.get("id") || undefined;
  const clientIdentifier = searchParams.get("clientIdentifier") || undefined;
  const syncToDb = searchParams.get("sync") !== "false";

  try {
    if (type === "transfer") {
      const transfer = await fetchOmegaPayTransfer({ id, clientIdentifier });
      const sanitized = sanitizeData(transfer);

      if (syncToDb && transfer.id) {
        const sentCompleted = Array.isArray(transfer.withdrawSent)
          ? transfer.withdrawSent
              .filter((s) => s.status === "COMPLETED")
              .reduce((sum, s) => sum + Number(s.amount || 0), 0)
          : 0;

        await upsertTransfer({
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
      });
    }

    const tx = await fetchOmegaPayTransaction({ id, clientIdentifier });
    const sanitized = sanitizeData(tx);

    if (syncToDb && tx.id) {
      const resolvedStatus = resolveTransactionStatus(
        "API_LOOKUP",
        tx.status
      );
      const grossAmount = Number(tx.chargeAmount || tx.amount || 0);
      const netAmount = Number(tx.amount || 0);
      const feeAmount = Math.max(
        0,
        Number((grossAmount - netAmount).toFixed(2))
      );

      await upsertTransaction({
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
