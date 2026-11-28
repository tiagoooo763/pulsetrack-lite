import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createClient, type Client as LibSqlClient } from "@libsql/client";
import { Pool, types as pgTypes } from "pg";

// Garante que colunas DATE do PostgreSQL retornem strings 'YYYY-MM-DD' sem distorção de fuso horário
try {
  pgTypes.setTypeParser(1082, (val: string) => val);
} catch {
  // Ignora se types não estiver acessível
}
import {
  type OmegaPayBalanceResponse,
  type OmegaPayTransactionStatus,
  type OmegaPayTransferStatus,
} from "./omegapay-types";
import {
  DEFAULT_SOUND_PREFERENCES,
  isValidSoundId,
  normalizeSoundVolume,
  type NotificationSoundId,
  type SaleNotificationEvent,
  type UserSoundPreferences,
} from "./notification-sounds";
import {
  parseIsoTimestampParam,
  toIsoTimestamp,
  toNullableIsoTimestamp,
} from "./date-utils";

// Garante que colunas DATE, TIMESTAMP e TIMESTAMPTZ do PostgreSQL retornem strings ISO 8601
// (evita que pg retorne Date e String(date) gere "Sun Nov 22 ... GMT+0000" -> erro PG 22007)
try {
  pgTypes.setTypeParser(1082, (val: string) => val);
  pgTypes.setTypeParser(1184, (val: string) => toIsoTimestamp(val));
  pgTypes.setTypeParser(1114, (val: string) =>
    toIsoTimestamp(val.endsWith("Z") ? val : `${val.replace(" ", "T")}Z`)
  );
} catch {
  // Ignora se types não estiver acessível
}

export type {
  OmegaPayBalanceResponse,
  OmegaPayTransactionStatus,
  OmegaPayTransferStatus,
};

export type GatewayId = "OMEGAPAY" | "NEXUS" | "ELEVYPAY";
export type GatewayIntegrationStatus = "DISCONNECTED" | "CONNECTED" | "ERROR";
export type GatewayWebhookAuthMode =
  | "DASHFY_TOKEN"
  | "GATEWAY_TOKEN"
  | "HMAC_SHA256";
export type DashboardOperationMode = "tiktok" | "omegapay";
export type DashboardOperationId = string;

export function normalizeGatewayId(raw: unknown): GatewayId {
  const upper = String(raw || "OMEGAPAY").trim().toUpperCase();
  if (upper === "NEXUS") return "NEXUS";
  if (upper === "ELEVYPAY") return "ELEVYPAY";
  return "OMEGAPAY";
}

