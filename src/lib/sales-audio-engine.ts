"use client";

import {
  getBuiltInSoundUrl,
  type NotificationSoundId,
  type UserSoundPreferences,
} from "./notification-sounds";

export interface SaleAudioPlaybackResult {
  played: boolean;
  reason?: "silent" | "disabled" | "autoplay_blocked" | "cooldown" | "error";
  errorMessage?: string;
}

type StateListener = (state: {
  playingPreviewId: NotificationSoundId | null;
  autoplayBlocked: boolean;
}) => void;

/**
 * Motor de reprodução de áudio para notificações de vendas da Dashfy.
 * - Lazy-load: só instancia/carrega mídia ao reproduzir.
 * - Evita sobreposição de múltiplos sons simultâneos (cooldown + canal único).
 * - Respeita integralmente as políticas de autoplay dos navegadores (sem contornos).
 */
class SalesAudioEngine {
  private previewAudio: HTMLAudioElement | null = null;
  private alertAudio: HTMLAudioElement | null = null;
  private playingPreviewId: NotificationSoundId | null = null;
  private autoplayBlocked = false;
  private lastAlertPlayedAt = 0;
  private readonly alertCooldownMs = 1400;
  private listeners = new Set<StateListener>();

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener({
      playingPreviewId: this.playingPreviewId,
      autoplayBlocked: this.autoplayBlocked,
    });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snapshot = {
      playingPreviewId: this.playingPreviewId,
      autoplayBlocked: this.autoplayBlocked,
    };
    this.listeners.forEach((fn) => fn(snapshot));
  }

  getAutoplayBlocked(): boolean {
    return this.autoplayBlocked;
  }

  stopPreview(): void {
    if (this.previewAudio) {
      try {
        this.previewAudio.pause();
        this.previewAudio.currentTime = 0;
      } catch {}
      this.previewAudio = null;
    }
    if (this.playingPreviewId !== null) {
      this.playingPreviewId = null;
      this.emit();
    }
  }

  /**
   * Prévia sob demanda acionada pelo clique do usuário.
   * Interrompe qualquer prévia anterior e aplica o volume atual sem salvar preferências.
   */
  async playPreview(params: {
    soundId: NotificationSoundId;
    volumePercent: number;
    customSignedUrl?: string | null;
  }): Promise<{ ok: boolean; error?: string }> {
    // Se clicar novamente no som que já está tocando, interrompe
    if (this.playingPreviewId === params.soundId) {
      this.stopPreview();
      return { ok: true };
    }

    this.stopPreview();

    if (params.soundId === "silent") {
      return { ok: true };
    }

    const src =
      params.soundId === "custom"
        ? params.customSignedUrl || null
        : getBuiltInSoundUrl(params.soundId);

    if (!src) {
      return {
        ok: false,
        error:
          params.soundId === "custom"
            ? "Envie um arquivo de áudio personalizado primeiro para ouvir a prévia."
            : "Arquivo de áudio indisponível.",
      };
    }

    try {
      const audio = new Audio(src);
      audio.preload = "none";
      audio.volume = Math.max(0, Math.min(1, params.volumePercent / 100));

      this.previewAudio = audio;
      this.playingPreviewId = params.soundId;
      this.emit();

      audio.onended = () => {
        if (this.previewAudio === audio) {
          this.previewAudio = null;
          this.playingPreviewId = null;
          this.emit();
        }
      };

      audio.onerror = () => {
        if (this.previewAudio === audio) {
          this.previewAudio = null;
          this.playingPreviewId = null;
          this.emit();
        }
      };

      await audio.play();
      // Interação explícita do usuário desbloqueia autoplay na sessão
      if (this.autoplayBlocked) {
        this.autoplayBlocked = false;
        this.emit();
      }
      return { ok: true };
    } catch (err) {
      this.stopPreview();
      const message =
        err instanceof Error && err.name === "NotAllowedError"
          ? "O navegador bloqueou a reprodução automática. Clique novamente para permitir áudio."
          : "Não foi possível reproduzir este arquivo de áudio.";
      return { ok: false, error: message };
    }
  }

  /**
   * Habilita a reprodução após interação explícita do usuário ("Ativar sons de notificações").
   */
  async unlockWithUserGesture(volumePercent = 70): Promise<boolean> {
    try {
      const audio = new Audio("/sounds/soft-notification.wav");
      audio.volume = Math.max(0.05, Math.min(1, (volumePercent / 100) * 0.35));
      await audio.play();
      this.autoplayBlocked = false;
      this.emit();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reproduz o som configurado quando uma NOVA venda aprovada é recebida.
   * Evita sobreposição de sons simultâneos e trata bloqueios de autoplay com elegância.
   */
  async playSaleAlert(params: {
    prefs: Pick<
      UserSoundPreferences,
      "soundEnabled" | "selectedSound" | "soundVolume" | "customSoundPath"
    >;
    resolveCustomUrl?: () => Promise<string | null>;
  }): Promise<SaleAudioPlaybackResult> {
    const { prefs } = params;

    if (!prefs.soundEnabled) {
      return { played: false, reason: "disabled" };
    }
    if (prefs.selectedSound === "silent" || prefs.soundVolume <= 0) {
      return { played: false, reason: "silent" };
    }

    const now = Date.now();
    if (now - this.lastAlertPlayedAt < this.alertCooldownMs) {
      return { played: false, reason: "cooldown" };
    }

    let src: string | null = null;
    if (prefs.selectedSound === "custom") {
      if (prefs.customSoundPath && params.resolveCustomUrl) {
        src = await params.resolveCustomUrl().catch(() => null);
      }
      // Fallback seguro caso o áudio customizado esteja temporariamente indisponível
      if (!src) {
        src = getBuiltInSoundUrl("cash_register");
      }
    } else {
      src = getBuiltInSoundUrl(prefs.selectedSound);
    }

    if (!src) {
      return { played: false, reason: "error" };
    }

    // Garante canal único sem sobreposição
    if (this.alertAudio) {
      try {
        this.alertAudio.pause();
        this.alertAudio.currentTime = 0;
      } catch {}
      this.alertAudio = null;
    }

    try {
      const audio = new Audio(src);
      audio.preload = "none";
      audio.volume = Math.max(0, Math.min(1, prefs.soundVolume / 100));
      this.alertAudio = audio;
      this.lastAlertPlayedAt = now;

      audio.onended = () => {
        if (this.alertAudio === audio) {
          this.alertAudio = null;
        }
      };

      await audio.play();
      if (this.autoplayBlocked) {
        this.autoplayBlocked = false;
        this.emit();
      }
      return { played: true };
    } catch (err) {
      this.alertAudio = null;
      if (err instanceof Error && err.name === "NotAllowedError") {
        this.autoplayBlocked = true;
        this.emit();
        return { played: false, reason: "autoplay_blocked" };
      }
      return {
        played: false,
        reason: "error",
        errorMessage: "Falha ao reproduzir alerta sonoro.",
      };
    }
  }
}

export const salesAudioEngine = new SalesAudioEngine();
