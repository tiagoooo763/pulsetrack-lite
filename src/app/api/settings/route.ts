import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { setServerSetting } from "@/lib/db";
import { getOmegaPayServerCredentials } from "@/lib/omegapay-client";
import { processOmegaPayWebhook } from "@/lib/webhook-processor";
import { safeLog } from "@/lib/sanitize";

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "save_credentials";

    if (action === "simulate_webhook") {
      const event = String(body.event || "TRANSACTION_PAID");
      const txId = String(body.transactionId || `tr_${Date.now().toString(36)}`);
      const productName = String(body.productName || "Mentoria PulseTrack Pro");
      const grossAmount = Number(body.grossAmount ?? 297);
      const feeAmount = Number(body.feeAmount ?? 14.85);
      const netAmount = Math.max(0, Number((grossAmount - feeAmount).toFixed(2)));
      const paymentMethod = String(body.paymentMethod || "PIX");

      const creds = await getOmegaPayServerCredentials();
      const firstValidToken =
        creds.webhookToken.split(",")[0]?.trim() || "token_local_validacao";

      if (!creds.hasWebhookToken) {
        await setServerSetting("OMEGAPAY_WEBHOOK_TOKEN", firstValidToken);
      }

      const now = new Date().toISOString();

      let simulatedPayload: Record<string, unknown>;

      if (event.startsWith("TRANSFER_")) {
        const transferId = String(body.transferId || `wth_${Date.now().toString(36)}`);
        const transferStatus =
          event === "TRANSFER_COMPLETED"
            ? "COMPLETED"
            : event === "TRANSFER_FAILED"
              ? "CANCELED"
              : "PENDING";

        simulatedPayload = {
          event,
          token: firstValidToken,
          withdraw: {
            id: transferId,
            clientIdentifier: `saque-${transferId}`,
            amount: grossAmount,
            receivedAmount:
              transferStatus === "COMPLETED" ? netAmount : 0,
            feeAmount,
            currency: "BRL",
            status: transferStatus,
            message:
              transferStatus === "CANCELED"
                ? "Chave PIX inválida ou não encontrada"
                : null,
            createdAt: now,
            updatedAt: now,
          },
          payoutAccount: {
            id: "acc_sim",
            status: "ACTIVE",
            ownerName: "Produtor Teste",
            ownerDocument: "123.456.789-00",
            pix: "financeiro@exemplo.com",
            pixType: "email",
            accountType: "CHECKING",
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          },
          sents:
            transferStatus === "COMPLETED"
              ? [
                  {
                    id: `sent_${Date.now().toString(36)}`,
                    amount: netAmount,
                    status: "COMPLETED",
                    endToEndId: "E12345678901234567890",
                    createdAt: now,
                  },
                ]
              : [],
        };
      } else {
        const txStatus =
          event === "TRANSACTION_PAID"
            ? "COMPLETED"
            : event === "TRANSACTION_REFUNDED"
              ? "REFUNDED"
              : event === "TRANSACTION_CHARGED_BACK"
                ? "CHARGED_BACK"
                : "PENDING";

        simulatedPayload = {
          event,
          token: firstValidToken,
          offerCode: "OFERTA-PRO",
          checkoutUrl: "https://checkout.omegapayments.com.br/checkout/exemplo",
          client: {
            id: "cli_sim_01",
            name: "Cliente Teste",
            email: "cliente@exemplo.com",
            phone: "(11) 98888-7777",
            cpf: "123.456.789-10",
            cnpj: null,
          },
          fees: [
            {
              currency: "BRL",
              amount: feeAmount,
              description: "Taxa de operação checkout",
              type: "OPERATION",
            },
          ],
          transaction: {
            id: txId,
            identifier: `order_${txId}`,
            status: txStatus,
            paymentMethod,
            originalCurrency: "BRL",
            originalAmount: grossAmount,
            currency: "BRL",
            amount: grossAmount,
            chargeAmount: grossAmount,
            commissionAmount: netAmount,
            exchangeRate: 1,
            installments: paymentMethod === "CREDIT_CARD" ? 3 : 1,
            createdAt: now,
            payedAt: txStatus === "COMPLETED" ? now : null,
          },
          orderItems: [
            {
              id: `item_${txId}`,
              price: grossAmount,
              product: {
                id: "prod_001",
                name: productName,
                externalId: "PROD-001",
              },
            },
          ],
          subscription: null,
          trackProps: {
            utm_source: "direct",
          },
        };
      }

      const updatedCreds = await getOmegaPayServerCredentials();
      const result = await processOmegaPayWebhook(
        simulatedPayload,
        updatedCreds.webhookToken
      );

      return NextResponse.json({
        ok: result.ok,
        result,
      });
    }

    if (action === "save_quick_expense_preset") {
      const preset = body.preset as Record<string, unknown>;
      if (preset && typeof preset === "object") {
        const amount = Number(preset.amount);
        const title = String(preset.title || "Meta Ads").trim().slice(0, 100);
        const category = String(preset.category || "META_ADS");
        if (Number.isFinite(amount) && amount > 0) {
          await setServerSetting(
            "QUICK_EXPENSE_PRESET",
            JSON.stringify({ amount, title, category })
          );
          return NextResponse.json({ ok: true, preset: { amount, title, category } });
        }
      }
      return NextResponse.json({ error: "Preset inválido." }, { status: 400 });
    }

    // Salvar credenciais no servidor
    const publicKey =
      typeof body.publicKey === "string" ? body.publicKey.trim() : undefined;
    const secretKey =
      typeof body.secretKey === "string" ? body.secretKey.trim() : undefined;
    const webhookToken =
      typeof body.webhookToken === "string"
        ? body.webhookToken.trim()
        : undefined;
    const dashboardPassword =
      typeof body.dashboardPassword === "string"
        ? body.dashboardPassword.trim()
        : undefined;

    if (publicKey !== undefined && publicKey !== "") {
      await setServerSetting("OMEGAPAY_PUBLIC_KEY", publicKey);
    }
    if (secretKey !== undefined && secretKey !== "") {
      await setServerSetting("OMEGAPAY_SECRET_KEY", secretKey);
    }
    if (webhookToken !== undefined && webhookToken !== "") {
      await setServerSetting("OMEGAPAY_WEBHOOK_TOKEN", webhookToken);
    }
    if (dashboardPassword !== undefined && dashboardPassword.length >= 6) {
      await setServerSetting("DASHBOARD_PASSWORD", dashboardPassword);
    }

    safeLog("info", "Configurações de servidor atualizadas com segurança.");

    const updated = await getOmegaPayServerCredentials();
    return NextResponse.json({
      ok: true,
      integrationStatus: {
        hasApiCredentials: updated.hasApiCredentials,
        hasWebhookToken: updated.hasWebhookToken,
        source: updated.source,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Erro ao atualizar configurações no servidor." },
      { status: 500 }
    );
  }
}
