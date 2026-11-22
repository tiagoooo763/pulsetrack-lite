"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Banknote,
  Bell,
  Check,
  CheckCircle2,
  Coins,
  Music,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  DEFAULT_SOUND_PREFERENCES,
  MAX_CUSTOM_SOUND_BYTES,
  SOUND_LIBRARY_OPTIONS,
  type NotificationSoundId,
  type UserSoundPreferences,
} from "@/lib/notification-sounds";
import { salesAudioEngine } from "@/lib/sales-audio-engine";
import { SpotlightCard } from "@/components/SpotlightCard";

interface SalesSoundSettingsSectionProps {
  initialPreferences?: UserSoundPreferences;
  onPreferencesSaved?: (prefs: UserSoundPreferences) => void;
}

function getSoundIcon(id: NotificationSoundId) {
  switch (id) {
    case "cash_register":
      return Banknote;
    case "coins":
      return Coins;
    case "classic_bell":
      return Bell;
    case "soft_notification":
      return Sparkles;
    case "custom":
      return Music;
    case "silent":
      return VolumeX;
  }
}

export function SalesSoundSettingsSection({
  initialPreferences,
  onPreferencesSaved,
}: SalesSoundSettingsSectionProps) {
  const [savedPrefs, setSavedPrefs] = useState<UserSoundPreferences>(
    initialPreferences || {
      userId: "",
      ...DEFAULT_SOUND_PREFERENCES,
      updatedAt: "",
    }
  );
  const [soundEnabled, setSoundEnabled] = useState<boolean>(
    initialPreferences?.soundEnabled ?? DEFAULT_SOUND_PREFERENCES.soundEnabled
  );
  const [selectedSound, setSelectedSound] = useState<NotificationSoundId>(
    initialPreferences?.selectedSound ?? DEFAULT_SOUND_PREFERENCES.selectedSound
  );
  const [soundVolume, setSoundVolume] = useState<number>(
    initialPreferences?.soundVolume ?? DEFAULT_SOUND_PREFERENCES.soundVolume
  );
  const [customSignedUrl, setCustomSignedUrl] = useState<string | null>(null);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingCustom, setDeletingCustom] = useState(false);
  const [playingPreviewId, setPlayingPreviewId] =
    useState<NotificationSoundId | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSoundPrefs = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/sounds/preferences", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = (await res.json()) as {
        ok?: boolean;
        preferences?: UserSoundPreferences;
        customSignedUrl?: string | null;
      };
      if (json.ok && json.preferences) {
        setSavedPrefs(json.preferences);
        setSoundEnabled(json.preferences.soundEnabled);
        setSelectedSound(json.preferences.selectedSound);
        setSoundVolume(json.preferences.soundVolume);
        setCustomSignedUrl(json.customSignedUrl || null);
      }
    } catch {
      // Silencioso
    } finally {
      setLoadingPrefs(false);
    }
  }, []);

  useEffect(() => {
    fetchSoundPrefs();
    const unsub = salesAudioEngine.subscribe((s) => {
      setPlayingPreviewId(s.playingPreviewId);
    });
    return () => {
      unsub();
      salesAudioEngine.stopPreview();
    };
  }, [fetchSoundPrefs]);

  const hasUnsavedChanges =
    soundEnabled !== savedPrefs.soundEnabled ||
    selectedSound !== savedPrefs.selectedSound ||
    soundVolume !== savedPrefs.soundVolume;

  async function resolveFreshCustomUrl(): Promise<string | null> {
    if (customSignedUrl) return customSignedUrl;
    if (!savedPrefs.customSoundPath) return null;
    try {
      const res = await fetch("/api/notifications/sounds/custom", {
        cache: "no-store",
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { ok?: boolean; signedUrl?: string };
      if (json.ok && json.signedUrl) {
        setCustomSignedUrl(json.signedUrl);
        return json.signedUrl;
      }
    } catch {}
    return null;
  }

  async function handlePreview(
    soundId: NotificationSoundId,
    e?: React.MouseEvent
  ) {
    if (e) e.stopPropagation();
    setFeedback(null);

    let customUrl = customSignedUrl;
    if (soundId === "custom" && !customUrl) {
      customUrl = await resolveFreshCustomUrl();
    }

    const result = await salesAudioEngine.playPreview({
      soundId,
      volumePercent: soundVolume,
      customSignedUrl: customUrl,
    });

    if (!result.ok && result.error) {
      setFeedback({ type: "error", text: result.error });
    }
  }

  async function handleSavePreferences() {
    setFeedback(null);
    if (selectedSound === "custom" && !savedPrefs.customSoundPath) {
      setFeedback({
        type: "error",
        text: "Envie um arquivo MP3, WAV ou OGG antes de salvar 'Som personalizado'.",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/notifications/sounds/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          soundEnabled,
          selectedSound,
          soundVolume,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        preferences?: UserSoundPreferences;
        customSignedUrl?: string | null;
        message?: string;
        error?: string;
      };

      if (!res.ok || !json.ok || !json.preferences) {
        setFeedback({
          type: "error",
          text: json.error || "Não foi possível salvar suas preferências de som.",
        });
      } else {
        setSavedPrefs(json.preferences);
        setSoundEnabled(json.preferences.soundEnabled);
        setSelectedSound(json.preferences.selectedSound);
        setSoundVolume(json.preferences.soundVolume);
        if (json.customSignedUrl !== undefined) {
          setCustomSignedUrl(json.customSignedUrl);
        }
        onPreferencesSaved?.(json.preferences);
        setFeedback({
          type: "success",
          text: json.message || "Preferências de som salvas na sua conta.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Erro de comunicação ao salvar preferências de som.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleResetDefaults() {
    setFeedback(null);
    salesAudioEngine.stopPreview();
    setResetting(true);
    try {
      const res = await fetch("/api/notifications/sounds/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_defaults" }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        preferences?: UserSoundPreferences;
        message?: string;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.preferences) {
        setFeedback({
          type: "error",
          text: json.error || "Não foi possível restaurar o padrão.",
        });
      } else {
        setSavedPrefs(json.preferences);
        setSoundEnabled(json.preferences.soundEnabled);
        setSelectedSound(json.preferences.selectedSound);
        setSoundVolume(json.preferences.soundVolume);
        onPreferencesSaved?.(json.preferences);
        setFeedback({
          type: "success",
          text:
            json.message ||
            "Configurações restauradas para Caixa registradora (70%).",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Erro de conexão ao restaurar configurações padrão.",
      });
    } finally {
      setResetting(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);

    if (file.size > MAX_CUSTOM_SOUND_BYTES) {
      setFeedback({
        type: "error",
        text: "O arquivo selecionado ultrapassa o limite de 2 MB.",
      });
      e.target.value = "";
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!["mp3", "wav", "ogg"].includes(ext)) {
      setFeedback({
        type: "error",
        text: "Formato não permitido. Envie um áudio MP3, WAV ou OGG.",
      });
      e.target.value = "";
      return;
    }

    setUploading(true);
    salesAudioEngine.stopPreview();

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/notifications/sounds/custom", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json()) as {
        ok?: boolean;
        preferences?: UserSoundPreferences;
        customSignedUrl?: string | null;
        message?: string;
        error?: string;
      };

      if (!res.ok || !json.ok || !json.preferences) {
        setFeedback({
          type: "error",
          text: json.error || "Não foi possível enviar o áudio personalizado.",
        });
      } else {
        setSavedPrefs(json.preferences);
        setSelectedSound(json.preferences.selectedSound);
        setCustomSignedUrl(json.customSignedUrl || null);
        onPreferencesSaved?.(json.preferences);
        setFeedback({
          type: "success",
          text:
            json.message ||
            "Áudio personalizado enviado com segurança e selecionado.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Erro de rede ao enviar o arquivo de áudio.",
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDeleteCustomSound() {
    setFeedback(null);
    salesAudioEngine.stopPreview();
    setDeletingCustom(true);
    try {
      const res = await fetch("/api/notifications/sounds/custom", {
        method: "DELETE",
      });
      const json = (await res.json()) as {
        ok?: boolean;
        preferences?: UserSoundPreferences;
        message?: string;
        error?: string;
      };

      if (!res.ok || !json.ok || !json.preferences) {
        setFeedback({
          type: "error",
          text: json.error || "Não foi possível excluir o áudio personalizado.",
        });
      } else {
        setSavedPrefs(json.preferences);
        setSelectedSound(json.preferences.selectedSound);
        setCustomSignedUrl(null);
        onPreferencesSaved?.(json.preferences);
        setFeedback({
          type: "success",
          text: json.message || "Áudio personalizado excluído.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: "Erro ao remover o áudio personalizado.",
      });
    } finally {
      setDeletingCustom(false);
    }
  }

  return (
    <SpotlightCard className="p-5 sm:p-6 bento-card space-y-6">
      {/* Cabeçalho: Configurações -> Notificações -> Sons de vendas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
            <Volume2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-zinc-400">
              Configurações &rarr; Notificações &rarr;{" "}
              <span className="text-white">Sons de vendas</span>
            </div>
            <h3 className="text-base font-semibold text-white mt-0.5">
              Sons de Notificações de Vendas
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Personalize o alerta sonoro tocado na sua conta quando uma venda é
              efetivamente aprovada nos gateways integrados.
            </p>
          </div>
        </div>

        {/* Ativar / Desativar sons */}
        <label className="inline-flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#08080a] cursor-pointer shrink-0 select-none">
          <span className="text-xs font-medium text-zinc-200">
            {soundEnabled ? "Sons ativados" : "Sons desativados"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={soundEnabled}
            onClick={() => setSoundEnabled((prev) => !prev)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              soundEnabled ? "bg-white" : "bg-zinc-700"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full transition-transform ${
                soundEnabled
                  ? "translate-x-4 bg-black"
                  : "translate-x-1 bg-zinc-300"
              }`}
            />
          </button>
        </label>
      </div>

      {feedback && (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          className={`rounded-xl border p-3 text-xs flex items-start gap-2.5 ${
            feedback.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Controle deslizante de volume (0% a 100%, padrão 70%) */}
      <div className="rounded-xl border border-white/10 bg-[#08080a] p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="sales-sound-volume"
            className="text-xs font-medium text-zinc-200 flex items-center gap-2"
          >
            {soundVolume === 0 || !soundEnabled || selectedSound === "silent" ? (
              <VolumeX className="w-4 h-4 text-zinc-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-white" />
            )}
            <span>Volume das notificações</span>
          </label>
          <span className="text-xs font-mono font-semibold text-white tabular-nums">
            {soundVolume}%
          </span>
        </div>
        <input
          id="sales-sound-volume"
          type="range"
          min={0}
          max={100}
          step={1}
          value={soundVolume}
          onChange={(e) => setSoundVolume(Number(e.target.value))}
          className="w-full accent-white cursor-pointer"
        />
        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
          <span>0% (Mudo)</span>
          <span>70% (Padrão)</span>
          <span>100%</span>
        </div>
      </div>

      {/* Biblioteca de Sons (Cartões responsivos com prévia individual) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Biblioteca de Sons
          </h4>
          {loadingPrefs && (
            <span className="text-[11px] text-zinc-500">Carregando...</span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {SOUND_LIBRARY_OPTIONS.map((opt) => {
            const Icon = getSoundIcon(opt.id);
            const isSelected = selectedSound === opt.id;
            const isPlaying = playingPreviewId === opt.id;
            const isCustomMissing =
              opt.id === "custom" && !savedPrefs.customSoundPath;

            return (
              <div
                key={opt.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedSound(opt.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedSound(opt.id);
                  }
                }}
                className={`rounded-xl border p-4 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  isSelected
                    ? "border-white/50 bg-white/[0.08] shadow-sm"
                    : "border-white/10 bg-[#08080a] hover:border-white/25 hover:bg-white/[0.03]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "bg-white text-black border-white"
                          : "bg-white/5 text-zinc-200 border-white/10"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-white">
                          {opt.label}
                        </span>
                        {opt.isDefault && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold border border-white/15 bg-white/5 text-zinc-300">
                            Padrão
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                        {opt.id === "custom" && savedPrefs.customSoundName
                          ? `Arquivo: ${savedPrefs.customSoundName}`
                          : opt.description}
                      </p>
                    </div>
                  </div>

                  {/* Indicador de seleção */}
                  <span
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                      isSelected
                        ? "border-white bg-white text-black"
                        : "border-white/20 bg-transparent"
                    }`}
                    aria-hidden="true"
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                  </span>
                </div>

                {/* Botão Ouvir prévia / Parar */}
                {opt.id !== "silent" ? (
                  <button
                    type="button"
                    disabled={isCustomMissing}
                    onClick={(e) => handlePreview(opt.id, e)}
                    className={`btn-pressable w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-[11px] font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${
                      isPlaying
                        ? "border-white bg-white text-black"
                        : "border-white/15 bg-white/[0.04] hover:bg-white/[0.1] text-white"
                    }`}
                  >
                    {isPlaying ? (
                      <>
                        <Square className="w-3 h-3 fill-current" />
                        <span>Parar prévia</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        <span>Ouvir prévia</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="py-2 px-3 rounded-lg border border-white/[0.06] bg-white/[0.02] text-center text-[11px] text-zinc-500">
                    Sem reprodução de áudio
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Área de Upload de Som Personalizado (Bucket Privado) */}
      <div className="rounded-xl border border-white/10 bg-[#08080a] p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-semibold text-white flex items-center gap-2">
              <Music className="w-4 h-4 text-zinc-300" />
              <span>Áudio Personalizado (Privado na sua conta)</span>
            </h4>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Formatos aceitos: MP3, WAV ou OGG (até 2 MB). Armazenado em bucket
              privado acessível somente pela sua conta via URL temporária.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg"
            onChange={handleFileUpload}
            className="hidden"
          />

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="btn-pressable inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-white disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>
                {uploading
                  ? "Enviando..."
                  : savedPrefs.customSoundPath
                    ? "Substituir áudio"
                    : "Enviar áudio"}
              </span>
            </button>

            {savedPrefs.customSoundPath && (
              <>
                <button
                  type="button"
                  onClick={() => handlePreview("custom")}
                  className="btn-pressable inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-medium text-white"
                >
                  {playingPreviewId === "custom" ? (
                    <>
                      <Square className="w-3 h-3 fill-current" />
                      <span>Parar</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      <span>Ouvir</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={deletingCustom}
                  onClick={handleDeleteCustomSound}
                  className="btn-pressable inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.02] hover:border-rose-500/40 hover:text-rose-300 text-xs font-medium text-zinc-400 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deletingCustom ? "Excluindo..." : "Excluir"}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {savedPrefs.customSoundName && (
          <div className="rounded-lg border border-white/10 bg-[#050507] px-3 py-2 flex items-center justify-between gap-2 text-xs">
            <span className="text-zinc-300 truncate">
              Arquivo atual:{" "}
              <strong className="text-white font-mono">
                {savedPrefs.customSoundName}
              </strong>
            </span>
            <span className="text-[10px] text-emerald-400 shrink-0">
              Privado &bull; Autorizado
            </span>
          </div>
        )}
      </div>

      {/* Ações finais: Restaurar padrão & Salvar alterações */}
      <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleResetDefaults}
          disabled={resetting || saving}
          className="btn-pressable inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/15 bg-[#08080a] hover:bg-white/5 text-xs font-semibold text-zinc-300 hover:text-white disabled:opacity-50"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{resetting ? "Restaurando..." : "Restaurar padrão"}</span>
        </button>

        <div className="flex items-center gap-3">
          {hasUnsavedChanges && (
            <span className="text-[11px] text-amber-300">
              Alterações não salvas
            </span>
          )}
          <button
            type="button"
            onClick={handleSavePreferences}
            disabled={saving || resetting}
            className="btn-pressable flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-white hover:bg-zinc-100 text-black text-xs font-semibold disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>
    </SpotlightCard>
  );
}
