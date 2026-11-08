import crypto from "crypto";

/**
 * Lista estrita de campos sensíveis que NUNCA devem ser registrados
 * em logs ou persistidos no banco de dados (CPF, CNPJ, telefone,
 * dados bancários, chaves PIX, endereços e credenciais/tokens).
 */
const SENSITIVE_KEYS = new Set([
  "cpf",
  "cnpj",
  "document",
  "payerdocument",
  "receiverdocument",
  "ownerdocument",
  "partnerdocument",
  "bankaccountdocument",
  "phone",
  "partnerphone",
  "telefone",
  "celular",
  "bank",
  "agency",
  "agencydigit",
  "account",
  "accountdigit",
  "accounttype",
  "bankaccount",
  "bankaccounts",
  "payoutaccount",
  "payerbankname",
  "payerbankaccount",
  "payerbankbranch",
  "receiverbankname",
  "receiverbankaccount",
  "receiverbankbranch",
  "pix",
  "pixkey",
  "pixtype",
  "receiverpixkey",
  "pixmetadata",
  "qrcode",
  "barcode",
  "digitableline",
  "walletaddress",
  "cryptoaddress",
  "token",
  "webhooktoken",
  "accesstoken",
  "password",
  "secret",
  "secretkey",
  "publickey",
  "x-public-key",
  "x-secret-key",
  "authorization",
  "cookie",
  "set-cookie",
  "address",
  "street",
  "zipcode",
  "zip_code",
  "number",
  "complement",
  "neighborhood",
  "card",
  "cardlastfour",
  "cvv",
]);

/**
 * Remove padrões de CPF, CNPJ e telefone em strings livres.
 */
export function redactSensitiveText(input: string): string {
  return input
    // CPF com ou sem pontuação (ex: 123.456.789-00)
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[CPF_REDACTED]")
    // CNPJ com pontuação (ex: 12.345.678/0001-90)
    .replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, "[CNPJ_REDACTED]")
    // Telefone brasileiro formatado (ex: (11) 98888-7777 ou (11) 9 8888-7777)
    .replace(/\(\d{2}\)\s*\d?\s*\d{4,5}-\d{4}/g, "[PHONE_REDACTED]");
}

/**
 * Sanitiza recursivamente qualquer objeto ou array, removendo CPF, CNPJ,
 * telefone, dados bancários, chaves PIX e credenciais/tokens.
 */
export function sanitizeData<T = unknown>(value: T, depth = 0): T {
  if (depth > 8 || value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return redactSensitiveText(value) as unknown as T;
  }

  if (typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeData(item, depth + 1)) as unknown as T;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key.toLowerCase().replace(/[_-\s]/g, "");
    if (
      SENSITIVE_KEYS.has(key.toLowerCase()) ||
      SENSITIVE_KEYS.has(normalizedKey)
    ) {
      sanitized[key] = "[REDACTED]";
      continue;
    }
    sanitized[key] = sanitizeData(val, depth + 1);
  }

  return sanitized as unknown as T;
}

/**
 * Logger seguro de servidor que garante a não exposição de dados sensíveis
 * (CPF, telefone, dados bancários ou credenciais).
 */
export function safeLog(
  level: "info" | "warn" | "error",
  message: string,
  meta?: Record<string, unknown>
): void {
  const safeMessage = redactSensitiveText(message);
  const safeMeta = meta ? sanitizeData(meta) : undefined;
  const timestamp = new Date().toISOString();

  const payload = safeMeta
    ? `[PulseTrack ${timestamp}] [${level.toUpperCase()}] ${safeMessage} ${JSON.stringify(safeMeta)}`
    : `[PulseTrack ${timestamp}] [${level.toUpperCase()}] ${safeMessage}`;

  if (level === "error") {
    console.error(payload);
  } else if (level === "warn") {
    console.warn(payload);
  } else {
    console.info(payload);
  }
}

/**
 * Comparação em tempo constante (Timing-Safe) do token de validação de Webhook
 * fornecido pela OmegaPay em `payload.token`.
 * Suporta múltiplos tokens separados por vírgula caso o produtor configure
 * mais de um webhook no painel da OmegaPay (ex.: Pagamentos e Transferências).
 */
export function verifyOmegaPayWebhookToken(
  receivedToken: unknown,
  configuredTokensRaw: string | string[] | null | undefined
): boolean {
  if (typeof receivedToken !== "string" || !receivedToken.trim()) {
    return false;
  }
  const normalizedRaw = Array.isArray(configuredTokensRaw)
    ? configuredTokensRaw.join(",")
    : configuredTokensRaw;

  if (!normalizedRaw || !normalizedRaw.trim()) {
    return false;
  }

  const candidates = normalizedRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (candidates.length === 0) {
    return false;
  }

  const receivedHash = crypto
    .createHash("sha256")
    .update(receivedToken.trim(), "utf8")
    .digest();

  for (const candidate of candidates) {
    const candidateHash = crypto
      .createHash("sha256")
      .update(candidate, "utf8")
      .digest();
    if (crypto.timingSafeEqual(receivedHash, candidateHash)) {
      return true;
    }
  }

  return false;
}