export interface GatewayIntegrationRecord {
  id: string;
  userId: string;
  gateway: GatewayId;
  status: GatewayIntegrationStatus;
  authMode: GatewayWebhookAuthMode;
  webhookUrlSlug: string;
  webhookSecretEnc: string | null;
  externalTokenEnc: string | null;
  lastEventAt: string | null;
  lastEventType: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionStatusHistoryRecord {
  id: string;
  userId: string;
  transactionId: string;
  gateway: GatewayId;
  previousStatus: string | null;
  newStatus: string;
  eventType: string;
  source: string;
  createdAt: string;
}

export const LEGACY_ADMIN_USER_ID = "legacy:mendoncat831@gmail.com";

export interface UserProfileRecord {
  id: string;
  email: string;
  displayName: string;
  companyName: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardConfigRecord {
  id: string;
  name: string;
  mode: DashboardOperationMode;
}

export interface TikTokAdvertiserSummary {
  advertiserId: string;
  advertiserName: string;
  currency?: string;
  status?: string;
  bcId?: string | null;
}

export interface TikTokBusinessCenterSummary {
  bcId: string;
  name: string;
  currency?: string;
  status?: string;
  role?: string;
}

export interface TikTokConnectionPublicRecord {
  id: string;
  dashboardId: string;
  label: string;
  status: "ACTIVE" | "ERROR" | "REVOKED";
  scope: string[];
  advertisers: TikTokAdvertiserSummary[];
  businessCenters: TikTokBusinessCenterSummary[];
  lastError: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TikTokConnectionInternalRecord
  extends TikTokConnectionPublicRecord {
  userId: string;
  accessTokenEnc: string;
}

export type ExpenseCategory =
  | "META_ADS"
  | "TIKTOK_ADS"
  | "OTHER_ADS"
  | "TOOLS"
  | "OTHER";

export type FeeCategory = "GATEWAY" | "TAX" | "PLATFORM" | "OTHER";
export type FeeType = "FIXED" | "PERCENTAGE";

export interface TikTokCampaignRecord {
  id: string;
  dashboardId: string;
  adAccount: string;
  campaignName: string;
  adgroupName: string;
  adName: string;
  productName: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  statDate: string; // YYYY-MM-DD
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  attributedRevenue: number;
  status: "ACTIVE" | "PAUSED";
  createdAt: string;
  updatedAt: string;
}

export interface CustomFeeRecord {
  id: string;
  dashboardId: DashboardOperationId;
  name: string;
  category: FeeCategory;
  feeType: FeeType;
  value: number;
  feeDate: string; // YYYY-MM-DD
  campaignName: string | null;
  notes: string | null;
  createdAt: string;
}

export interface AutomationRuleRecord {
  id: string;
  dashboardId: DashboardOperationId;
  name: string;
  metric: "ROAS" | "CPA" | "CPC" | "SPEND";
  operator: "LT" | "GT";
  threshold: number;
  actionLabel: string;
  enabled: boolean;
  createdAt: string;
}

export interface TransactionRecord {
  id: string;
  gateway: GatewayId;
  clientIdentifier: string | null;
  orderId: string | null;
  productId: string | null;
  productName: string;
  offerCode: string | null;
  paymentMethod: string;
  currency: string;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  status: OmegaPayTransactionStatus;
  lastEvent: string;
  installments: number;
  createdAt: string;
  paidAt: string | null;
  updatedAt: string;
}

export interface TransferRecord {
  id: string;
  gateway: GatewayId;
  clientIdentifier: string | null;
  amount: number;
  receivedAmount: number;
  feeAmount: number;
  currency: string;
  status: OmegaPayTransferStatus;
  lastEvent: string;
  message: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ManualExpenseRecord {
  id: string;
  gateway: "ALL" | GatewayId;
  dashboardId: DashboardOperationId;
  campaignName: string | null;
  category: ExpenseCategory;
  title: string;
  amount: number;
  expenseDate: string; // YYYY-MM-DD
  notes: string | null;
  createdAt: string;
}

export interface WebhookEventRecord {
  id: string;
  gateway: GatewayId;
  dedupeKey: string;
  eventType: string;
  entityId: string;
  statusAfter: string | null;
  sanitizedPayload: string;
  receivedAt: string;
}

export interface BalanceSnapshotRecord extends OmegaPayBalanceResponse {
  gateway: GatewayId;
  fetchedAt: string | null;
}

interface DbExecutor {
  readonly dialect: "postgres" | "sqlite";
  query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
  execute(sql: string, params?: unknown[]): Promise<void>;
}

let dbExecutorPromise: Promise<DbExecutor> | null = null;

function convertPlaceholdersToPg(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

async function createDbExecutor(): Promise<DbExecutor> {
  const defaultLocalUrl = process.env.VERCEL
    ? "file:/tmp/pulsetrack.db"
    : "file:./data/pulsetrack.db";
  const rawUrl = process.env.DATABASE_URL?.trim() || defaultLocalUrl;

  if (rawUrl.startsWith("postgres://") || rawUrl.startsWith("postgresql://")) {
    const pool = new Pool({
      connectionString: rawUrl,
      ssl: rawUrl.includes("localhost") ? false : { rejectUnauthorized: false },
    });

    return {
      dialect: "postgres",
      async query(sql: string, params: unknown[] = []) {
        const pgSql = convertPlaceholdersToPg(sql);
        const res = await pool.query(pgSql, params);
        return res.rows;
      },
      async execute(sql: string, params: unknown[] = []) {
        const pgSql = convertPlaceholdersToPg(sql);
        await pool.query(pgSql, params);
      },
    };
  }

  let finalUrl = rawUrl;
  if (rawUrl.startsWith("file:")) {
    const filePath = rawUrl.replace(/^file:/, "");
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    finalUrl = `file:${resolvedPath.replace(/\\/g, "/")}`;
  }

  const client: LibSqlClient = createClient({
    url: finalUrl,
    authToken: process.env.DATABASE_AUTH_TOKEN?.trim() || undefined,
  });

  return {
    dialect: "sqlite",
    async query(sql: string, params: unknown[] = []) {
      const res = await client.execute({
        sql,
        args: params as Array<string | number | null>,
      });
      return res.rows as unknown as Record<string, unknown>[];
    },
    async execute(sql: string, params: unknown[] = []) {
      await client.execute({
        sql,
        args: params as Array<string | number | null>,
      });
    },
  };
}

export async function getDb(): Promise<DbExecutor> {
  if (!dbExecutorPromise) {
    dbExecutorPromise = (async () => {
      const db = await createDbExecutor();

      // Otimização de cold-start em produção (PostgreSQL/Supabase):
      // Se o schema já foi criado pelas migrações, evita 29 DDLs sequenciais por cold start!
      if (db.dialect === "postgres") {
        try {
          const check = await db.query(
            `SELECT
              to_regclass('public.profiles') AS profiles_tbl,
              to_regclass('public.user_settings') AS settings_tbl,
              to_regclass('public.tiktok_connections') AS tiktok_tbl,
              to_regclass('public.user_notification_sound_preferences') AS sound_tbl,
              to_regclass('public.sale_notifications') AS sales_tbl,
              to_regclass('public.gateway_integrations') AS gw_int_tbl,
              to_regclass('public.transaction_status_history') AS tx_hist_tbl,
              to_regclass('public.campaign_metric_configs') AS metrics_cfg_tbl,
              to_regclass('public.metric_templates') AS metrics_tpl_tbl,
              to_regclass('public.metric_alert_logs') AS metrics_alert_tbl`
          );
          const row = check[0];
          if (
            row &&
            row.profiles_tbl &&
            row.settings_tbl &&
            row.tiktok_tbl &&
            row.sound_tbl &&
            row.sales_tbl &&
            row.gw_int_tbl &&
            row.tx_hist_tbl &&
            row.metrics_cfg_tbl &&
            row.metrics_tpl_tbl &&
            row.metrics_alert_tbl
          ) {
            return db;
          }
        } catch {
          // Segue para bootstrap seguro caso alguma tabela ainda não exista
        }
      }

      await db.execute(`
        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          gateway TEXT NOT NULL DEFAULT 'OMEGAPAY',
          client_identifier TEXT,
          order_id TEXT,
          product_id TEXT,
          product_name TEXT NOT NULL,
          offer_code TEXT,
          payment_method TEXT NOT NULL,
          currency TEXT NOT NULL DEFAULT 'BRL',
          gross_amount REAL NOT NULL DEFAULT 0,
          fee_amount REAL NOT NULL DEFAULT 0,
          net_amount REAL NOT NULL DEFAULT 0,
          status TEXT NOT NULL,
          last_event TEXT NOT NULL,
          installments INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          paid_at TEXT,
          updated_at TEXT NOT NULL
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS transfers (
          id TEXT PRIMARY KEY,
          gateway TEXT NOT NULL DEFAULT 'OMEGAPAY',
          client_identifier TEXT,
          amount REAL NOT NULL DEFAULT 0,
          received_amount REAL NOT NULL DEFAULT 0,
          fee_amount REAL NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'BRL',
          status TEXT NOT NULL,
          last_event TEXT NOT NULL,
          message TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS webhook_events (
          id TEXT PRIMARY KEY,
          gateway TEXT NOT NULL DEFAULT 'OMEGAPAY',
          dedupe_key TEXT NOT NULL UNIQUE,
          event_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          status_after TEXT,
          sanitized_payload TEXT NOT NULL,
          received_at TEXT NOT NULL
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS manual_expenses (
          id TEXT PRIMARY KEY,
          gateway TEXT NOT NULL DEFAULT 'ALL',
          dashboard_id TEXT NOT NULL DEFAULT 'omegapay',
          campaign_name TEXT,
          category TEXT NOT NULL,
          title TEXT NOT NULL,
          amount REAL NOT NULL,
          expense_date TEXT NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS tiktok_campaigns (
          id TEXT PRIMARY KEY,
          dashboard_id TEXT NOT NULL DEFAULT 'tiktok',
          ad_account TEXT NOT NULL DEFAULT 'Conta Principal TikTok',
          campaign_name TEXT NOT NULL,
          adgroup_name TEXT NOT NULL,
          ad_name TEXT NOT NULL,
          product_name TEXT NOT NULL DEFAULT 'Produto Principal',
          utm_source TEXT NOT NULL DEFAULT 'tiktok',
          utm_medium TEXT NOT NULL DEFAULT 'cpc',
          utm_campaign TEXT NOT NULL DEFAULT '',
          utm_content TEXT NOT NULL DEFAULT '',
          stat_date TEXT NOT NULL,
          spend REAL NOT NULL DEFAULT 0,
          impressions INTEGER NOT NULL DEFAULT 0,
          clicks INTEGER NOT NULL DEFAULT 0,
          conversions INTEGER NOT NULL DEFAULT 0,
          attributed_revenue REAL NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS custom_fees (
          id TEXT PRIMARY KEY,
          dashboard_id TEXT NOT NULL DEFAULT 'omegapay',
          name TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'GATEWAY',
          fee_type TEXT NOT NULL DEFAULT 'FIXED',
          value REAL NOT NULL DEFAULT 0,
          fee_date TEXT NOT NULL,
          campaign_name TEXT,
          notes TEXT,
          created_at TEXT NOT NULL
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS automation_rules (
          id TEXT PRIMARY KEY,
          dashboard_id TEXT NOT NULL DEFAULT 'tiktok',
          name TEXT NOT NULL,
          metric TEXT NOT NULL,
          operator TEXT NOT NULL,
          threshold REAL NOT NULL,
          action_label TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS balance_snapshots (
          id INTEGER PRIMARY KEY,
          gateway TEXT NOT NULL DEFAULT 'OMEGAPAY',
          available REAL NOT NULL DEFAULT 0,
          pending REAL NOT NULL DEFAULT 0,
          fund_lock REAL NOT NULL DEFAULT 0,
          fetched_at TEXT NOT NULL
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS server_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS profiles (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          display_name TEXT NOT NULL DEFAULT '',
          company_name TEXT NOT NULL DEFAULT 'Dashfy Workspace',
          role TEXT NOT NULL DEFAULT 'user',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS user_settings (
          user_id TEXT NOT NULL,
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (user_id, key)
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS user_balance_snapshots (
          user_id TEXT NOT NULL,
          gateway TEXT NOT NULL DEFAULT 'OMEGAPAY',
          available REAL NOT NULL DEFAULT 0,
          pending REAL NOT NULL DEFAULT 0,
          fund_lock REAL NOT NULL DEFAULT 0,
          fetched_at TEXT NOT NULL,
          PRIMARY KEY (user_id, gateway)
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS tiktok_connections (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          dashboard_id TEXT NOT NULL DEFAULT 'tiktok',
          label TEXT NOT NULL DEFAULT 'TikTok Business',
          access_token_enc TEXT NOT NULL,
          scope_json TEXT NOT NULL DEFAULT '[]',
          advertisers_json TEXT NOT NULL DEFAULT '[]',
          business_centers_json TEXT NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          last_error TEXT,
          last_sync_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS user_notification_sound_preferences (
          user_id TEXT PRIMARY KEY,
          sound_enabled INTEGER NOT NULL DEFAULT 1,
          selected_sound TEXT NOT NULL DEFAULT 'cash_register',
          sound_volume INTEGER NOT NULL DEFAULT 70,
          custom_sound_path TEXT,
          custom_sound_name TEXT,
          custom_sound_mime TEXT,
          updated_at TEXT NOT NULL
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS sale_notifications (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          transaction_id TEXT NOT NULL,
          dedupe_key TEXT NOT NULL UNIQUE,
          gateway TEXT NOT NULL DEFAULT 'OMEGAPAY',
          product_name TEXT NOT NULL,
          gross_amount REAL NOT NULL DEFAULT 0,
          net_amount REAL NOT NULL DEFAULT 0,
          payment_method TEXT NOT NULL DEFAULT 'PIX',
          utm_source TEXT,
          utm_campaign TEXT,
          created_at TEXT NOT NULL
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS gateway_integrations (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          gateway TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'DISCONNECTED',
          auth_mode TEXT NOT NULL DEFAULT 'DASHFY_TOKEN',
          webhook_url_slug TEXT NOT NULL UNIQUE,
          webhook_secret_enc TEXT,
          external_token_enc TEXT,
          last_event_at TEXT,
          last_event_type TEXT,
          last_error TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (user_id, gateway)
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS transaction_status_history (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          transaction_id TEXT NOT NULL,
          gateway TEXT NOT NULL,
          previous_status TEXT,
          new_status TEXT NOT NULL,
          event_type TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'webhook',
          created_at TEXT NOT NULL
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS campaign_metric_configs (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          dashboard_id TEXT NOT NULL DEFAULT 'tiktok',
          ad_account TEXT NOT NULL DEFAULT '',
          campaign_key TEXT NOT NULL,
          campaign_name TEXT NOT NULL DEFAULT 'Padrão da Operação',
          view_name TEXT NOT NULL DEFAULT 'Padrão',
          is_active INTEGER NOT NULL DEFAULT 1,
          objective TEXT NOT NULL DEFAULT 'conversion',
          period_preset TEXT NOT NULL DEFAULT '30d',
          selected_metrics_json TEXT NOT NULL DEFAULT '[]',
          goals_json TEXT NOT NULL DEFAULT '{}',
          alert_settings_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (user_id, dashboard_id, campaign_key, view_name)
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS metric_templates (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          objective TEXT NOT NULL DEFAULT 'conversion',
          selected_metrics_json TEXT NOT NULL DEFAULT '[]',
          goals_json TEXT NOT NULL DEFAULT '{}',
          alert_settings_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS metric_alert_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          dashboard_id TEXT NOT NULL DEFAULT 'tiktok',
          campaign_key TEXT NOT NULL,
          metric_id TEXT NOT NULL,
          alert_type TEXT NOT NULL,
          dedupe_key TEXT NOT NULL,
          severity TEXT NOT NULL DEFAULT 'warning',
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          triggered_at TEXT NOT NULL
        )
      `);

      // Migração segura não-destrutiva para bancos existentes (SQLite e PostgreSQL)
      try {
        await db.execute(`ALTER TABLE transactions ADD COLUMN gateway TEXT NOT NULL DEFAULT 'OMEGAPAY'`);
      } catch {}
      try {
        await db.execute(`ALTER TABLE transfers ADD COLUMN gateway TEXT NOT NULL DEFAULT 'OMEGAPAY'`);
      } catch {}
      try {
        await db.execute(`ALTER TABLE manual_expenses ADD COLUMN gateway TEXT NOT NULL DEFAULT 'ALL'`);
      } catch {}
      try {
        await db.execute(`ALTER TABLE balance_snapshots ADD COLUMN gateway TEXT NOT NULL DEFAULT 'OMEGAPAY'`);
      } catch {}
      try {
        await db.execute(`ALTER TABLE webhook_events ADD COLUMN gateway TEXT NOT NULL DEFAULT 'OMEGAPAY'`);
      } catch {}
      try {
        await db.execute(`ALTER TABLE manual_expenses ADD COLUMN dashboard_id TEXT NOT NULL DEFAULT 'omegapay'`);
      } catch {}
      try {
        await db.execute(`ALTER TABLE manual_expenses ADD COLUMN campaign_name TEXT`);
      } catch {}
      try {
        await db.execute(`ALTER TABLE tiktok_campaigns ADD COLUMN dashboard_id TEXT NOT NULL DEFAULT 'tiktok'`);
      } catch {}

      // Multi-tenant: adiciona user_id preservando todos os dados legados existentes
      for (const tbl of [
        "transactions",
        "transfers",
        "manual_expenses",
        "tiktok_campaigns",
        "custom_fees",
        "automation_rules",
        "webhook_events",
        "balance_snapshots",
      ]) {
        try {
          await db.execute(
            `ALTER TABLE ${tbl} ADD COLUMN user_id TEXT NOT NULL DEFAULT '${LEGACY_ADMIN_USER_ID}'`
          );
        } catch {}
      }

      return db;
    })();
  }
  return dbExecutorPromise;
}

/**
 * Regras de transição de status para evitar que um webhook atrasado
 * (ex: TRANSACTION_CREATED após TRANSACTION_PAID) regrida uma venda confirmada.
 */
const TERMINAL_OR_CONFIRMED_STATUSES = new Set<OmegaPayTransactionStatus>([
  "COMPLETED",
  "REFUNDED",
  "CHARGED_BACK",
  "CANCELED",
]);

export function resolveTransactionStatus(
  event: string,
  payloadStatus?: string,
  existingStatus?: OmegaPayTransactionStatus
): OmegaPayTransactionStatus {
  const normalizedPayloadStatus = (payloadStatus || "PENDING").toUpperCase();

  let incomingStatus: OmegaPayTransactionStatus = "PENDING";

  if (event === "TRANSACTION_PAID") {
    incomingStatus = "COMPLETED";
  } else if (event === "TRANSACTION_CANCELED") {
    incomingStatus = "CANCELED";
  } else if (event === "TRANSACTION_REFUNDED") {
    incomingStatus = "REFUNDED";
  } else if (
    event === "TRANSACTION_CHARGED_BACK" ||
    event === "CHARGEBACK_CREATED"
  ) {
    incomingStatus = "CHARGED_BACK";
  } else if (event === "TRANSACTION_CREATED") {
    if (normalizedPayloadStatus === "COMPLETED") {
      incomingStatus = "COMPLETED";
    } else if (normalizedPayloadStatus === "FAILED") {
      incomingStatus = "FAILED";
    } else {
      incomingStatus = "PENDING";
    }
  } else {
    if (
      normalizedPayloadStatus === "COMPLETED" ||
      normalizedPayloadStatus === "OK" ||
      normalizedPayloadStatus === "PAID"
    ) {
      incomingStatus = "COMPLETED";
    } else if (normalizedPayloadStatus === "REFUNDED") {
      incomingStatus = "REFUNDED";
    } else if (normalizedPayloadStatus === "CHARGED_BACK") {
      incomingStatus = "CHARGED_BACK";
    } else if (
      normalizedPayloadStatus === "CANCELED" ||
      normalizedPayloadStatus === "REJECTED"
    ) {
      incomingStatus = "CANCELED";
    } else if (normalizedPayloadStatus === "FAILED") {
      incomingStatus = "FAILED";
    } else {
      incomingStatus = "PENDING";
    }
  }

  // Impede que um evento atrasado regrida uma transação já finalizada
  if (
    existingStatus &&
    TERMINAL_OR_CONFIRMED_STATUSES.has(existingStatus) &&
    incomingStatus === "PENDING"
  ) {
    return existingStatus;
  }

  // Impede que um evento COMPLETED atrasado sobrescreva um reembolso ou chargeback já registrado
  if (
    existingStatus &&
    (existingStatus === "REFUNDED" || existingStatus === "CHARGED_BACK") &&
    (incomingStatus === "COMPLETED" || incomingStatus === "FAILED")
  ) {
    return existingStatus;
  }

  return incomingStatus;
}

export async function checkWebhookEventExists(dedupeKey: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT id FROM webhook_events WHERE dedupe_key = ? LIMIT 1`,
    [dedupeKey]
  );
  return rows.length > 0;
}

export async function insertWebhookEvent(params: {
  userId?: string;
  dedupeKey: string;
  gateway?: GatewayId;
  eventType: string;
  entityId: string;
  statusAfter: string | null;
  sanitizedPayload: Record<string, unknown>;
}): Promise<{ duplicate: boolean; id: string }> {
  const db = await getDb();
  const userId = params.userId?.trim() || LEGACY_ADMIN_USER_ID;
  const scopedDedupeKey =
    userId === LEGACY_ADMIN_USER_ID
      ? params.dedupeKey
      : `${userId}:${params.dedupeKey}`;

  const existing = await checkWebhookEventExists(scopedDedupeKey);
  if (existing) {
    return { duplicate: true, id: "" };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const gateway = params.gateway || "OMEGAPAY";
  try {
    await db.execute(
      `INSERT INTO webhook_events (id, user_id, gateway, dedupe_key, event_type, entity_id, status_after, sanitized_payload, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        gateway,
        scopedDedupeKey,
        params.eventType,
        params.entityId,
        params.statusAfter,
        JSON.stringify(params.sanitizedPayload),
        now,
      ]
    );
    return { duplicate: false, id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes("unique") || message.toLowerCase().includes("duplicate")) {
      return { duplicate: true, id: "" };
    }
    throw err;
  }
}

export async function upsertTransaction(input: {
  id: string;
  userId?: string;
  gateway?: GatewayId;
  clientIdentifier?: string | null;
  orderId?: string | null;
  productId?: string | null;
  productName?: string | null;
  offerCode?: string | null;
  paymentMethod?: string | null;
  currency?: string | null;
  grossAmount: number;
  feeAmount?: number | null;
  netAmount?: number | null;
  status: OmegaPayTransactionStatus;
  lastEvent: string;
  installments?: number | null;
  createdAt?: string | null;
  paidAt?: string | null;
}): Promise<TransactionRecord> {
  const db = await getDb();
  const userId = input.userId?.trim() || LEGACY_ADMIN_USER_ID;
  const existingRows = await db.query(
    `SELECT * FROM transactions WHERE id = ? AND user_id = ? LIMIT 1`,
    [input.id, userId]
  );

  const now = new Date().toISOString();

  if (existingRows.length > 0) {
    const existing = mapTransactionRow(existingRows[0]);
    const finalStatus = resolveTransactionStatus(
      input.lastEvent,
      input.status,
      existing.status
    );

    const grossAmount =
      input.grossAmount > 0 ? input.grossAmount : existing.grossAmount;

    let feeAmount = existing.feeAmount;
    let netAmount = existing.netAmount;

    if (
      typeof input.feeAmount === "number" &&
      typeof input.netAmount === "number" &&
      (input.feeAmount > 0 || input.netAmount !== grossAmount)
    ) {
      feeAmount = input.feeAmount;
      netAmount = input.netAmount;
    } else if (existing.feeAmount === 0 && existing.netAmount === 0 && grossAmount > 0) {
      feeAmount = input.feeAmount ?? 0;
      netAmount = input.netAmount ?? grossAmount - feeAmount;
    }

    const productName =
      input.productName && input.productName !== "Produto OmegaPay"
        ? input.productName
        : existing.productName;

    const paidAt =
      input.paidAt ||
      existing.paidAt ||
      (finalStatus === "COMPLETED" ? now : null);

    const gateway = input.gateway || existing.gateway || "OMEGAPAY";

    await db.execute(
      `UPDATE transactions
       SET gateway = ?,
           client_identifier = ?,
           order_id = ?,
           product_id = ?,
           product_name = ?,
           offer_code = ?,
           payment_method = ?,
           currency = ?,
           gross_amount = ?,
           fee_amount = ?,
           net_amount = ?,
           status = ?,
           last_event = ?,
           installments = ?,
           paid_at = ?,
           updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [
        gateway,
        input.clientIdentifier ?? existing.clientIdentifier,
        input.orderId ?? existing.orderId,
        input.productId ?? existing.productId,
        productName,
        input.offerCode ?? existing.offerCode,
        input.paymentMethod ?? existing.paymentMethod,
        input.currency ?? existing.currency,
        grossAmount,
        feeAmount,
        netAmount,
        finalStatus,
        input.lastEvent,
        input.installments ?? existing.installments,
        paidAt,
        now,
        input.id,
        userId,
      ]
    );

    const updated = await db.query(
      `SELECT * FROM transactions WHERE id = ? AND user_id = ? LIMIT 1`,
      [input.id, userId]
    );
    return mapTransactionRow(updated[0]);
  }

  const grossAmount = Math.max(0, Number(input.grossAmount || 0));
  const feeAmount =
    typeof input.feeAmount === "number" ? Math.max(0, input.feeAmount) : 0;
  const netAmount =
    typeof input.netAmount === "number"
      ? input.netAmount
      : Math.max(0, grossAmount - feeAmount);

  const createdAt = input.createdAt || now;
  const paidAt =
    input.paidAt || (input.status === "COMPLETED" ? createdAt : null);
  const gateway = input.gateway || "OMEGAPAY";

  await db.execute(
    `INSERT INTO transactions (
      id, user_id, gateway, client_identifier, order_id, product_id, product_name,
      offer_code, payment_method, currency, gross_amount, fee_amount,
      net_amount, status, last_event, installments, created_at, paid_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      userId,
      gateway,
      input.clientIdentifier ?? null,
      input.orderId ?? null,
      input.productId ?? null,
      input.productName ||
        (gateway === "NEXUS"
          ? "Produto Nexus Pay"
          : gateway === "ELEVYPAY"
            ? "Produto ElevyPay"
            : "Produto OmegaPay"),
      input.offerCode ?? null,
      input.paymentMethod || "PIX",
      input.currency || "BRL",
      grossAmount,
      feeAmount,
      netAmount,
      input.status,
      input.lastEvent,
      input.installments ?? 1,
      createdAt,
      paidAt,
      now,
    ]
  );

  const inserted = await db.query(
    `SELECT * FROM transactions WHERE id = ? AND user_id = ? LIMIT 1`,
    [input.id, userId]
  );
  return mapTransactionRow(inserted[0]);
}

export async function upsertTransfer(input: {
  id: string;
  userId?: string;
  gateway?: GatewayId;
  clientIdentifier?: string | null;
  amount: number;
  receivedAmount?: number | null;
  feeAmount?: number | null;
  currency?: string | null;
  status: OmegaPayTransferStatus;
  lastEvent: string;
  message?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}): Promise<TransferRecord> {
  const db = await getDb();
  const userId = input.userId?.trim() || LEGACY_ADMIN_USER_ID;
  const existingRows = await db.query(
    `SELECT * FROM transfers WHERE id = ? AND user_id = ? LIMIT 1`,
    [input.id, userId]
  );

  const now = new Date().toISOString();
  const amount = Number(input.amount || 0);
  const feeAmount = Number(input.feeAmount ?? 0);
  const receivedAmount =
    typeof input.receivedAmount === "number"
      ? input.receivedAmount
      : input.status === "COMPLETED"
        ? Math.max(0, amount - feeAmount)
        : 0;

  if (existingRows.length > 0) {
    const existing = mapTransferRow(existingRows[0]);
    const gateway = input.gateway || existing.gateway || "OMEGAPAY";
    await db.execute(
      `UPDATE transfers
       SET gateway = ?,
           client_identifier = ?,
           amount = ?,
           received_amount = ?,
           fee_amount = ?,
           currency = ?,
           status = ?,
           last_event = ?,
           message = ?,
           updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [
        gateway,
        input.clientIdentifier ?? existing.clientIdentifier,
        amount > 0 ? amount : existing.amount,
        receivedAmount > 0 ? receivedAmount : existing.receivedAmount,
        feeAmount >= 0 ? feeAmount : existing.feeAmount,
        input.currency || existing.currency,
        input.status,
        input.lastEvent,
        input.message ?? existing.message,
        input.updatedAt || now,
        input.id,
        userId,
      ]
    );
    const updated = await db.query(
      `SELECT * FROM transfers WHERE id = ? AND user_id = ? LIMIT 1`,
      [input.id, userId]
    );
    return mapTransferRow(updated[0]);
  }

  const gateway = input.gateway || "OMEGAPAY";

  await db.execute(
    `INSERT INTO transfers (
      id, user_id, gateway, client_identifier, amount, received_amount, fee_amount,
      currency, status, last_event, message, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      userId,
      gateway,
      input.clientIdentifier ?? null,
      amount,
      receivedAmount,
      feeAmount,
      input.currency || "BRL",
      input.status,
      input.lastEvent,
      input.message ?? null,
      input.createdAt || now,
      input.updatedAt || now,
    ]
  );

  const inserted = await db.query(
    `SELECT * FROM transfers WHERE id = ? AND user_id = ? LIMIT 1`,
    [input.id, userId]
  );
  return mapTransferRow(inserted[0]);
}

export async function listTransactions(
  userId: string = LEGACY_ADMIN_USER_ID,
  limit = 500
): Promise<TransactionRecord[]> {
  const db = await getDb();
  const safeLimit = Math.max(1, Math.min(2000, Math.round(limit)));
  const rows = await db.query(
    `SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    [userId, safeLimit]
  );
  return rows.map(mapTransactionRow);
}

export async function listTransfers(
  userId: string = LEGACY_ADMIN_USER_ID,
  limit = 200
): Promise<TransferRecord[]> {
  const db = await getDb();
  const safeLimit = Math.max(1, Math.min(1000, Math.round(limit)));
  const rows = await db.query(
    `SELECT * FROM transfers WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    [userId, safeLimit]
  );
  return rows.map(mapTransferRow);
}

export async function listManualExpenses(
  userId: string = LEGACY_ADMIN_USER_ID,
  limit = 500
): Promise<ManualExpenseRecord[]> {
  const db = await getDb();
  const safeLimit = Math.max(1, Math.min(2000, Math.round(limit)));
  const rows = await db.query(
    `SELECT * FROM manual_expenses WHERE user_id = ? ORDER BY expense_date DESC, created_at DESC LIMIT ?`,
    [userId, safeLimit]
  );
  return rows.map(mapExpenseRow);
}

export async function createManualExpense(input: {
  userId?: string;
  category: ExpenseCategory;
  gateway?: "ALL" | GatewayId;
  dashboardId?: DashboardOperationId;
  campaignName?: string | null;
  title: string;
  amount: number;
  expenseDate: string;
  notes?: string | null;
}): Promise<ManualExpenseRecord> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const userId = input.userId?.trim() || LEGACY_ADMIN_USER_ID;
  const gateway = input.gateway || "ALL";
  const dashboardId: DashboardOperationId =
    input.dashboardId || (input.category === "TIKTOK_ADS" ? "tiktok" : "omegapay");

  await db.execute(
    `INSERT INTO manual_expenses (id, user_id, gateway, dashboard_id, campaign_name, category, title, amount, expense_date, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      gateway,
      dashboardId,
      input.campaignName?.trim() || null,
      input.category,
      input.title.trim(),
      Number(input.amount),
      input.expenseDate,
      input.notes?.trim() || null,
      now,
    ]
  );

  const rows = await db.query(
    `SELECT * FROM manual_expenses WHERE id = ? AND user_id = ? LIMIT 1`,
    [id, userId]
  );
  return mapExpenseRow(rows[0]);
}

export async function deleteManualExpense(
  id: string,
  userId: string = LEGACY_ADMIN_USER_ID
): Promise<boolean> {
  const db = await getDb();
  const existing = await db.query(
    `SELECT id FROM manual_expenses WHERE id = ? AND user_id = ? LIMIT 1`,
    [id, userId]
  );
  if (existing.length === 0) return false;
  await db.execute(
    `DELETE FROM manual_expenses WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
  return true;
}

export async function listRecentWebhookEvents(
  limit = 30,
  userId: string = LEGACY_ADMIN_USER_ID
): Promise<WebhookEventRecord[]> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT * FROM webhook_events WHERE user_id = ? ORDER BY received_at DESC LIMIT ?`,
    [userId, limit]
  );
  return rows.map((row) => ({
    id: String(row.id),
    gateway: normalizeGatewayId(row.gateway),
    dedupeKey: String(row.dedupe_key),
    eventType: String(row.event_type),
    entityId: String(row.entity_id),
    statusAfter: row.status_after ? String(row.status_after) : null,
    sanitizedPayload: String(row.sanitized_payload),
    receivedAt: String(row.received_at),
  }));
}

export async function saveBalanceSnapshot(
  balance: OmegaPayBalanceResponse & { gateway?: GatewayId },
  explicitGateway?: GatewayId,
  userId: string = LEGACY_ADMIN_USER_ID
): Promise<BalanceSnapshotRecord> {
  const db = await getDb();
  const now = new Date().toISOString();
  const gateway: GatewayId =
    explicitGateway || normalizeGatewayId(balance.gateway);

  const existing = await db.query(
    `SELECT user_id FROM user_balance_snapshots WHERE user_id = ? AND gateway = ? LIMIT 1`,
    [userId, gateway]
  );

  if (existing.length > 0) {
    await db.execute(
      `UPDATE user_balance_snapshots
       SET available = ?, pending = ?, fund_lock = ?, fetched_at = ?
       WHERE user_id = ? AND gateway = ?`,
      [
        Number(balance.available || 0),
        Number(balance.pending || 0),
        Number(balance.fundLock || 0),
        now,
        userId,
        gateway,
      ]
    );
  } else {
    await db.execute(
      `INSERT INTO user_balance_snapshots (user_id, gateway, available, pending, fund_lock, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        gateway,
        Number(balance.available || 0),
        Number(balance.pending || 0),
        Number(balance.fundLock || 0),
        now,
      ]
    );
  }

