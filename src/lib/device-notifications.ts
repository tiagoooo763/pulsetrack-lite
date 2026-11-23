"use client";

import type { SaleNotificationEvent } from "./notification-sounds";
import { formatBRL } from "./format";

export type DeviceNotificationStatus =
  | "granted"
  | "default"
  | "denied"
  | "unsupported"
  | "ios_needs_homescreen";

const DASHFY_ICON_URL = "/assets/logo-dashfy-icon.png";
const ENABLED_STORAGE_KEY = "dashfy_device_notifications_enabled";

let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function getDeviceNotificationStatus(): DeviceNotificationStatus {
  if (typeof window === "undefined") return "unsupported";
  if (isIosDevice() && !isRunningStandalone() && !("Notification" in window)) {
    return "ios_needs_homescreen";
  }
  if (!("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return "default";
}

export function isDeviceNotificationEnabledLocally(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(ENABLED_STORAGE_KEY);
    // Se a permissão do sistema já foi concedida, considera ativo por padrão salvo desligamento explícito
    if (stored === "false") return false;
    return getDeviceNotificationStatus() === "granted";
  } catch {
    return getDeviceNotificationStatus() === "granted";
  }
}

export function setDeviceNotificationEnabledLocally(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ENABLED_STORAGE_KEY, enabled ? "true" : "false");
  } catch {}
}

/**
 * Registra o Service Worker oficial da Dashfy (/sw.js) de forma segura e idempotente.
 * Obrigatório no Android Chrome e iOS Safari PWA para exibir notificações nativas na barra do telefone.
 */
export async function ensureDashfyServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  if (!swRegistrationPromise) {
    swRegistrationPromise = navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(async (reg) => {
        try {
          await navigator.serviceWorker.ready;
        } catch {}
        return reg;
      })
      .catch(() => {
        swRegistrationPromise = null;
        return null;
      });
  }
  return swRegistrationPromise;
}

async function dispatchSystemNotification(options: {
  title: string;
  body: string;
  tag: string;
  url?: string;
}): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }
  if (Notification.permission !== "granted") {
    return false;
  }

  const notifOptions: NotificationOptions & {
    vibrate?: number[];
    renotify?: boolean;
  } = {
    body: options.body,
    icon: DASHFY_ICON_URL,
    badge: DASHFY_ICON_URL,
    tag: options.tag,
    renotify: true,
    vibrate: [180, 80, 180],
    data: { url: options.url || "/dashboard" },
  };

  // No Android Chrome e iOS PWA, registration.showNotification é o método obrigatório
  try {
    const reg = await ensureDashfyServiceWorker();
    if (reg && typeof reg.showNotification === "function") {
      await reg.showNotification(options.title, notifOptions);
      return true;
    }
  } catch {
    // Fallback para Desktop Notification
  }

  try {
    const n = new Notification(options.title, notifOptions);
    n.onclick = () => {
      try {
        window.focus();
      } catch {}
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

export async function requestDeviceNotificationPermission(): Promise<{
  status: DeviceNotificationStatus;
  granted: boolean;
}> {
  const current = getDeviceNotificationStatus();
  if (current === "unsupported" || current === "ios_needs_homescreen") {
    return { status: current, granted: false };
  }

  await ensureDashfyServiceWorker();

  try {
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      setDeviceNotificationEnabledLocally(true);
      await dispatchSystemNotification({
        title: "Notificações ativadas • Dashfy",
        body: "Você receberá alertas de cada venda aprovada direto neste dispositivo.",
        tag: "dashfy-welcome-notif",
      });
      return { status: "granted", granted: true };
    }
    return {
      status: perm === "denied" ? "denied" : "default",
      granted: false,
    };
  } catch {
    return { status: getDeviceNotificationStatus(), granted: false };
  }
}

/**
 * Dispara a notificação nativa no telefone/desktop para uma venda real aprovada.
 * Exibe: "Venda feita! • Dashfy" / "Você recebeu R$ X,XX — Produto (PIX)" com o símbolo da Dashfy.
 */
export async function showSaleDeviceNotification(
  sale: Pick<
    SaleNotificationEvent,
    "id" | "grossAmount" | "productName" | "paymentMethod" | "gateway"
  >
): Promise<boolean> {
  if (!isDeviceNotificationEnabledLocally()) return false;
  const amountText = formatBRL(sale.grossAmount);
  const productPart = sale.productName ? ` — ${sale.productName}` : "";
  const methodPart = sale.paymentMethod ? ` (${sale.paymentMethod})` : "";
  return dispatchSystemNotification({
    title: "Venda feita! • Dashfy",
    body: `Você recebeu ${amountText}${productPart}${methodPart}`,
    tag: `dashfy-sale-${sale.id}`,
    url: "/dashboard",
  });
}

/**
 * Envia uma notificação de demonstração para o usuário conferir na hora no telefone/desktop.
 */
export async function sendTestDeviceNotification(
  amount = 197.0
): Promise<{ ok: boolean; error?: string }> {
  const status = getDeviceNotificationStatus();
  if (status === "ios_needs_homescreen") {
    return {
      ok: false,
      error:
        "No iPhone/iPad, toque em Compartilhar → Adicionar à Tela de Início e abra a Dashfy por lá para ativar notificações nativas.",
    };
  }
  if (status === "unsupported") {
    return {
      ok: false,
      error: "Este navegador não suporta notificações nativas do sistema.",
    };
  }
  if (status === "denied") {
    return {
      ok: false,
      error:
        "As notificações estão bloqueadas nas configurações do navegador/telefone. Libere para www.usedashfy.com.br e tente novamente.",
    };
  }
  if (status === "default") {
    const req = await requestDeviceNotificationPermission();
    if (!req.granted) {
      return {
        ok: false,
        error: "Permissão de notificações não concedida.",
      };
    }
  }

  const sent = await dispatchSystemNotification({
    title: "Venda feita! • Dashfy",
    body: `Você recebeu ${formatBRL(amount)} — Venda Teste (PIX)`,
    tag: `dashfy-test-${Date.now()}`,
    url: "/dashboard",
  });

  if (!sent) {
    return {
      ok: false,
      error: "Não foi possível exibir a notificação nativa neste dispositivo.",
    };
  }
  return { ok: true };
}
