import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createClient, type Client as LibSqlClient } from "@libsql/client";
import { Pool } from "pg";
import {
  type OmegaPayBalanceResponse,
  type OmegaPayTransactionStatus,
  type OmegaPayTransferStatus,
} from "./omegapay-types";

export type ExpenseCategory =
  | "META_ADS"
  | "TIKTOK_ADS"
  | "OTHER_ADS"
  | "TOOLS"
  | "OTHER";

export interface TransactionRecord {
  id: string;
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
  category: ExpenseCategory;
  title: string;
  amount: number;
  expenseDate: string; // YYYY-MM-DD
  notes: string | null;
  createdAt: string;
}

export interface WebhookEventRecord {
  id: string;
  dedupeKey: string;
  eventType: string;
  entityId: string;
  statusAfter: string | null;
  sanitizedPayload: string;
  receivedAt: string;
}

export interface BalanceSnapshotRecord extends OmegaPayBalanceResponse {
  fetchedAt: string | null;
}

interface DbExecutor {
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

      await db.execute(`
        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
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
          category TEXT NOT NULL,
          title TEXT NOT NULL,
          amount REAL NOT NULL,
          expense_date TEXT NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS balance_snapshots (
          id INTEGER PRIMARY KEY,
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

  // Impede que um evento de criação atrasado sobrescreva um status já confirmado ou estornado
  if (
    existingStatus &&
    TERMINAL_OR_CONFIRMED_STATUSES.has(existingStatus) &&
    incomingStatus === "PENDING"
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
  dedupeKey: string;
  eventType: string;
  entityId: string;
  statusAfter: string | null;
  sanitizedPayload: Record<string, unknown>;
}): Promise<{ duplicate: boolean; id: string }> {
  const db = await getDb();
  const existing = await checkWebhookEventExists(params.dedupeKey);
  if (existing) {
    return { duplicate: true, id: "" };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await db.execute(
      `INSERT INTO webhook_events (id, dedupe_key, event_type, entity_id, status_after, sanitized_payload, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.dedupeKey,
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
  const existingRows = await db.query(
    `SELECT * FROM transactions WHERE id = ? LIMIT 1`,
    [input.id]
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

    await db.execute(
      `UPDATE transactions
       SET client_identifier = ?,
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
       WHERE id = ?`,
      [
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
      ]
    );

    const updated = await db.query(
      `SELECT * FROM transactions WHERE id = ? LIMIT 1`,
      [input.id]
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

  await db.execute(
    `INSERT INTO transactions (
      id, client_identifier, order_id, product_id, product_name,
      offer_code, payment_method, currency, gross_amount, fee_amount,
      net_amount, status, last_event, installments, created_at, paid_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      input.clientIdentifier ?? null,
      input.orderId ?? null,
      input.productId ?? null,
      input.productName || "Produto OmegaPay",
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
    `SELECT * FROM transactions WHERE id = ? LIMIT 1`,
    [input.id]
  );
  return mapTransactionRow(inserted[0]);
}

export async function upsertTransfer(input: {
  id: string;
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
  const existingRows = await db.query(
    `SELECT * FROM transfers WHERE id = ? LIMIT 1`,
    [input.id]
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
    await db.execute(
      `UPDATE transfers
       SET client_identifier = ?,
           amount = ?,
           received_amount = ?,
           fee_amount = ?,
           currency = ?,
           status = ?,
           last_event = ?,
           message = ?,
           updated_at = ?
       WHERE id = ?`,
      [
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
      ]
    );
    const updated = await db.query(
      `SELECT * FROM transfers WHERE id = ? LIMIT 1`,
      [input.id]
    );
    return mapTransferRow(updated[0]);
  }

  await db.execute(
    `INSERT INTO transfers (
      id, client_identifier, amount, received_amount, fee_amount,
      currency, status, last_event, message, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
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
    `SELECT * FROM transfers WHERE id = ? LIMIT 1`,
    [input.id]
  );
  return mapTransferRow(inserted[0]);
}

export async function listTransactions(): Promise<TransactionRecord[]> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT * FROM transactions ORDER BY created_at DESC`
  );
  return rows.map(mapTransactionRow);
}

export async function listTransfers(): Promise<TransferRecord[]> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT * FROM transfers ORDER BY created_at DESC`
  );
  return rows.map(mapTransferRow);
}

export async function listManualExpenses(): Promise<ManualExpenseRecord[]> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT * FROM manual_expenses ORDER BY expense_date DESC, created_at DESC`
  );
  return rows.map(mapExpenseRow);
}

export async function createManualExpense(input: {
  category: ExpenseCategory;
  title: string;
  amount: number;
  expenseDate: string;
  notes?: string | null;
}): Promise<ManualExpenseRecord> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO manual_expenses (id, category, title, amount, expense_date, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.category,
      input.title.trim(),
      Number(input.amount),
      input.expenseDate,
      input.notes?.trim() || null,
      now,
    ]
  );

  const rows = await db.query(
    `SELECT * FROM manual_expenses WHERE id = ? LIMIT 1`,
    [id]
  );
  return mapExpenseRow(rows[0]);
}

export async function deleteManualExpense(id: string): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM manual_expenses WHERE id = ?`, [id]);
}

export async function listRecentWebhookEvents(
  limit = 30
): Promise<WebhookEventRecord[]> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT * FROM webhook_events ORDER BY received_at DESC LIMIT ?`,
    [limit]
  );
  return rows.map((row) => ({
    id: String(row.id),
    dedupeKey: String(row.dedupe_key),
    eventType: String(row.event_type),
    entityId: String(row.entity_id),
    statusAfter: row.status_after ? String(row.status_after) : null,
    sanitizedPayload: String(row.sanitized_payload),
    receivedAt: String(row.received_at),
  }));
}

export async function saveBalanceSnapshot(
  balance: OmegaPayBalanceResponse
): Promise<BalanceSnapshotRecord> {
  const db = await getDb();
  const now = new Date().toISOString();
  const existing = await db.query(
    `SELECT id FROM balance_snapshots WHERE id = 1 LIMIT 1`
  );

  if (existing.length > 0) {
    await db.execute(
      `UPDATE balance_snapshots
       SET available = ?, pending = ?, fund_lock = ?, fetched_at = ?
       WHERE id = 1`,
      [
        Number(balance.available || 0),
        Number(balance.pending || 0),
        Number(balance.fundLock || 0),
        now,
      ]
    );
  } else {
    await db.execute(
      `INSERT INTO balance_snapshots (id, available, pending, fund_lock, fetched_at)
       VALUES (1, ?, ?, ?, ?)`,
      [
        Number(balance.available || 0),
        Number(balance.pending || 0),
        Number(balance.fundLock || 0),
        now,
      ]
    );
  }

  return {
    available: Number(balance.available || 0),
    pending: Number(balance.pending || 0),
    fundLock: Number(balance.fundLock || 0),
    fetchedAt: now,
  };
}

export async function getLatestBalanceSnapshot(): Promise<BalanceSnapshotRecord> {
  const db = await getDb();
  const rows = await db.query(
    `SELECT * FROM balance_snapshots WHERE id = 1 LIMIT 1`
  );
  if (rows.length === 0) {
    return {
      available: 0,
      pending: 0,
      fundLock: 0,
      fetchedAt: null,
    };
  }
  const r = rows[0];
  return {
    available: Number(r.available || 0),
    pending: Number(r.pending || 0),
    fundLock: Number(r.fund_lock || 0),
    fetchedAt: r.fetched_at ? String(r.fetched_at) : null,
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
    clientIdentifier: row.client_identifier ? String(row.client_identifier) : null,
    orderId: row.order_id ? String(row.order_id) : null,
    productId: row.product_id ? String(row.product_id) : null,
    productName: String(row.product_name || "Produto OmegaPay"),
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
  return {
    id: String(row.id),
    category: String(row.category || "OTHER") as ExpenseCategory,
    title: String(row.title),
    amount: Number(row.amount || 0),
    expenseDate: String(row.expense_date),
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.created_at),
  };
}