  return {
    gateway,
    available: Number(balance.available || 0),
    pending: Number(balance.pending || 0),
    fundLock: Number(balance.fundLock || 0),
    fetchedAt: now,
  };
}

export async function getLatestBalanceSnapshot(
  gateway: GatewayId = "OMEGAPAY",
  userId: string = LEGACY_ADMIN_USER_ID
): Promise<BalanceSnapshotRecord> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT * FROM user_balance_snapshots WHERE user_id = ? AND gateway = ? LIMIT 1`,
    [userId, gateway]
  );

  if (rows.length > 0) {
    const r = rows[0];
    return {
      gateway: normalizeGatewayId(r.gateway || gateway),
      available: Number(r.available || 0),
      pending: Number(r.pending || 0),
      fundLock: Number(r.fund_lock || 0),
      fetchedAt: toNullableIsoTimestamp(r.fetched_at),
    };
  }

  // Fallback não-destrutivo somente para a conta legada ler snapshots antigos de balance_snapshots
  if (userId === LEGACY_ADMIN_USER_ID && gateway !== "ELEVYPAY") {
    const id = gateway === "OMEGAPAY" ? 1 : 2;
    const legacyRows = await db.query(
      `SELECT * FROM balance_snapshots WHERE (gateway = ? OR (gateway IS NULL AND id = ?)) AND user_id = ? ORDER BY id ASC LIMIT 1`,
      [gateway, id, LEGACY_ADMIN_USER_ID]
    );
    if (legacyRows.length > 0) {
      const r = legacyRows[0];
      return {
        gateway: normalizeGatewayId(r.gateway || gateway),
        available: Number(r.available || 0),
        pending: Number(r.pending || 0),
        fundLock: Number(r.fund_lock || 0),
        fetchedAt: r.fetched_at ? String(r.fetched_at) : null,
      };
    }
  }

  return {
    gateway,
    available: 0,
    pending: 0,
    fundLock: 0,
    fetchedAt: null,
  };
}

export async function getAllBalanceSnapshots(
  userId: string = LEGACY_ADMIN_USER_ID
): Promise<Record<GatewayId, BalanceSnapshotRecord>> {
  const [omega, nexus, elevy] = await Promise.all([
    getLatestBalanceSnapshot("OMEGAPAY", userId),
    getLatestBalanceSnapshot("NEXUS", userId),
    getLatestBalanceSnapshot("ELEVYPAY", userId),
  ]);
  return {
    OMEGAPAY: omega,
    NEXUS: nexus,
    ELEVYPAY: elevy,
  };
}

export async function getServerSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT value FROM server_settings WHERE key = ? LIMIT 1`,
    [key]
  );
  if (rows.length === 0) return null;
  return String(rows[0].value);
}

