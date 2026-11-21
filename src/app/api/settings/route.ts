import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  saveBalanceSnapshot,
  setServerSetting,
  setUserSetting,
  updateUserProfile,
} from "@/lib/db";
import { getOmegaPayServerCredentials } from "@/lib/omegapay-client";
import { processOmegaPayWebhook } from "@/lib/webhook-processor";
import { processNexusWebhook } from "@/lib/nexus-processor";
import { safeLog } from "@/lib/sanitize";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const userId = user.id;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "save_credentials";

    // Simulação de Webhook OmegaPay (isolado por usuário)
    if (action === "simulate_webhook") {
      const event = String(body.event || "TRANSACTION_PAID");
      const txId = String(body.transactionId || `tr_${Date.now().toString(36)}`);
      const productName = String(body.productName || "Mentoria Dashfy Pro");
      const grossAmount = Number(body.grossAmount ?? 297);
      const feeAmount = Number(body.feeAmount ?? 14.85);
      const netAmount = Math.max(0, Number((grossAmount - feeAmount).toFixed(2)));
      const paymentMethod = String(body.paymentMethod || "PIX");

      const creds = await getOmegaPayServerCredentials(userId);
      const firstValidToken =
        creds.webhookToken.split(",")[0]?.trim() || "token_local_validacao";

      if (!creds.hasWebhookToken) {
        await setUserSetting(userId, "OMEGAPAY_WEBHOOK_TOKEN", firstValidToken);
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
            receivedAmount: transferStatus === "COMPLETED" ? netAmount : 0,
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

      const updatedCreds = await getOmegaPayServerCredentials(userId);
      const result = await processOmegaPayWebhook(
        simulatedPayload,
        updatedCreds.webhookToken,
        userId
      );

      return NextResponse.json({
        ok: result.ok,
        result,
      });
    }

    // Simulação de Webhook Nexus Pay
    if (action === "simulate_nexus_webhook") {
      const event = String(body.event || "TRANSACTION_PAID");
      const txId = String(body.transactionId || `nex_${Date.now().toString(36)}`);
      const productName = String(body.productName || "Mentoria Nexus Pro");
      const grossAmount = Number(body.grossAmount ?? 197);
      const feeAmount = Number(body.feeAmount ?? 9.85);
      const netAmount = Math.max(0, Number((grossAmount - feeAmount).toFixed(2)));
      const paymentMethod = String(body.paymentMethod || "PIX");

      const simulatedPayload = {
        event,
        data: {
          id: txId,
          order_id: `ord_${txId}`,
          status: event.includes("PAID")
            ? "paid"
            : event.includes("REFUND")
              ? "refunded"
              : "pending",
          amount: grossAmount,
          fee: feeAmount,
          net_amount: netAmount,
          payment_method: paymentMethod,
          product: {
            name: productName,
          },
          customer: {
            name: "Cliente Nexus Teste",
            email: "nexus.cliente@exemplo.com",
          },
          created_at: new Date().toISOString(),
        },
      };

      const result = await processNexusWebhook(simulatedPayload, undefined, userId);
      return NextResponse.json({
        ok: result.ok,
        result,
      });
    }

    // Atualização manual de Saldo Nexus
    if (action === "update_nexus_balance") {
      const available = Number(body.available ?? 0);
      const pending = Number(body.pending ?? 0);
      const fundLock = Number(body.fundLock ?? 0);

      const saved = await saveBalanceSnapshot(
        { available, pending, fundLock },
        "NEXUS",
        userId
      );

      return NextResponse.json({
        ok: true,
        balance: saved,
      });
    }

    // Salvar credenciais exclusivas da Nexus
    if (action === "save_nexus_credentials") {
      const nexusApiKey =
        typeof body.nexusApiKey === "string" ? body.nexusApiKey.trim() : undefined;
      const nexusSecretKey =
        typeof body.nexusSecretKey === "string" ? body.nexusSecretKey.trim() : undefined;
      const nexusWebhookToken =
        typeof body.nexusWebhookToken === "string"
          ? body.nexusWebhookToken.trim()
          : undefined;

      if (nexusApiKey !== undefined && nexusApiKey !== "") {
        await setUserSetting(userId, "NEXUS_API_KEY", nexusApiKey);
      }
      if (nexusSecretKey !== undefined && nexusSecretKey !== "") {
        await setUserSetting(userId, "NEXUS_SECRET_KEY", nexusSecretKey);
      }
      if (nexusWebhookToken !== undefined && nexusWebhookToken !== "") {
        await setUserSetting(userId, "NEXUS_WEBHOOK_TOKEN", nexusWebhookToken);
      }

      return NextResponse.json({
        ok: true,
        message: "Credenciais da Nexus salvas com sucesso no servidor.",
      });
    }

    // Salvar nomes e modos das abas de Dashboards
    if (action === "save_dashboards_config") {
      const rawList = body.dashboards;
      if (Array.isArray(rawList) && rawList.length > 0 && rawList.length <= 10) {
        const sanitized = rawList
          .map((item) => {
            const o = (item || {}) as Record<string, unknown>;
            const id = String(o.id || "").trim().slice(0, 60);
            const name = String(o.name || "").trim().slice(0, 60);
            const mode = o.mode === "omegapay" ? "omegapay" : "tiktok";
            return id && name ? { id, name, mode } : null;
          })
          .filter(Boolean);

        if (sanitized.length > 0) {
          await setUserSetting(
            userId,
            "DASHFY_DASHBOARDS_CONFIG",
            JSON.stringify(sanitized)
          );
          return NextResponse.json({
            ok: true,
            dashboards: sanitized,
            message: "Abas atualizadas com sucesso.",
          });
        }
      }
      return NextResponse.json(
        { error: "Configuração de abas inválida." },
        { status: 400 }
      );
    }

    // Habilitar/Desabilitar sincronização OmegaPay
    if (action === "toggle_omegapay_sync") {
      const enabled = Boolean(body.enabled);
      await setUserSetting(userId, "OMEGAPAY_SYNC_ENABLED", enabled ? "true" : "false");
      return NextResponse.json({
        ok: true,
        syncEnabled: enabled,
        message: enabled
          ? "Sincronização com a OmegaPay habilitada."
          : "Sincronização com a OmegaPay pausada.",
      });
    }

    // Atualizar perfil do usuário (Minha Conta)
    if (action === "update_profile") {
      const displayName =
        typeof body.displayName === "string" ? body.displayName.trim().slice(0, 80) : "";
      const companyName =
        typeof body.companyName === "string" ? body.companyName.trim().slice(0, 80) : "";

      const updatedProfile = await updateUserProfile(userId, {
        displayName: displayName || undefined,
        companyName: companyName || undefined,
      });

      return NextResponse.json({
        ok: true,
        profile: updatedProfile,
        message: "Perfil atualizado com sucesso.",
      });
    }

    // Atualizar preferências de notificações
    if (action === "update_notifications") {
      const prefs = body.prefs;
      if (prefs && typeof prefs === "object") {
        await setUserSetting(userId, "NOTIFICATION_PREFS", JSON.stringify(prefs));
        return NextResponse.json({
          ok: true,
          message: "Preferências de notificação salvas.",
        });
      }
      return NextResponse.json({ error: "Preferências inválidas." }, { status: 400 });
    }

    // Preset rápido de despesa
    if (action === "save_quick_expense_preset") {
      const preset = body.preset as Record<string, unknown>;
      if (preset && typeof preset === "object") {
        const amount = Number(preset.amount);
        const title = String(preset.title || "Meta Ads").trim().slice(0, 100);
        const category = String(preset.category || "META_ADS");
        if (Number.isFinite(amount) && amount > 0) {
          await setUserSetting(
            userId,
            "QUICK_EXPENSE_PRESET",
            JSON.stringify({ amount, title, category })
          );
          return NextResponse.json({ ok: true, preset: { amount, title, category } });
        }
      }
      return NextResponse.json({ error: "Preset inválido." }, { status: 400 });
    }

    // Salvar credenciais padrão / OmegaPay + alteração de senha
    const publicKey =
      typeof body.publicKey === "string" ? body.publicKey.trim() : undefined;
    const secretKey =
      typeof body.secretKey === "string" ? body.secretKey.trim() : undefined;
    const webhookToken =
      typeof body.webhookToken === "string" ? body.webhookToken.trim() : undefined;
    const dashboardPassword =
      typeof body.dashboardPassword === "string"
        ? body.dashboardPassword.trim()
        : undefined;

    if (publicKey !== undefined && publicKey !== "") {
      await setUserSetting(userId, "OMEGAPAY_PUBLIC_KEY", publicKey);
    }
    if (secretKey !== undefined && secretKey !== "") {
      await setUserSetting(userId, "OMEGAPAY_SECRET_KEY", secretKey);
    }
    if (webhookToken !== undefined && webhookToken !== "") {
      await setUserSetting(userId, "OMEGAPAY_WEBHOOK_TOKEN", webhookToken);
    }

    if (dashboardPassword !== undefined && dashboardPassword !== "") {
      if (dashboardPassword.length < 8) {
        return NextResponse.json(
          { error: "A nova senha deve ter no mínimo 8 caracteres." },
          { status: 400 }
        );
      }

      if (user.authProvider === "supabase") {
        const supabase = await createSupabaseServerClient();
        if (!supabase) {
          return NextResponse.json(
            { error: "Serviço de autenticação indisponível." },
            { status: 503 }
          );
        }
        const { error: updateErr } = await supabase.auth.updateUser({
          password: dashboardPassword,
        });
        if (updateErr) {
          return NextResponse.json(
            { error: "Não foi possível atualizar a senha. Tente uma senha mais forte." },
            { status: 400 }
          );
        }
      } else {
        await setServerSetting("DASHBOARD_PASSWORD", dashboardPassword);
      }
    }

    safeLog("info", "Configurações do usuário atualizadas com segurança.");

    const updated = await getOmegaPayServerCredentials(userId);
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
