import { describe, it, expect } from "vitest";
import {
  computeOmegaPaySummary,
  computeTikTokSummary,
  parseTikTokCsv,
} from "@/lib/dashfy-metrics";
import type {
  CustomFeeRecord,
  ManualExpenseRecord,
  TikTokCampaignRecord,
  TransactionRecord,
} from "@/lib/db";

describe("Dashfy — Separação de Operações (TikTok vs OmegaPay) & CSV Parser", () => {
  it("importa corretamente CSV do TikTok Ads em formato PT-BR (ponto e vírgula)", () => {
    const csv = [
      "Data;Conta;Campanha;Conjunto;Anuncio;Produto;Investimento;Impressoes;Cliques;Conversoes;Receita;Status",
      "21/11/2026;Conta 01;[TT] Escala A;Aberto 18-44;UGC 01;Produto X;200,50;10000;250;5;750,00;ACTIVE",
    ].join("\n");

    const rows = parseTikTokCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].statDate).toBe("2026-11-21");
    expect(rows[0].campaignName).toBe("[TT] Escala A");
    expect(rows[0].spend).toBe(200.5);
    expect(rows[0].impressions).toBe(10000);
    expect(rows[0].clicks).toBe(250);
    expect(rows[0].conversions).toBe(5);
    expect(rows[0].attributedRevenue).toBe(750);
  });

  it("calcula métricas da Operação TikTok separando Receita Atribuída e Lucro Estimado", () => {
    const campaigns: TikTokCampaignRecord[] = [
      {
        id: "c1",
        adAccount: "Conta 01",
        campaignName: "Campanha Escala",
        adgroupName: "Conjunto 1",
        adName: "Criativo 1",
        productName: "Curso Pro",
        utmSource: "tiktok",
        utmMedium: "cpc",
        utmCampaign: "camp_escala",
        utmContent: "criativo_1",
        statDate: "2026-11-21",
        spend: 200,
        impressions: 20000,
        clicks: 400,
        conversions: 5,
        attributedRevenue: 1000,
        status: "ACTIVE",
        createdAt: "2026-11-21T10:00:00Z",
        updatedAt: "2026-11-21T10:00:00Z",
      },
    ];
    const expenses: ManualExpenseRecord[] = [
      {
        id: "e1",
        gateway: "ALL",
        dashboardId: "tiktok",
        campaignName: "Campanha Escala",
        category: "TOOLS",
        title: "Editor Criativo",
        amount: 50,
        expenseDate: "2026-11-21",
        notes: null,
        createdAt: "2026-11-21T10:00:00Z",
      },
    ];
    const fees: CustomFeeRecord[] = [
      {
        id: "f1",
        dashboardId: "tiktok",
        name: "Imposto 6%",
        category: "TAX",
        feeType: "PERCENTAGE",
        value: 6,
        feeDate: "2026-11-21",
        campaignName: null,
        notes: null,
        createdAt: "2026-11-21T10:00:00Z",
      },
    ];

    const summary = computeTikTokSummary(campaigns, expenses, fees);
    expect(summary.grossRevenue).toBe(1000); // Receita Atribuída
    expect(summary.customFeesTotal).toBe(60); // 6% de 1000
    expect(summary.netRevenue).toBe(940);
    expect(summary.adExpenses).toBe(200);
    expect(summary.otherExpenses).toBe(50);
    expect(summary.profit).toBe(690); // Lucro Estimado = 940 - 200 - 50
    expect(summary.roas).toBe(5); // 1000 / 200
    expect(summary.cpc).toBe(0.5); // 200 / 400
    expect(summary.cpm).toBe(10); // (200 / 20000) * 1000
  });

  it("calcula métricas isoladas da Operação OmegaPay com taxas e aprovação", () => {
    const txs: TransactionRecord[] = [
      {
        id: "tx1",
        gateway: "OMEGAPAY",
        clientIdentifier: null,
        orderId: "ord_1",
        productId: "p1",
        productName: "Mentoria VIP",
        offerCode: null,
        paymentMethod: "PIX",
        currency: "BRL",
        grossAmount: 500,
        feeAmount: 25,
        netAmount: 475,
        status: "COMPLETED",
        lastEvent: "TRANSACTION_PAID",
        installments: 1,
        createdAt: "2026-11-21T10:00:00Z",
        paidAt: "2026-11-21T10:01:00Z",
        updatedAt: "2026-11-21T10:01:00Z",
      },
      {
        id: "tx2",
        gateway: "OMEGAPAY",
        clientIdentifier: null,
        orderId: "ord_2",
        productId: "p1",
        productName: "Mentoria VIP",
        offerCode: null,
        paymentMethod: "PIX",
        currency: "BRL",
        grossAmount: 500,
        feeAmount: 0,
        netAmount: 0,
        status: "PENDING",
        lastEvent: "TRANSACTION_CREATED",
        installments: 1,
        createdAt: "2026-11-21T11:00:00Z",
        paidAt: null,
        updatedAt: "2026-11-21T11:00:00Z",
      },
    ];

    const summary = computeOmegaPaySummary(txs, [], [], []);
    expect(summary.grossRevenue).toBe(500);
    expect(summary.netRevenue).toBe(475);
    expect(summary.pendingCount).toBe(1);
    expect(summary.pendingAmount).toBe(500);
    expect(summary.approvalRate).toBe(50);
    expect(summary.productBreakdown[0].productName).toBe("Mentoria VIP");
  });
});