export async function setServerSetting(
  key: string,
  value: string
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const existing = await db.query(
    `SELECT key FROM server_settings WHERE key = ? LIMIT 1`,
    [key]
  );
  if (existing.length > 0) {
    await db.execute(
      `UPDATE server_settings SET value = ?, updated_at = ? WHERE key = ?`,
      [value, now, key]
    );
  } else {
    await db.execute(
      `INSERT INTO server_settings (key, value, updated_at) VALUES (?, ?, ?)`,
      [key, value, now]
    );
  }
}

function mapTransactionRow(row: Record<string, unknown>): TransactionRecord {
  return {
    id: String(row.id),
    gateway: normalizeGatewayId(row.gateway),
    clientIdentifier: row.client_identifier ? String(row.client_identifier) : null,
    orderId: row.order_id ? String(row.order_id) : null,
    productId: row.product_id ? String(row.product_id) : null,
    productName: String(row.product_name || "Produto"),
    offerCode: row.offer_code ? String(row.offer_code) : null,
    paymentMethod: String(row.payment_method || "PIX"),
    currency: String(row.currency || "BRL"),
    grossAmount: Number(row.gross_amount || 0),
    feeAmount: Number(row.fee_amount || 0),
    netAmount: Number(row.net_amount || 0),
    status: String(row.status || "PENDING") as OmegaPayTransactionStatus,
    lastEvent: String(row.last_event || "TRANSACTION_CREATED"),
    installments: Number(row.installments || 1),
    createdAt: String(row.created_at),
    paidAt: row.paid_at ? String(row.paid_at) : null,
    updatedAt: String(row.updated_at),
  };
}

function mapTransferRow(row: Record<string, unknown>): TransferRecord {
  return {
    id: String(row.id),
    gateway: normalizeGatewayId(row.gateway),
    clientIdentifier: row.client_identifier ? String(row.client_identifier) : null,
    amount: Number(row.amount || 0),
    receivedAmount: Number(row.received_amount || 0),
    feeAmount: Number(row.fee_amount || 0),
    currency: String(row.currency || "BRL"),
    status: String(row.status || "PENDING") as OmegaPayTransferStatus,
    lastEvent: String(row.last_event || "TRANSFER_CREATED"),
    message: row.message ? String(row.message) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapExpenseRow(row: Record<string, unknown>): ManualExpenseRecord {
  let expenseDateStr = "";
  if (typeof row.expense_date === "string") {
    expenseDateStr = row.expense_date.slice(0, 10);
  } else if (row.expense_date instanceof Date) {
    const y = row.expense_date.getFullYear();
    const m = String(row.expense_date.getMonth() + 1).padStart(2, "0");
    const d = String(row.expense_date.getDate()).padStart(2, "0");
    expenseDateStr = `${y}-${m}-${d}`;
  } else {
    expenseDateStr = String(row.expense_date || "").slice(0, 10);
  }

  let createdAtStr = "";
  if (row.created_at instanceof Date) {
    createdAtStr = row.created_at.toISOString();
  } else {
    createdAtStr = String(row.created_at || "");
  }

  const rawGw = String(row.gateway || "ALL").toUpperCase();
  const gateway: "ALL" | GatewayId =
    rawGw === "NEXUS"
      ? "NEXUS"
      : rawGw === "ELEVYPAY"
        ? "ELEVYPAY"
        : rawGw === "OMEGAPAY"
          ? "OMEGAPAY"
          : "ALL";

  const rawDash = String(row.dashboard_id || "").trim();
  const dashboardId: DashboardOperationId = rawDash || "omegapay";

  return {
    id: String(row.id),
    gateway,
    dashboardId,
    campaignName: row.campaign_name ? String(row.campaign_name) : null,
    category: String(row.category || "OTHER") as ExpenseCategory,
    title: String(row.title),
    amount: Number(row.amount || 0),
    expenseDate: expenseDateStr,
    notes: row.notes ? String(row.notes) : null,
    createdAt: createdAtStr,
  };
}

// ============================================================
// PROFILES & USER SETTINGS (Multi-Tenant + Auto-Criação Idempotente)
// ============================================================

const claimedOwnersMemoryCache = new Map<string, number>();
const CLAIM_CACHE_TTL_MS = 5 * 60 * 1000;

export async function getUserProfile(
  userId: string
): Promise<UserProfileRecord | null> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT * FROM profiles WHERE id = ? LIMIT 1`,
    [userId]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: String(r.id),
    email: String(r.email || ""),
    displayName: String(r.display_name || ""),
    companyName: String(r.company_name || "Dashfy Workspace"),
    role: String(r.role || "user"),
    createdAt: toIsoTimestamp(r.created_at),
    updatedAt: toIsoTimestamp(r.updated_at),
  };
}

/**
 * Cria automaticamente o perfil de um usuário se ainda não existir (100% idempotente, nunca duplica).
 */
export async function ensureUserProfile(input: {
  id: string;
  email: string;
  displayName?: string | null;
  companyName?: string | null;
  role?: string;
}): Promise<UserProfileRecord> {
  const existing = await getUserProfile(input.id);
  const normalizedEmail = input.email.trim().toLowerCase();
  if (existing) {
    if (normalizedEmail && existing.email.toLowerCase() !== normalizedEmail) {
      const db = await getDb();
      const now = new Date().toISOString();
      try {
        await db.execute(
          `UPDATE profiles SET email = ?, updated_at = ? WHERE id = ?`,
          [normalizedEmail, now, input.id]
        );
        return { ...existing, email: normalizedEmail, updatedAt: now };
      } catch {
        // Ignora conflito eventual preservando o perfil existente
      }
    }
    return existing;
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const fallbackName = normalizedEmail.split("@")[0] || "Usuário";
  const displayName = input.displayName?.trim() || fallbackName;
  const companyName = input.companyName?.trim() || "Dashfy Workspace";
  const role = input.role || "user";

  try {
    await db.execute(
      `INSERT INTO profiles (id, email, display_name, company_name, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [input.id, normalizedEmail, displayName, companyName, role, now, now]
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.toLowerCase().includes("unique") && !msg.toLowerCase().includes("duplicate")) {
      throw err;
    }
  }

  return (
    (await getUserProfile(input.id)) || {
      id: input.id,
      email: normalizedEmail,
      displayName,
      companyName,
      role,
      createdAt: now,
      updatedAt: now,
    }
  );
}

export async function updateUserProfile(
  userId: string,
  updates: { displayName?: string; companyName?: string }
): Promise<UserProfileRecord | null> {
  const existing = await getUserProfile(userId);
  if (!existing) return null;

  const db = await getDb();
  const now = new Date().toISOString();
  const displayName = updates.displayName?.trim() || existing.displayName;
  const companyName = updates.companyName?.trim() || existing.companyName;

  await db.execute(
    `UPDATE profiles SET display_name = ?, company_name = ?, updated_at = ? WHERE id = ?`,
    [displayName, companyName, now, userId]
  );

  return getUserProfile(userId);
}

/**
 * Busca TODAS as configurações de um usuário em 1 única consulta SQL
 * (substitui até 10 queries sequenciais/paralelas na tabela user_settings).
 */
export async function getUserSettingsBatch(
  userId: string
): Promise<Record<string, string>> {
  const db = await getDb();
  const result: Record<string, string> = {};

  if (userId === LEGACY_ADMIN_USER_ID) {
    const legacyRows = await db.query(`SELECT key, value FROM server_settings`);
    for (const r of legacyRows) {
      if (r.key) result[String(r.key)] = String(r.value ?? "");
    }
  }

  const rows = await db.query(
    `SELECT key, value FROM user_settings WHERE user_id = ?`,
    [userId]
  );
  for (const r of rows) {
    if (r.key) result[String(r.key)] = String(r.value ?? "");
  }

  return result;
}

export async function getUserSetting(
  userId: string,
  key: string
): Promise<string | null> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT value FROM user_settings WHERE user_id = ? AND key = ? LIMIT 1`,
    [userId, key]
  );
  if (rows.length > 0) {
    return String(rows[0].value);
  }
  // Fallback não-destrutivo somente para a conta proprietária legada
  if (userId === LEGACY_ADMIN_USER_ID) {
    return getServerSetting(key);
  }
  return null;
}

export async function setUserSetting(
  userId: string,
  key: string,
  value: string
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const existing = await db.query(
    `SELECT user_id FROM user_settings WHERE user_id = ? AND key = ? LIMIT 1`,
    [userId, key]
  );
  if (existing.length > 0) {
    await db.execute(
      `UPDATE user_settings SET value = ?, updated_at = ? WHERE user_id = ? AND key = ?`,
      [value, now, userId, key]
    );
  } else {
    await db.execute(
      `INSERT INTO user_settings (user_id, key, value, updated_at) VALUES (?, ?, ?, ?)`,
      [userId, key, value, now]
    );
  }
}

/**
 * Localiza qual usuário é dono de um token de webhook (para roteamento seguro multi-tenant).
 */
export async function findUserIdByWebhookToken(
  settingKey: string,
  incomingToken: string
): Promise<string | null> {
  const cleanIncoming = incomingToken.trim();
  if (!cleanIncoming) return null;

  const db = await getDb();
  const rows = await db.query(
    `SELECT user_id, value FROM user_settings WHERE key = ?`,
    [settingKey]
  );

  const incomingHash = crypto.createHash("sha256").update(cleanIncoming, "utf8").digest();

  for (const row of rows) {
    const tokens = String(row.value || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    for (const candidate of tokens) {
      const candidateHash = crypto.createHash("sha256").update(candidate, "utf8").digest();
      if (crypto.timingSafeEqual(incomingHash, candidateHash)) {
        return String(row.user_id);
      }
    }
  }
  return null;
}

/**
 * Vincula de forma segura e não-destrutiva todos os dados legados da conta proprietária
 * ('mendoncat831@gmail.com') ao seu novo UUID do Supabase Auth no primeiro login.
 */
export async function claimLegacyDataForOwner(
  newUserId: string,
  email: string
): Promise<void> {
  const ownerEmail = (process.env.DASHBOARD_USER?.trim() || "mendoncat831@gmail.com").toLowerCase();
  if (!newUserId || newUserId === LEGACY_ADMIN_USER_ID) return;
  if (email.trim().toLowerCase() !== ownerEmail) return;

  const cachedUntil = claimedOwnersMemoryCache.get(newUserId) || 0;
  if (cachedUntil > Date.now()) return;

  const alreadyClaimed = await getUserSetting(newUserId, "LEGACY_DATA_CLAIMED");
  if (alreadyClaimed === "true") {
    claimedOwnersMemoryCache.set(newUserId, Date.now() + CLAIM_CACHE_TTL_MS);
    return;
  }

  const db = await getDb();
  for (const tbl of [
    "transactions",
    "transfers",
    "manual_expenses",
    "tiktok_campaigns",
    "custom_fees",
    "automation_rules",
    "webhook_events",
    "tiktok_connections",
    "sale_notifications",
  ]) {
    try {
      await db.execute(
        `UPDATE ${tbl} SET user_id = ? WHERE user_id = ?`,
        [newUserId, LEGACY_ADMIN_USER_ID]
      );
    } catch {}
  }

  // Copia snapshots de saldo legados
  const legacyBalances = await getAllBalanceSnapshots(LEGACY_ADMIN_USER_ID);
  if (legacyBalances.OMEGAPAY.fetchedAt) {
    await saveBalanceSnapshot(legacyBalances.OMEGAPAY, "OMEGAPAY", newUserId);
  }
  if (legacyBalances.NEXUS.fetchedAt) {
    await saveBalanceSnapshot(legacyBalances.NEXUS, "NEXUS", newUserId);
  }

  // Copia configurações legadas para user_settings do proprietário
  for (const key of [
    "OMEGAPAY_PUBLIC_KEY",
    "OMEGAPAY_SECRET_KEY",
    "OMEGAPAY_WEBHOOK_TOKEN",
    "OMEGAPAY_SYNC_ENABLED",
    "OMEGAPAY_LAST_SYNC_AT",
    "NEXUS_API_KEY",
    "NEXUS_SECRET_KEY",
    "NEXUS_WEBHOOK_TOKEN",
    "DASHFY_DASHBOARDS_CONFIG",
    "QUICK_EXPENSE_PRESET",
    "NOTIFICATION_PREFS",
  ]) {
    const existingForUser = await getUserSetting(newUserId, key);
    if (!existingForUser) {
      const legacyVal = await getServerSetting(key);
      if (legacyVal) {
        await setUserSetting(newUserId, key, legacyVal);
      }
    }
  }

  await setUserSetting(newUserId, "LEGACY_DATA_CLAIMED", "true");
}

// ============================================================
// TIKTOK CAMPAIGNS (Isoladas por userId + dashboardId)
// ============================================================

export async function listTikTokCampaigns(
  userId: string = LEGACY_ADMIN_USER_ID,
  limit = 500
): Promise<TikTokCampaignRecord[]> {
  const db = await getDb();
  const safeLimit = Math.max(1, Math.min(2000, Math.floor(Number(limit) || 500)));
  const rows = await db.query(
    `SELECT * FROM tiktok_campaigns WHERE user_id = ? ORDER BY stat_date DESC, created_at DESC LIMIT ?`,
    [userId, safeLimit]
  );
  return rows.map(mapTikTokRow);
}

export async function createTikTokCampaign(input: {
  userId?: string;
  dashboardId?: string;
  adAccount?: string;
  campaignName: string;
  adgroupName: string;
  adName: string;
  productName?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  statDate: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  attributedRevenue: number;
  status?: "ACTIVE" | "PAUSED";
}): Promise<TikTokCampaignRecord> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const userId = input.userId?.trim() || LEGACY_ADMIN_USER_ID;
  const dashboardId = input.dashboardId?.trim() || "tiktok";

  await db.execute(
    `INSERT INTO tiktok_campaigns (
      id, user_id, dashboard_id, ad_account, campaign_name, adgroup_name, ad_name, product_name,
      utm_source, utm_medium, utm_campaign, utm_content, stat_date,
      spend, impressions, clicks, conversions, attributed_revenue, status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      dashboardId,
      input.adAccount?.trim() || "Conta Principal TikTok",
      input.campaignName.trim(),
      input.adgroupName.trim() || "Conjunto Padrão",
      input.adName.trim() || "Anúncio 01",
      input.productName?.trim() || "Produto Principal",
      input.utmSource?.trim() || "tiktok",
      input.utmMedium?.trim() || "cpc",
      input.utmCampaign?.trim() || input.campaignName.trim(),
      input.utmContent?.trim() || input.adName.trim(),
      input.statDate.slice(0, 10),
      Number(input.spend || 0),
      Math.max(0, Math.round(Number(input.impressions || 0))),
      Math.max(0, Math.round(Number(input.clicks || 0))),
      Math.max(0, Math.round(Number(input.conversions || 0))),
      Number(input.attributedRevenue || 0),
      input.status === "PAUSED" ? "PAUSED" : "ACTIVE",
      now,
      now,
    ]
  );

  const rows = await db.query(
    `SELECT * FROM tiktok_campaigns WHERE id = ? AND user_id = ? LIMIT 1`,
    [id, userId]
  );
  return mapTikTokRow(rows[0]);
}

export async function updateTikTokCampaignStatus(
  id: string,
  status: "ACTIVE" | "PAUSED",
  userId: string = LEGACY_ADMIN_USER_ID
): Promise<boolean> {
  const db = await getDb();
  const existing = await db.query(
    `SELECT id FROM tiktok_campaigns WHERE id = ? AND user_id = ? LIMIT 1`,
    [id, userId]
  );
  if (existing.length === 0) return false;
  await db.execute(
    `UPDATE tiktok_campaigns SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
    [status, new Date().toISOString(), id, userId]
  );
  return true;
}

export async function deleteTikTokCampaign(
  id: string,
  userId: string = LEGACY_ADMIN_USER_ID
): Promise<boolean> {
  const db = await getDb();
  const existing = await db.query(
    `SELECT id FROM tiktok_campaigns WHERE id = ? AND user_id = ? LIMIT 1`,
    [id, userId]
  );
  if (existing.length === 0) return false;
  await db.execute(
    `DELETE FROM tiktok_campaigns WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
  return true;
}

function mapTikTokRow(row: Record<string, unknown>): TikTokCampaignRecord {
  return {
    id: String(row.id),
    dashboardId: String(row.dashboard_id || "tiktok").trim() || "tiktok",
    adAccount: String(row.ad_account || "Conta Principal TikTok"),
    campaignName: String(row.campaign_name || ""),
    adgroupName: String(row.adgroup_name || ""),
    adName: String(row.ad_name || ""),
    productName: String(row.product_name || "Produto Principal"),
    utmSource: String(row.utm_source || "tiktok"),
    utmMedium: String(row.utm_medium || "cpc"),
    utmCampaign: String(row.utm_campaign || ""),
    utmContent: String(row.utm_content || ""),
    statDate: String(row.stat_date || "").slice(0, 10),
    spend: Number(row.spend || 0),
    impressions: Number(row.impressions || 0),
    clicks: Number(row.clicks || 0),
    conversions: Number(row.conversions || 0),
    attributedRevenue: Number(row.attributed_revenue || 0),
    status: String(row.status || "ACTIVE").toUpperCase() === "PAUSED" ? "PAUSED" : "ACTIVE",
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

// ============================================================
// CUSTOM FEES (Taxas isoladas por userId + dashboardId)
// ============================================================

export async function listCustomFees(
  userId: string = LEGACY_ADMIN_USER_ID
): Promise<CustomFeeRecord[]> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT * FROM custom_fees WHERE user_id = ? ORDER BY fee_date DESC, created_at DESC`,
    [userId]
  );
  return rows.map(mapFeeRow);
}

export async function createCustomFee(input: {
  userId?: string;
  dashboardId: DashboardOperationId;
  name: string;
  category: FeeCategory;
  feeType: FeeType;
  value: number;
  feeDate: string;
  campaignName?: string | null;
  notes?: string | null;
}): Promise<CustomFeeRecord> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const userId = input.userId?.trim() || LEGACY_ADMIN_USER_ID;

  await db.execute(
    `INSERT INTO custom_fees (id, user_id, dashboard_id, name, category, fee_type, value, fee_date, campaign_name, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      input.dashboardId,
      input.name.trim(),
      input.category,
      input.feeType,
      Number(input.value || 0),
      input.feeDate.slice(0, 10),
      input.campaignName?.trim() || null,
      input.notes?.trim() || null,
      now,
    ]
  );

  const rows = await db.query(
    `SELECT * FROM custom_fees WHERE id = ? AND user_id = ? LIMIT 1`,
    [id, userId]
  );
  return mapFeeRow(rows[0]);
}

export async function deleteCustomFee(
  id: string,
  userId: string = LEGACY_ADMIN_USER_ID
): Promise<boolean> {
  const db = await getDb();
  const existing = await db.query(
    `SELECT id FROM custom_fees WHERE id = ? AND user_id = ? LIMIT 1`,
    [id, userId]
  );
  if (existing.length === 0) return false;
  await db.execute(
    `DELETE FROM custom_fees WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
  return true;
}

function mapFeeRow(row: Record<string, unknown>): CustomFeeRecord {
  const rawDash = String(row.dashboard_id || "omegapay").trim();
  return {
    id: String(row.id),
    dashboardId: rawDash || "omegapay",
    name: String(row.name || ""),
    category: String(row.category || "OTHER") as FeeCategory,
    feeType: String(row.fee_type || "FIXED").toUpperCase() === "PERCENTAGE" ? "PERCENTAGE" : "FIXED",
    value: Number(row.value || 0),
    feeDate: String(row.fee_date || "").slice(0, 10),
    campaignName: row.campaign_name ? String(row.campaign_name) : null,
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.created_at || ""),
  };
}

// ============================================================
// AUTOMATION RULES (Isoladas por userId + dashboardId)
// ============================================================

export async function listAutomationRules(
  userId: string = LEGACY_ADMIN_USER_ID
): Promise<AutomationRuleRecord[]> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT * FROM automation_rules WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map(mapRuleRow);
}

export async function createAutomationRule(input: {
  userId?: string;
  dashboardId?: DashboardOperationId;
  name: string;
  metric: "ROAS" | "CPA" | "CPC" | "SPEND";
  operator: "LT" | "GT";
  threshold: number;
  actionLabel: string;
}): Promise<AutomationRuleRecord> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const userId = input.userId?.trim() || LEGACY_ADMIN_USER_ID;

  await db.execute(
    `INSERT INTO automation_rules (id, user_id, dashboard_id, name, metric, operator, threshold, action_label, enabled, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      input.dashboardId || "tiktok",
      input.name.trim(),
      input.metric,
      input.operator,
      Number(input.threshold),
      input.actionLabel.trim() || "Sinalizar alerta",
      1,
      now,
    ]
  );

  const rows = await db.query(
    `SELECT * FROM automation_rules WHERE id = ? AND user_id = ? LIMIT 1`,
    [id, userId]
  );
  return mapRuleRow(rows[0]);
}

export async function toggleAutomationRule(
  id: string,
  enabled: boolean,
  userId: string = LEGACY_ADMIN_USER_ID
): Promise<boolean> {
  const db = await getDb();
  const existing = await db.query(
    `SELECT id FROM automation_rules WHERE id = ? AND user_id = ? LIMIT 1`,
    [id, userId]
  );
  if (existing.length === 0) return false;
  await db.execute(
    `UPDATE automation_rules SET enabled = ? WHERE id = ? AND user_id = ?`,
    [enabled ? 1 : 0, id, userId]
  );
  return true;
}

export async function deleteAutomationRule(
  id: string,
  userId: string = LEGACY_ADMIN_USER_ID
): Promise<boolean> {
  const db = await getDb();
  const existing = await db.query(
    `SELECT id FROM automation_rules WHERE id = ? AND user_id = ? LIMIT 1`,
    [id, userId]
  );
  if (existing.length === 0) return false;
  await db.execute(
    `DELETE FROM automation_rules WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
  return true;
}

function mapRuleRow(row: Record<string, unknown>): AutomationRuleRecord {
  const rawDash = String(row.dashboard_id || "tiktok").trim();
  return {
    id: String(row.id),
    dashboardId: rawDash || "tiktok",
    name: String(row.name || ""),
    metric: String(row.metric || "ROAS") as AutomationRuleRecord["metric"],
    operator: String(row.operator || "LT") as AutomationRuleRecord["operator"],
    threshold: Number(row.threshold || 0),
    actionLabel: String(row.action_label || "Sinalizar alerta"),
    enabled: Number(row.enabled ?? 1) === 1,
    createdAt: String(row.created_at || ""),
  };
}

// ============================================================
// TIKTOK OAUTH CONNECTIONS (Multi-conta & Isoladas por userId)
// ============================================================

function safeParseJsonArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function mapTikTokConnectionPublic(
  row: Record<string, unknown>
): TikTokConnectionPublicRecord {
  const rawStatus = String(row.status || "ACTIVE").toUpperCase();
  const status: TikTokConnectionPublicRecord["status"] =
    rawStatus === "REVOKED"
      ? "REVOKED"
      : rawStatus === "ERROR"
        ? "ERROR"
        : "ACTIVE";

  return {
    id: String(row.id),
    dashboardId: String(row.dashboard_id || "tiktok").trim() || "tiktok",
    label: String(row.label || "TikTok Business").trim() || "TikTok Business",
    status,
    scope: safeParseJsonArray<string>(row.scope_json),
    advertisers: safeParseJsonArray<TikTokAdvertiserSummary>(
      row.advertisers_json
    ),
    businessCenters: safeParseJsonArray<TikTokBusinessCenterSummary>(
      row.business_centers_json
    ),
    lastError: row.last_error ? String(row.last_error) : null,
    lastSyncAt: toNullableIsoTimestamp(row.last_sync_at),
    createdAt: toIsoTimestamp(row.created_at),
    updatedAt: toIsoTimestamp(row.updated_at),
  };
}

function mapTikTokConnectionInternal(
  row: Record<string, unknown>
): TikTokConnectionInternalRecord {
  return {
    ...mapTikTokConnectionPublic(row),
    userId: String(row.user_id || LEGACY_ADMIN_USER_ID),
    accessTokenEnc: String(row.access_token_enc || ""),
  };
}

export async function listTikTokConnections(
  userId: string
): Promise<TikTokConnectionPublicRecord[]> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT id, dashboard_id, label, scope_json, advertisers_json, business_centers_json, status, last_error, last_sync_at, created_at, updated_at
     FROM tiktok_connections
     WHERE user_id = ?
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map(mapTikTokConnectionPublic);
}

export async function getTikTokConnectionWithToken(
  id: string,
  userId: string
): Promise<TikTokConnectionInternalRecord | null> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT * FROM tiktok_connections WHERE id = ? AND user_id = ? LIMIT 1`,
    [id, userId]
  );
  if (rows.length === 0) return null;
  return mapTikTokConnectionInternal(rows[0]);
}

export async function upsertTikTokConnection(input: {
  id?: string;
  userId: string;
  dashboardId?: string;
  label?: string;
  accessTokenEnc: string;
  scope: string[];
  advertisers: TikTokAdvertiserSummary[];
  businessCenters: TikTokBusinessCenterSummary[];
  status?: "ACTIVE" | "ERROR" | "REVOKED";
  lastError?: string | null;
  lastSyncAt?: string | null;
}): Promise<TikTokConnectionPublicRecord> {
  const db = await getDb();
  const now = new Date().toISOString();
  const dashboardId = (input.dashboardId || "tiktok").trim() || "tiktok";
  const defaultLabel =
    input.label?.trim() ||
    input.businessCenters[0]?.name ||
    input.advertisers[0]?.advertiserName ||
    "TikTok Business";
  const status = input.status || "ACTIVE";

  // Evita duplicação exata se o usuário reconectar o mesmo conjunto de contas no mesmo dashboard
  let existingId = input.id;
  if (!existingId && input.advertisers.length > 0) {
    const newSignature = input.advertisers
      .map((a) => a.advertiserId)
      .sort()
      .join(",");
    const existingRows = await listTikTokConnections(input.userId);
    const match = existingRows.find((conn) => {
      if (conn.dashboardId !== dashboardId) return false;
      const sig = conn.advertisers
        .map((a) => a.advertiserId)
        .sort()
        .join(",");
      return sig.length > 0 && sig === newSignature;
    });
    if (match) {
      existingId = match.id;
    }
  }

  if (existingId) {
    const check = await db.query(
      `SELECT id FROM tiktok_connections WHERE id = ? AND user_id = ? LIMIT 1`,
      [existingId, input.userId]
    );
    if (check.length > 0) {
      await db.execute(
        `UPDATE tiktok_connections
         SET dashboard_id = ?, label = ?, access_token_enc = ?, scope_json = ?, advertisers_json = ?,
             business_centers_json = ?, status = ?, last_error = ?, last_sync_at = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`,
        [
          dashboardId,
          defaultLabel.slice(0, 80),
          input.accessTokenEnc,
          JSON.stringify(input.scope),
          JSON.stringify(input.advertisers),
          JSON.stringify(input.businessCenters),
          status,
          input.lastError ?? null,
          input.lastSyncAt ?? now,
          now,
          existingId,
          input.userId,
        ]
      );
      const updated = await db.query(
        `SELECT id, dashboard_id, label, scope_json, advertisers_json, business_centers_json, status, last_error, last_sync_at, created_at, updated_at
         FROM tiktok_connections WHERE id = ? AND user_id = ? LIMIT 1`,
        [existingId, input.userId]
      );
      return mapTikTokConnectionPublic(updated[0]);
    }
  }

  const id = crypto.randomUUID();
  await db.execute(
    `INSERT INTO tiktok_connections (
      id, user_id, dashboard_id, label, access_token_enc, scope_json,
      advertisers_json, business_centers_json, status, last_error,
      last_sync_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.userId,
      dashboardId,
      defaultLabel.slice(0, 80),
      input.accessTokenEnc,
      JSON.stringify(input.scope),
      JSON.stringify(input.advertisers),
      JSON.stringify(input.businessCenters),
      status,
      input.lastError ?? null,
      input.lastSyncAt ?? now,
      now,
      now,
    ]
  );

  const created = await db.query(
    `SELECT id, dashboard_id, label, scope_json, advertisers_json, business_centers_json, status, last_error, last_sync_at, created_at, updated_at
     FROM tiktok_connections WHERE id = ? AND user_id = ? LIMIT 1`,
    [id, input.userId]
  );
  return mapTikTokConnectionPublic(created[0]);
}

export async function updateTikTokConnectionStatus(
  id: string,
  userId: string,
  patch: {
    status?: "ACTIVE" | "ERROR" | "REVOKED";
    lastError?: string | null;
    lastSyncAt?: string | null;
    advertisers?: TikTokAdvertiserSummary[];
    businessCenters?: TikTokBusinessCenterSummary[];
  }
): Promise<boolean> {
  const db = await getDb();
  const existing = await db.query(
    `SELECT * FROM tiktok_connections WHERE id = ? AND user_id = ? LIMIT 1`,
    [id, userId]
  );
  if (existing.length === 0) return false;
  const row = existing[0];
  const now = new Date().toISOString();

  await db.execute(
    `UPDATE tiktok_connections
     SET status = ?, last_error = ?, last_sync_at = ?, advertisers_json = ?, business_centers_json = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    [
      patch.status ?? String(row.status || "ACTIVE"),
      patch.lastError !== undefined
        ? patch.lastError
        : row.last_error
          ? String(row.last_error)
          : null,
      patch.lastSyncAt !== undefined
        ? patch.lastSyncAt
        : row.last_sync_at
          ? String(row.last_sync_at)
          : null,
      patch.advertisers !== undefined
        ? JSON.stringify(patch.advertisers)
        : String(row.advertisers_json || "[]"),
      patch.businessCenters !== undefined
        ? JSON.stringify(patch.businessCenters)
        : String(row.business_centers_json || "[]"),
      now,
      id,
      userId,
    ]
  );
  return true;
}

export async function deleteTikTokConnection(
  id: string,
  userId: string
): Promise<boolean> {
  const db = await getDb();
  const existing = await db.query(
    `SELECT id FROM tiktok_connections WHERE id = ? AND user_id = ? LIMIT 1`,
    [id, userId]
  );
  if (existing.length === 0) return false;
  await db.execute(
    `DELETE FROM tiktok_connections WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
  return true;
}

// ============================================================
// SALES NOTIFICATION SOUND PREFERENCES & CONFIRMED SALE EVENTS
// ============================================================

function mapSoundPreferencesRow(
  userId: string,
  row?: Record<string, unknown>
): UserSoundPreferences {
  if (!row) {
    return {
      userId,
      ...DEFAULT_SOUND_PREFERENCES,
      updatedAt: new Date().toISOString(),
    };
  }

  const rawSound = String(row.selected_sound || DEFAULT_SOUND_PREFERENCES.selectedSound);
  const selectedSound: NotificationSoundId = isValidSoundId(rawSound)
    ? rawSound
    : DEFAULT_SOUND_PREFERENCES.selectedSound;

  const rawEnabled = row.sound_enabled;
  const soundEnabled =
    typeof rawEnabled === "boolean"
      ? rawEnabled
      : Number(rawEnabled ?? 1) !== 0;

  return {
    userId: String(row.user_id || userId),
    soundEnabled,
    selectedSound,
    soundVolume: normalizeSoundVolume(row.sound_volume),
    customSoundPath: row.custom_sound_path ? String(row.custom_sound_path) : null,
    customSoundName: row.custom_sound_name ? String(row.custom_sound_name) : null,
    customSoundMime: row.custom_sound_mime ? String(row.custom_sound_mime) : null,
    updatedAt: toIsoTimestamp(row.updated_at),
  };
}

export async function getUserSoundPreferences(
  userId: string
): Promise<UserSoundPreferences> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT * FROM user_notification_sound_preferences WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  return mapSoundPreferencesRow(userId, rows[0]);
}

export async function upsertUserSoundPreferences(
  userId: string,
  patch: {
    soundEnabled?: boolean;
    selectedSound?: NotificationSoundId;
    soundVolume?: number;
    customSoundPath?: string | null;
    customSoundName?: string | null;
    customSoundMime?: string | null;
  }
): Promise<UserSoundPreferences> {
  const db = await getDb();
  const current = await getUserSoundPreferences(userId);
  const now = new Date().toISOString();

  const soundEnabled =
    patch.soundEnabled !== undefined ? Boolean(patch.soundEnabled) : current.soundEnabled;
  const customSoundPath =
    patch.customSoundPath !== undefined ? patch.customSoundPath : current.customSoundPath;
  const customSoundName =
    patch.customSoundName !== undefined ? patch.customSoundName : current.customSoundName;
  const customSoundMime =
    patch.customSoundMime !== undefined ? patch.customSoundMime : current.customSoundMime;

  let selectedSound: NotificationSoundId =
    patch.selectedSound !== undefined && isValidSoundId(patch.selectedSound)
      ? patch.selectedSound
      : current.selectedSound;

  // Se não existir áudio customizado salvo, não permite deixar selectedSound em 'custom'
  if (selectedSound === "custom" && !customSoundPath) {
    selectedSound = DEFAULT_SOUND_PREFERENCES.selectedSound;
  }

  const soundVolume =
    patch.soundVolume !== undefined
      ? normalizeSoundVolume(patch.soundVolume)
      : current.soundVolume;

  const existingRows = await db.query(
    `SELECT user_id FROM user_notification_sound_preferences WHERE user_id = ? LIMIT 1`,
    [userId]
  );

  // Compatível com SQLite (INTEGER 1/0) e PostgreSQL (BOOLEAN true/false)
  const enabledDbValue = db.dialect === "postgres" ? soundEnabled : soundEnabled ? 1 : 0;

  if (existingRows.length > 0) {
    await db.execute(
      `UPDATE user_notification_sound_preferences
       SET sound_enabled = ?, selected_sound = ?, sound_volume = ?,
           custom_sound_path = ?, custom_sound_name = ?, custom_sound_mime = ?, updated_at = ?
       WHERE user_id = ?`,
      [
        enabledDbValue,
        selectedSound,
        soundVolume,
        customSoundPath,
        customSoundName,
        customSoundMime,
        now,
        userId,
      ]
    );
  } else {
    await db.execute(
      `INSERT INTO user_notification_sound_preferences (
        user_id, sound_enabled, selected_sound, sound_volume,
        custom_sound_path, custom_sound_name, custom_sound_mime, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        enabledDbValue,
        selectedSound,
        soundVolume,
        customSoundPath,
        customSoundName,
        customSoundMime,
        now,
      ]
    );
  }

  return getUserSoundPreferences(userId);
}

export async function resetUserSoundPreferences(
  userId: string
): Promise<UserSoundPreferences> {
  return upsertUserSoundPreferences(userId, {
    soundEnabled: DEFAULT_SOUND_PREFERENCES.soundEnabled,
    selectedSound: DEFAULT_SOUND_PREFERENCES.selectedSound,
    soundVolume: DEFAULT_SOUND_PREFERENCES.soundVolume,
  });
}

function mapSaleNotificationRow(
  row: Record<string, unknown>
): SaleNotificationEvent {
  return {
    id: String(row.id),
    transactionId: String(row.transaction_id || ""),
    gateway: String(row.gateway || "OMEGAPAY"),
    productName: String(row.product_name || "Venda aprovada"),
    grossAmount: Number(row.gross_amount || 0),
    netAmount: Number(row.net_amount || 0),
    paymentMethod: String(row.payment_method || "PIX"),
    utmSource: row.utm_source ? String(row.utm_source) : null,
    utmCampaign: row.utm_campaign ? String(row.utm_campaign) : null,
    createdAt: toIsoTimestamp(row.created_at),
  };
}

/**
 * Registra de forma idempotente uma notificação de VENDA APROVADA (somente pagamentos confirmados
 * por gateways/checkouts integrados — nunca conversões isoladas de relatório de anúncios).
 */
export async function recordApprovedSaleNotification(input: {
  userId: string;
  transactionId: string;
  dedupeKey: string;
  gateway: string;
  productName: string;
  grossAmount: number;
  netAmount: number;
  paymentMethod: string;
  utmSource?: string | null;
  utmCampaign?: string | null;
}): Promise<{ inserted: boolean; notification?: SaleNotificationEvent }> {
  const db = await getDb();
  const existing = await db.query(
    `SELECT id FROM sale_notifications WHERE dedupe_key = ? LIMIT 1`,
    [input.dedupeKey]
  );
  if (existing.length > 0) {
    return { inserted: false };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    await db.execute(
      `INSERT INTO sale_notifications (
        id, user_id, transaction_id, dedupe_key, gateway, product_name,
        gross_amount, net_amount, payment_method, utm_source, utm_campaign, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.userId,
        input.transactionId,
        input.dedupeKey,
        input.gateway,
        input.productName.trim() || "Venda aprovada",
        Number(input.grossAmount || 0),
        Number(input.netAmount || 0),
        input.paymentMethod || "PIX",
        input.utmSource?.trim() || null,
        input.utmCampaign?.trim() || null,
        now,
      ]
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("unique") || msg.toLowerCase().includes("duplicate")) {
      return { inserted: false };
    }
    throw err;
  }

  return {
    inserted: true,
    notification: {
      id,
      transactionId: input.transactionId,
      gateway: input.gateway,
      productName: input.productName.trim() || "Venda aprovada",
      grossAmount: Number(input.grossAmount || 0),
      netAmount: Number(input.netAmount || 0),
      paymentMethod: input.paymentMethod || "PIX",
      utmSource: input.utmSource?.trim() || null,
      utmCampaign: input.utmCampaign?.trim() || null,
      createdAt: now,
    },
  };
}

export async function listSaleNotificationsSince(
  userId: string,
  sinceIso?: string | null,
  limit = 20
): Promise<SaleNotificationEvent[]> {
  const db = await getDb();
  const safeLimit = Math.max(1, Math.min(50, Math.round(limit)));
  if (sinceIso && sinceIso.trim()) {
    const parsed = parseIsoTimestampParam(sinceIso);
    if (!parsed.valid || !parsed.iso) {
      throw new Error(parsed.valid ? "Data ausente." : parsed.error);
    }
    const rows = await db.query(
      `SELECT * FROM sale_notifications
       WHERE user_id = ? AND created_at > ?
       ORDER BY created_at ASC
       LIMIT ?`,
      [userId, parsed.iso, safeLimit]
    );
    return rows.map(mapSaleNotificationRow);
  }

  const rows = await db.query(
    `SELECT * FROM sale_notifications
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [userId, safeLimit]
  );
  return rows.map(mapSaleNotificationRow);
}

// ============================================================
// GATEWAY INTEGRATIONS & TRANSACTION STATUS HISTORY (ElevyPay / Multi-Gateway)
// ============================================================

function mapGatewayIntegrationRow(
  row: Record<string, unknown>
): GatewayIntegrationRecord {
  const rawStatus = String(row.status || "DISCONNECTED").toUpperCase();
  const status: GatewayIntegrationStatus =
    rawStatus === "CONNECTED" || rawStatus === "ERROR"
      ? rawStatus
      : "DISCONNECTED";

  const rawMode = String(row.auth_mode || "DASHFY_TOKEN").toUpperCase();
  const authMode: GatewayWebhookAuthMode =
    rawMode === "GATEWAY_TOKEN" || rawMode === "HMAC_SHA256"
      ? rawMode
      : "DASHFY_TOKEN";

  return {
    id: String(row.id),
    userId: String(row.user_id),
    gateway: normalizeGatewayId(row.gateway),
    status,
    authMode,
    webhookUrlSlug: String(row.webhook_url_slug),
    webhookSecretEnc: row.webhook_secret_enc ? String(row.webhook_secret_enc) : null,
    externalTokenEnc: row.external_token_enc ? String(row.external_token_enc) : null,
    lastEventAt: toNullableIsoTimestamp(row.last_event_at),
    lastEventType: row.last_event_type ? String(row.last_event_type) : null,
    lastError: row.last_error ? String(row.last_error) : null,
    createdAt: toIsoTimestamp(row.created_at),
    updatedAt: toIsoTimestamp(row.updated_at),
  };
}

export async function getGatewayIntegration(
  userId: string,
  gateway: GatewayId
): Promise<GatewayIntegrationRecord | null> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT * FROM gateway_integrations WHERE user_id = ? AND gateway = ? LIMIT 1`,
    [userId, gateway]
  );
  if (rows.length === 0) return null;
  return mapGatewayIntegrationRow(rows[0]);
}

export async function getGatewayIntegrationBySlug(
  slug: string,
  gateway?: GatewayId
): Promise<GatewayIntegrationRecord | null> {
  const clean = slug.trim();
  if (!clean) return null;
  const db = await getDb();
  const rows = gateway
    ? await db.query(
        `SELECT * FROM gateway_integrations WHERE webhook_url_slug = ? AND gateway = ? LIMIT 1`,
        [clean, gateway]
      )
    : await db.query(
        `SELECT * FROM gateway_integrations WHERE webhook_url_slug = ? LIMIT 1`,
        [clean]
      );
  if (rows.length === 0) return null;
  return mapGatewayIntegrationRow(rows[0]);
}

export async function upsertGatewayIntegration(input: {
  userId: string;
  gateway: GatewayId;
  status?: GatewayIntegrationStatus;
  authMode?: GatewayWebhookAuthMode;
  webhookUrlSlug?: string;
  webhookSecretEnc?: string | null;
  externalTokenEnc?: string | null;
  lastError?: string | null;
}): Promise<GatewayIntegrationRecord> {
  const db = await getDb();
  const now = new Date().toISOString();
  const existing = await getGatewayIntegration(input.userId, input.gateway);

  if (existing) {
    const nextStatus = input.status ?? existing.status;
    const nextAuthMode = input.authMode ?? existing.authMode;
    const nextSlug = input.webhookUrlSlug ?? existing.webhookUrlSlug;
    const nextSecretEnc =
      input.webhookSecretEnc !== undefined
        ? input.webhookSecretEnc
        : existing.webhookSecretEnc;
    const nextExternalEnc =
      input.externalTokenEnc !== undefined
        ? input.externalTokenEnc
        : existing.externalTokenEnc;
    const nextLastError =
      input.lastError !== undefined ? input.lastError : existing.lastError;

    await db.execute(
      `UPDATE gateway_integrations
       SET status = ?,
           auth_mode = ?,
           webhook_url_slug = ?,
           webhook_secret_enc = ?,
           external_token_enc = ?,
           last_error = ?,
           updated_at = ?
       WHERE user_id = ? AND gateway = ?`,
      [
        nextStatus,
        nextAuthMode,
        nextSlug,
        nextSecretEnc,
        nextExternalEnc,
        nextLastError,
        now,
        input.userId,
        input.gateway,
      ]
    );
    return (await getGatewayIntegration(input.userId, input.gateway))!;
  }

  const id = crypto.randomUUID();
  const slug =
    input.webhookUrlSlug || crypto.randomBytes(18).toString("base64url");
  const status: GatewayIntegrationStatus = input.status ?? "CONNECTED";
  const authMode: GatewayWebhookAuthMode = input.authMode ?? "DASHFY_TOKEN";

  await db.execute(
    `INSERT INTO gateway_integrations (
      id, user_id, gateway, status, auth_mode, webhook_url_slug,
      webhook_secret_enc, external_token_enc, last_event_at, last_event_type,
      last_error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)`,
    [
      id,
      input.userId,
      input.gateway,
      status,
      authMode,
      slug,
      input.webhookSecretEnc ?? null,
      input.externalTokenEnc ?? null,
      input.lastError ?? null,
      now,
      now,
    ]
  );

  return (await getGatewayIntegration(input.userId, input.gateway))!;
}

export async function touchGatewayIntegrationEvent(input: {
  userId: string;
  gateway: GatewayId;
  eventType: string;
  error?: string | null;
}): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute(
    `UPDATE gateway_integrations
     SET last_event_at = ?,
         last_event_type = ?,
         last_error = ?,
         updated_at = ?
     WHERE user_id = ? AND gateway = ?`,
    [
      now,
      input.eventType.slice(0, 100),
      input.error ?? null,
      now,
      input.userId,
      input.gateway,
    ]
  );
}

export async function getTransactionById(
  userId: string,
  id: string
): Promise<TransactionRecord | null> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT * FROM transactions WHERE id = ? AND user_id = ? LIMIT 1`,
    [id, userId]
  );
  if (rows.length === 0) return null;
  return mapTransactionRow(rows[0]);
}

export async function insertTransactionStatusHistory(input: {
  userId: string;
  transactionId: string;
  gateway: GatewayId;
  previousStatus: string | null;
  newStatus: string;
  eventType: string;
  source?: string;
}): Promise<TransactionStatusHistoryRecord> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const source = input.source || "webhook";

  await db.execute(
    `INSERT INTO transaction_status_history (
      id, user_id, transaction_id, gateway, previous_status, new_status, event_type, source, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.userId,
      input.transactionId,
      input.gateway,
      input.previousStatus,
      input.newStatus,
      input.eventType,
      source,
      now,
    ]
  );

  return {
    id,
    userId: input.userId,
    transactionId: input.transactionId,
    gateway: input.gateway,
    previousStatus: input.previousStatus,
    newStatus: input.newStatus,
    eventType: input.eventType,
    source,
    createdAt: now,
  };
}

export async function listTransactionStatusHistory(
  userId: string,
  transactionId: string,
  limit = 30
): Promise<TransactionStatusHistoryRecord[]> {
  const db = await getDb();
  const safeLimit = Math.max(1, Math.min(100, Math.round(limit)));
  const rows = await db.query(
    `SELECT * FROM transaction_status_history
     WHERE user_id = ? AND transaction_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [userId, transactionId, safeLimit]
  );
  return rows.map((r) => ({
    id: String(r.id),
    userId: String(r.user_id),
    transactionId: String(r.transaction_id),
    gateway: normalizeGatewayId(r.gateway),
    previousStatus: r.previous_status ? String(r.previous_status) : null,
    newStatus: String(r.new_status),
    eventType: String(r.event_type),
    source: String(r.source || "webhook"),
    createdAt: toIsoTimestamp(r.created_at),
  }));
}

export async function listRecentWebhookEventsByGateway(
  userId: string,
  gateway: GatewayId,
  limit = 25
): Promise<WebhookEventRecord[]> {
  const db = await getDb();
  const safeLimit = Math.max(1, Math.min(100, Math.round(limit)));
  const rows = await db.query(
    `SELECT * FROM webhook_events
     WHERE user_id = ? AND gateway = ?
     ORDER BY received_at DESC
     LIMIT ?`,
    [userId, gateway, safeLimit]
  );
  return rows.map((row) => ({
    id: String(row.id),
    gateway: normalizeGatewayId(row.gateway),
    dedupeKey: String(row.dedupe_key),
    eventType: String(row.event_type),
    entityId: String(row.entity_id),
    statusAfter: row.status_after ? String(row.status_after) : null,
    sanitizedPayload: String(row.sanitized_payload),
    receivedAt: toIsoTimestamp(row.received_at),
  }));
}

// ============================================================
// MINHAS MÉTRICAS — CONFIGURAÇÕES, MODELOS E ALERTAS POR USUÁRIO
// ============================================================

export interface CampaignMetricConfigRecord {
  id: string;
  userId: string;
  dashboardId: string;
  adAccount: string;
  campaignKey: string;
  campaignName: string;
  viewName: string;
  isActive: boolean;
  objective: "conversion" | "traffic" | "awareness" | "financial" | "creatives";
  periodPreset: string;
  selectedMetrics: string[];
  goals: Record<string, unknown>;
  alertSettings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UserMetricTemplateRecord {
  id: string;
  userId: string;
  name: string;
  description: string;
  objective: "conversion" | "traffic" | "awareness" | "financial" | "creatives";
  selectedMetrics: string[];
  goals: Record<string, unknown>;
  alertSettings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MetricAlertLogRecord {
  id: string;
  userId: string;
  dashboardId: string;
  campaignKey: string;
  metricId: string;
  alertType: string;
  dedupeKey: string;
  severity: "critical" | "warning" | "positive";
  title: string;
  message: string;
  triggeredAt: string;
}

function safeParseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeObjective(
  raw: unknown
): "conversion" | "traffic" | "awareness" | "financial" | "creatives" {
  const v = String(raw || "conversion").toLowerCase();
  if (
    v === "traffic" ||
    v === "awareness" ||
    v === "financial" ||
    v === "creatives"
  ) {
    return v;
  }
  return "conversion";
}

function mapCampaignMetricConfigRow(
  row: Record<string, unknown>
): CampaignMetricConfigRecord {
  const isAct = row.is_active;
  const isActive =
    isAct === true || isAct === 1 || isAct === "1" || isAct === "true";

  return {
    id: String(row.id),
    userId: String(row.user_id),
    dashboardId: String(row.dashboard_id || "tiktok"),
    adAccount: String(row.ad_account || ""),
    campaignKey: String(row.campaign_key),
    campaignName: String(row.campaign_name || ""),
    viewName: String(row.view_name || "Padrão"),
    isActive,
    objective: normalizeObjective(row.objective),
    periodPreset: String(row.period_preset || "30d"),
    selectedMetrics: safeParseJson<string[]>(row.selected_metrics_json, []),
    goals: safeParseJson<Record<string, unknown>>(row.goals_json, {}),
    alertSettings: safeParseJson<Record<string, unknown>>(
      row.alert_settings_json,
      {}
    ),
    createdAt: toIsoTimestamp(row.created_at),
    updatedAt: toIsoTimestamp(row.updated_at),
  };
}

export async function listCampaignMetricConfigs(
  userId: string,
  dashboardId?: string
): Promise<CampaignMetricConfigRecord[]> {
  const db = await getDb();
  const rows = dashboardId
    ? await db.query(
        `SELECT * FROM campaign_metric_configs
         WHERE user_id = ? AND dashboard_id = ?
         ORDER BY updated_at DESC`,
        [userId, dashboardId]
      )
    : await db.query(
        `SELECT * FROM campaign_metric_configs
         WHERE user_id = ?
         ORDER BY updated_at DESC`,
        [userId]
      );
  return rows.map(mapCampaignMetricConfigRow);
}

export async function upsertCampaignMetricConfig(input: {
  userId: string;
  dashboardId: string;
  adAccount?: string;
  campaignKey: string;
  campaignName?: string;
  viewName?: string;
  isActive?: boolean;
  objective?: string;
  periodPreset?: string;
  selectedMetrics: string[];
  goals: Record<string, unknown>;
  alertSettings: Record<string, unknown>;
}): Promise<CampaignMetricConfigRecord> {
  const db = await getDb();
  const now = new Date().toISOString();
  const viewName = (input.viewName || "Padrão").trim().slice(0, 60) || "Padrão";
  const dashboardId = input.dashboardId.trim().slice(0, 60) || "tiktok";
  const campaignKey = input.campaignKey.trim().slice(0, 200);
  const campaignName =
    (input.campaignName || campaignKey).trim().slice(0, 160) || "Campanha";
  const adAccount = (input.adAccount || "").trim().slice(0, 120);
  const objective = normalizeObjective(input.objective);
  const periodPreset = (input.periodPreset || "30d").trim().slice(0, 20);
  const activeFlag = input.isActive !== false;
  const activeDbVal = db.dialect === "postgres" ? activeFlag : activeFlag ? 1 : 0;
  const inactiveDbVal = db.dialect === "postgres" ? false : 0;

  // Se esta visualização ficará ativa, desativa as outras visualizações da mesma campanha
  if (activeFlag) {
    await db.execute(
      `UPDATE campaign_metric_configs
       SET is_active = ?
       WHERE user_id = ? AND dashboard_id = ? AND campaign_key = ?`,
      [inactiveDbVal, input.userId, dashboardId, campaignKey]
    );
  }

  const existing = await db.query(
    `SELECT id FROM campaign_metric_configs
     WHERE user_id = ? AND dashboard_id = ? AND campaign_key = ? AND view_name = ?
     LIMIT 1`,
    [input.userId, dashboardId, campaignKey, viewName]
  );

  const selectedJson = JSON.stringify(input.selectedMetrics || []);
  const goalsJson = JSON.stringify(input.goals || {});
  const alertsJson = JSON.stringify(input.alertSettings || {});

  let recordId = "";
  if (existing.length > 0) {
    recordId = String(existing[0].id);
    await db.execute(
      `UPDATE campaign_metric_configs
       SET ad_account = ?,
           campaign_name = ?,
           is_active = ?,
           objective = ?,
           period_preset = ?,
           selected_metrics_json = ?,
           goals_json = ?,
           alert_settings_json = ?,
           updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [
        adAccount,
        campaignName,
        activeDbVal,
        objective,
        periodPreset,
        selectedJson,
        goalsJson,
        alertsJson,
        now,
        recordId,
        input.userId,
      ]
    );
  } else {
    recordId = crypto.randomUUID();
    await db.execute(
      `INSERT INTO campaign_metric_configs (
        id, user_id, dashboard_id, ad_account, campaign_key, campaign_name,
        view_name, is_active, objective, period_preset,
        selected_metrics_json, goals_json, alert_settings_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        recordId,
        input.userId,
        dashboardId,
        adAccount,
        campaignKey,
        campaignName,
        viewName,
        activeDbVal,
        objective,
        periodPreset,
        selectedJson,
        goalsJson,
        alertsJson,
        now,
        now,
      ]
    );
  }

  const rows = await db.query(
    `SELECT * FROM campaign_metric_configs WHERE id = ? AND user_id = ? LIMIT 1`,
    [recordId, input.userId]
  );
  return mapCampaignMetricConfigRow(rows[0]);
}

export async function deleteCampaignMetricConfig(
  userId: string,
  id: string
): Promise<boolean> {
  const db = await getDb();
  const existing = await db.query(
    `SELECT id FROM campaign_metric_configs WHERE id = ? AND user_id = ? LIMIT 1`,
    [id, userId]
  );
  if (existing.length === 0) return false;
  await db.execute(
    `DELETE FROM campaign_metric_configs WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
  return true;
}

export async function listUserMetricTemplates(
  userId: string
): Promise<UserMetricTemplateRecord[]> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT * FROM metric_templates WHERE user_id = ? ORDER BY updated_at DESC`,
    [userId]
  );
  return rows.map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name),
    description: String(row.description || ""),
    objective: normalizeObjective(row.objective),
    selectedMetrics: safeParseJson<string[]>(row.selected_metrics_json, []),
    goals: safeParseJson<Record<string, unknown>>(row.goals_json, {}),
    alertSettings: safeParseJson<Record<string, unknown>>(
      row.alert_settings_json,
      {}
    ),
    createdAt: toIsoTimestamp(row.created_at),
    updatedAt: toIsoTimestamp(row.updated_at),
  }));
}

export async function createUserMetricTemplate(input: {
  userId: string;
  name: string;
  description?: string;
  objective?: string;
  selectedMetrics: string[];
  goals: Record<string, unknown>;
  alertSettings: Record<string, unknown>;
}): Promise<UserMetricTemplateRecord> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const name = input.name.trim().slice(0, 80);
  const description = (input.description || "").trim().slice(0, 240);
  const objective = normalizeObjective(input.objective);

  await db.execute(
    `INSERT INTO metric_templates (
      id, user_id, name, description, objective,
      selected_metrics_json, goals_json, alert_settings_json,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.userId,
      name,
      description,
      objective,
      JSON.stringify(input.selectedMetrics || []),
      JSON.stringify(input.goals || {}),
      JSON.stringify(input.alertSettings || {}),
      now,
      now,
    ]
  );

  return {
    id,
    userId: input.userId,
    name,
    description,
    objective,
    selectedMetrics: input.selectedMetrics || [],
    goals: input.goals || {},
    alertSettings: input.alertSettings || {},
    createdAt: now,
    updatedAt: now,
  };
}

export async function deleteUserMetricTemplate(
  userId: string,
  id: string
): Promise<boolean> {
  const db = await getDb();
  const existing = await db.query(
    `SELECT id FROM metric_templates WHERE id = ? AND user_id = ? LIMIT 1`,
    [id, userId]
  );
  if (existing.length === 0) return false;
  await db.execute(
    `DELETE FROM metric_templates WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
  return true;
}

/**
 * Grava um alerta inteligente de métrica respeitando o cooldown configurado (evita alertas repetidos).
 */
export async function recordMetricAlertWithCooldown(input: {
  userId: string;
  dashboardId: string;
  campaignKey: string;
  metricId: string;
  alertType: string;
  dedupeKey: string;
  severity: "critical" | "warning" | "positive";
  title: string;
  message: string;
  cooldownHours?: number;
}): Promise<{ created: boolean; log?: MetricAlertLogRecord }> {
  const db = await getDb();
  const cooldownMs = Math.max(1, Number(input.cooldownHours ?? 12)) * 3600 * 1000;
  const cutoffIso = new Date(Date.now() - cooldownMs).toISOString();

  const recent = await db.query(
    `SELECT id FROM metric_alert_logs
     WHERE user_id = ? AND dedupe_key = ? AND triggered_at > ?
     LIMIT 1`,
    [input.userId, input.dedupeKey, cutoffIso]
  );
  if (recent.length > 0) {
    return { created: false };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO metric_alert_logs (
      id, user_id, dashboard_id, campaign_key, metric_id, alert_type,
      dedupe_key, severity, title, message, triggered_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.userId,
      input.dashboardId,
      input.campaignKey,
      input.metricId,
      input.alertType,
      input.dedupeKey,
      input.severity,
      input.title.slice(0, 160),
      input.message.slice(0, 400),
      now,
    ]
  );

  return {
    created: true,
    log: {
      id,
      userId: input.userId,
      dashboardId: input.dashboardId,
      campaignKey: input.campaignKey,
      metricId: input.metricId,
      alertType: input.alertType,
      dedupeKey: input.dedupeKey,
      severity: input.severity,
      title: input.title.slice(0, 160),
      message: input.message.slice(0, 400),
      triggeredAt: now,
    },
  };
}

export async function listRecentMetricAlertLogs(
  userId: string,
  dashboardId?: string,
  limit = 25
): Promise<MetricAlertLogRecord[]> {
  const db = await getDb();
  const safeLimit = Math.max(1, Math.min(100, Math.round(limit)));
  const rows = dashboardId
    ? await db.query(
        `SELECT * FROM metric_alert_logs
         WHERE user_id = ? AND dashboard_id = ?
         ORDER BY triggered_at DESC
         LIMIT ?`,
        [userId, dashboardId, safeLimit]
      )
    : await db.query(
        `SELECT * FROM metric_alert_logs
         WHERE user_id = ?
         ORDER BY triggered_at DESC
         LIMIT ?`,
        [userId, safeLimit]
      );

  return rows.map((row) => {
    const rawSev = String(row.severity || "warning").toLowerCase();
    const severity: "critical" | "warning" | "positive" =
      rawSev === "critical" || rawSev === "positive" ? rawSev : "warning";
    return {
      id: String(row.id),
      userId: String(row.user_id),
      dashboardId: String(row.dashboard_id || "tiktok"),
      campaignKey: String(row.campaign_key),
      metricId: String(row.metric_id),
      alertType: String(row.alert_type),
      dedupeKey: String(row.dedupe_key),
      severity,
      title: String(row.title),
      message: String(row.message),
      triggeredAt: toIsoTimestamp(row.triggered_at),
    };
  });
}
