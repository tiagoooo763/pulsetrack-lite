"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Globe,
  Layers,
  LayoutDashboard,
  Lock,
  Mail,
  Megaphone,
  Menu,
  PieChart,
  Play,
  Plug,
  Receipt,
  Scale,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  TrendingUp,
  UserCheck,
  Volume2,
  Wallet,
  X,
} from "lucide-react";
import { DashfyBrand } from "@/components/dashfy/DashfyBrand";

interface PublicLandingPageProps {
  isLoggedIn: boolean;
}

const NAV_LINKS = [
  { href: "#inicio", label: "Início" },
  { href: "#visualizacoes", label: "Gráficos" },
  { href: "#sobre", label: "Sobre" },
  { href: "#funcionalidades", label: "Funcionalidades" },
  { href: "#integracoes", label: "Integrações" },
  { href: "#responsavel", label: "Responsável" },
  { href: "#contato", label: "Contato" },
];

type DemoPeriodKey = "7d" | "30d" | "90d";

const DEMO_SERIES: Record<
  DemoPeriodKey,
  {
    label: string;
    revenue: string;
    profit: string;
    roas: string;
    margin: string;
    salesCount: string;
    points: Array<{ label: string; rev: number; profit: number }>;
  }
> = {
  "7d": {
    label: "Últimos 7 dias",
    revenue: "R$ 18.420,00",
    profit: "R$ 9.180,00",
    roas: "3,24x",
    margin: "49,8%",
    salesCount: "94 vendas",
    points: [
      { label: "Seg", rev: 1900, profit: 890 },
      { label: "Ter", rev: 2350, profit: 1120 },
      { label: "Qua", rev: 2100, profit: 980 },
      { label: "Qui", rev: 2890, profit: 1470 },
      { label: "Sex", rev: 3420, profit: 1790 },
      { label: "Sáb", rev: 3110, profit: 1620 },
      { label: "Dom", rev: 2650, profit: 1310 },
    ],
  },
  "30d": {
    label: "Últimos 30 dias",
    revenue: "R$ 74.850,00",
    profit: "R$ 36.940,00",
    roas: "3,12x",
    margin: "49,4%",
    salesCount: "381 vendas",
    points: [
      { label: "S1", rev: 13200, profit: 6100 },
      { label: "S2", rev: 16800, profit: 8200 },
      { label: "S3", rev: 15400, profit: 7450 },
      { label: "S4", rev: 19600, profit: 9850 },
      { label: "S5", rev: 22900, profit: 11800 },
      { label: "S6", rev: 25100, profit: 13200 },
    ],
  },
  "90d": {
    label: "Trimestre (90D)",
    revenue: "R$ 218.600,00",
    profit: "R$ 109.420,00",
    roas: "3,38x",
    margin: "50,1%",
    salesCount: "1.114 vendas",
    points: [
      { label: "Mês 1", rev: 58400, profit: 27900 },
      { label: "Mês 2", rev: 72100, profit: 36400 },
      { label: "Mês 3", rev: 88100, profit: 45120 },
    ],
  },
};

const SOUND_DEMO_ITEMS = [
  {
    id: "cash_register",
    label: "Ka-Ching Clássico",
    sub: "Caixa registradora",
    src: "/sounds/cash-register.wav",
  },
  {
    id: "coins",
    label: "Chuva de Moedas",
    sub: "Moedas metálicas",
    src: "/sounds/coins.wav",
  },
  {
    id: "pix_money",
    label: "Dinheiro na Conta",
    sub: "Acorde Pix instantâneo",
    src: "/sounds/pix-money.wav",
  },
  {
    id: "jackpot_sale",
    label: "Venda Alta (Jackpot)",
    sub: "Fanfarra + moedas",
    src: "/sounds/jackpot-sale.wav",
  },
];

const FEATURES = [
  {
    icon: Layers,
    title: "Operações Livres (1, 2 e 3)",
    status: "Disponível",
    description:
      "Cada operação pode ser conectada livremente ao TikTok Ads ou ao seu gateway de pagamento (OmegaPay / Nexus), além da visão unificada no Dash Geral.",
  },
  {
    icon: TrendingUp,
    title: "ROAS, ROI e Margem Líquida",
    status: "Disponível",
    description:
      "Gráficos de curva, barras e composição financeira calculando automaticamente ROAS, ROI e lucro líquido após anúncios, taxas e despesas.",
  },
  {
    icon: Smartphone,
    title: "Alertas no Celular & Sons de Venda",
    status: "Disponível",
    description:
      "Receba notificações nativas com o símbolo da Dashfy ('Venda feita! Você recebeu R$...') e escolha entre 9 sons de dinheiro ou envie seu próprio áudio.",
  },
  {
    icon: BarChart3,
    title: "Acompanhamento de Campanhas",
    status: "Disponível",
    description:
      "Consolide investimento em mídia, impressões, cliques, CPC, CPM, conversões e receita atribuída via TikTok OAuth 2.0 ou importação CSV.",
  },
  {
    icon: Wallet,
    title: "Gestão Financeira Completa",
    status: "Disponível",
    description:
      "Acompanhe faturamento bruto, líquido, vendas aprovadas, recebimentos, saques, saldo disponível e histórico com filtros por período e produto.",
  },
  {
    icon: ShieldCheck,
    title: "Multi-Usuário com Isolamento RLS",
    status: "Disponível",
    description:
      "Contas individuais com confirmação de e-mail, recuperação de senha, credenciais restritas ao servidor e isolamento completo de dados por conta.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Crie sua conta isolada",
    description:
      "Cadastre-se em poucos segundos. Cada conta nasce em um workspace protegido por autenticação Supabase e políticas RLS.",
  },
  {
    step: "02",
    title: "Escolha o canal de cada operação",
    description:
      "Em Operação 1, Operação 2 ou Operação 3, abra Integrações e selecione TikTok Ads ou Gateway de Pagamento conforme sua estratégia.",
  },
  {
    step: "03",
    title: "Ative alertas no celular e som",
    description:
      "Escolha seu som de dinheiro favorito (Ka-Ching, Moedas, Pix, Cofre) e ative as notificações nativas no dispositivo.",
  },
  {
    step: "04",
    title: "Decida pelo lucro líquido real",
    description:
      "Acompanhe curvas diárias, composição financeira em donut, ROAS, ROI e margem real em tempo real.",
  },
];

const INTEGRATIONS: Array<{
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  status: string;
  statusTone: "emerald" | "amber" | "blue";
  description: string;
  detail: string;
}> = [
  {
    icon: Plug,
    name: "OmegaPay (API & Webhooks)",
    status: "Ativa",
    statusTone: "emerald",
    description:
      "Integração operacional via API e webhooks autenticados para acompanhamento de vendas, recebimentos, saldo, taxas e alertas em tempo real.",
    detail: "Credenciais armazenadas exclusivamente no servidor, isoladas por conta.",
  },
  {
    icon: Megaphone,
    name: "TikTok Ads (TikTok Marketing API)",
    status: "OAuth 2.0 (Somente Leitura)",
    statusTone: "emerald",
    description:
      "Integração via OAuth oficial para conexão de Business Centers e contas de anúncios autorizadas, com consulta somente-leitura de gastos e relatórios.",
    detail:
      "Não cria, edita nem exclui anúncios. Tokens armazenados criptografados no backend e isolados por conta.",
  },
  {
    icon: FileSpreadsheet,
    name: "Importação CSV de Campanhas",
    status: "Ativa",
    statusTone: "emerald",
    description:
      "Importação direta de relatórios de campanhas, conjuntos e anúncios para análise de investimento, cliques, conversões, ROAS e lucro estimado.",
    detail: "Compatível com planilhas CSV em formato brasileiro (;) e internacional (,).",
  },
  {
    icon: Activity,
    name: "Webhooks Personalizados & Receptor Nexus",
    status: "Compatível",
    statusTone: "blue",
    description:
      "Receptor de webhooks autenticado por usuário para registrar notificações de vendas e eventos financeiros com auditoria e deduplicação automática.",
    detail: "URL dedicada por conta autenticada, sem compartilhamento de dados entre usuários.",
  },
];

function buildSmoothCurve(pts: Array<{ x: number; y: number }>): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const mx = ((a.x + b.x) / 2).toFixed(1);
    d += ` C ${mx} ${a.y.toFixed(1)}, ${mx} ${b.y.toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }
  return d;
}

export function PublicLandingPage({ isLoggedIn }: PublicLandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [demoPeriod, setDemoPeriod] = useState<DemoPeriodKey>("30d");
  const [activeHeroOp, setActiveHeroOp] = useState<0 | 1 | 2>(0);
  const [playingSoundId, setPlayingSoundId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const activeDemo = DEMO_SERIES[demoPeriod];

  // Coordenadas do gráfico interativo da seção de visualizações
  const chartW = 540;
  const chartH = 190;
  const padX = 24;
  const padY = 20;
  const maxRev = Math.max(...activeDemo.points.map((p) => p.rev), 1) * 1.12;
  const plotted = activeDemo.points.map((p, idx) => {
    const ratio =
      activeDemo.points.length <= 1
        ? 0.5
        : idx / (activeDemo.points.length - 1);
    const x = padX + ratio * (chartW - padX * 2);
    const yRev = padY + (1 - p.rev / maxRev) * (chartH - padY * 2);
    const yProf = padY + (1 - p.profit / maxRev) * (chartH - padY * 2);
    return { ...p, x, yRev, yProf };
  });
  const revCurve = buildSmoothCurve(plotted.map((p) => ({ x: p.x, y: p.yRev })));
  const profCurve = buildSmoothCurve(plotted.map((p) => ({ x: p.x, y: p.yProf })));
  const revAreaPath =
    plotted.length >= 2
      ? `${revCurve} L ${plotted[plotted.length - 1].x.toFixed(1)} ${(chartH - padY).toFixed(1)} L ${plotted[0].x.toFixed(1)} ${(chartH - padY).toFixed(1)} Z`
      : "";

  const HERO_OPS = [
    {
      name: "Operação 1",
      tag: "TikTok Ads",
      rev: "R$ 42.850,00",
      ads: "R$ 14.200,00",
      roas: "3,02x • 148%",
      profit: "R$ 21.090,00",
    },
    {
      name: "Operação 2",
      tag: "Gateway OmegaPay",
      rev: "R$ 31.980,00",
      ads: "R$ 9.450,00",
      roas: "3,38x • 172%",
      profit: "R$ 17.640,00",
    },
    {
      name: "Operação 3",
      tag: "Escolha Livre",
      rev: "R$ 19.540,00",
      ads: "R$ 6.100,00",
      roas: "3,20x • 154%",
      profit: "R$ 10.310,00",
    },
  ];
  const heroOp = HERO_OPS[activeHeroOp];

  function handleCopyEmail() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText("contato@usedashfy.com.br");
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    }
  }

  async function handlePlayDemoSound(id: string, src: string) {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {}
      audioRef.current = null;
    }
    if (playingSoundId === id) {
      setPlayingSoundId(null);
      return;
    }
    try {
      const a = new Audio(src);
      a.volume = 0.72;
      audioRef.current = a;
      setPlayingSoundId(id);
      a.onended = () => setPlayingSoundId(null);
      a.onerror = () => setPlayingSoundId(null);
      await a.play();
    } catch {
      setPlayingSoundId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 relative overflow-x-hidden">
      {/* ==================== FORMAS GEOMÉTRICAS ARQUITETÔNICAS DE FUNDO ==================== */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        {/* Grade sutil com máscara radial */}
        <div
          className="absolute inset-0 opacity-[0.055]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #93c5fd 1px, transparent 1px), linear-gradient(to bottom, #93c5fd 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage:
              "radial-gradient(ellipse 80% 60% at 50% 10%, black 35%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 80% 60% at 50% 10%, black 35%, transparent 100%)",
          }}
        />
        {/* Anéis orbitais geométricos sutis */}
        <svg
          className="absolute -top-36 left-1/2 -translate-x-1/2 w-[1120px] h-[680px] opacity-[0.14]"
          viewBox="0 0 1120 680"
          fill="none"
        >
          <circle cx="560" cy="240" r="220" stroke="#3b8bff" strokeWidth="1" strokeDasharray="4 8" />
          <circle cx="560" cy="240" r="340" stroke="#60a5fa" strokeWidth="0.75" strokeOpacity="0.6" />
          <circle cx="560" cy="240" r="470" stroke="#1d74ff" strokeWidth="0.75" strokeDasharray="2 10" strokeOpacity="0.45" />
          <path d="M80 420 Q 320 260, 560 340 T 1040 220" stroke="#34d399" strokeWidth="1" strokeOpacity="0.45" />
        </svg>
        {/* Esferas de iluminação atmosférica */}
        <div className="absolute -top-44 left-1/2 -translate-x-1/2 w-[960px] h-[500px] rounded-full bg-[#1d74ff]/16 blur-[140px]" />
        <div className="absolute top-[36%] -right-48 w-[540px] h-[540px] rounded-full bg-[#0f4fd6]/12 blur-[150px]" />
        <div className="absolute top-[68%] -left-48 w-[460px] h-[460px] rounded-full bg-emerald-500/[0.06] blur-[140px]" />
      </div>

      {/* ==================== HEADER / NAVBAR ==================== */}
      <header className="sticky top-0 z-40 border-b border-blue-200/10 bg-[#030712]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 h-18 py-3.5 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center focus:outline-none rounded-lg"
            aria-label="Dashfy — Página inicial"
          >
            <DashfyBrand size="md" />
          </Link>

          <nav
            aria-label="Navegação principal"
            className="hidden lg:flex items-center gap-7 text-xs font-medium text-slate-300"
          >
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="hover:text-white transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden sm:flex items-center gap-3">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="btn-pressable inline-flex items-center gap-2 rounded-xl bg-[#1d74ff] hover:bg-[#2a80ff] text-white text-xs font-semibold px-4 py-2.5 shadow-[0_8px_24px_-6px_rgba(29,116,255,0.6)]"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Acessar Painel</span>
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="btn-pressable inline-flex items-center justify-center rounded-xl border border-blue-200/15 bg-white/[0.03] hover:bg-white/[0.08] hover:border-blue-200/30 text-white text-xs font-semibold px-4 py-2.5"
                >
                  Entrar
                </Link>
                <Link
                  href="/cadastro"
                  className="btn-pressable inline-flex items-center gap-1.5 rounded-xl bg-[#1d74ff] hover:bg-[#2a80ff] text-white text-xs font-semibold px-4 py-2.5 shadow-[0_8px_24px_-6px_rgba(29,116,255,0.6)]"
                >
                  <span>Criar conta</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="lg:hidden p-2.5 rounded-xl border border-blue-200/15 bg-white/[0.03] text-slate-200 hover:text-white"
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Menu Mobile */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-blue-200/10 bg-[#071022] px-5 py-5 space-y-4">
            <div className="flex flex-col space-y-1">
              {NAV_LINKS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2.5 rounded-xl text-sm text-slate-200 hover:bg-white/5 hover:text-white transition"
                >
                  {item.label}
                </a>
              ))}
              <Link
                href="/privacidade"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-xl text-sm text-slate-300 hover:bg-white/5 hover:text-white transition"
              >
                Política de Privacidade
              </Link>
              <Link
                href="/termos"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-xl text-sm text-slate-300 hover:bg-white/5 hover:text-white transition"
              >
                Termos de Uso
              </Link>
            </div>

            <div className="pt-3 border-t border-blue-200/10 flex flex-col gap-2.5">
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  className="btn-pressable w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1d74ff] text-white text-sm font-semibold py-3"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Acessar Painel</span>
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="btn-pressable w-full inline-flex items-center justify-center rounded-xl border border-blue-200/15 bg-white/[0.04] text-white text-sm font-semibold py-3"
                  >
                    Entrar
                  </Link>
                  <Link
                    href="/cadastro"
                    className="btn-pressable w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1d74ff] text-white text-sm font-semibold py-3"
                  >
                    <span>Criar conta</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="relative z-10">
        {/* ==================== 1. INÍCIO (HERO) ==================== */}
        <section
          id="inicio"
          className="pt-16 pb-24 sm:pt-24 sm:pb-32 relative"
        >
          <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
              <div className="lg:col-span-6 space-y-7 animate-fade-in-up">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#1d74ff]/35 bg-[#1d74ff]/10 px-4 py-1.5 text-xs font-medium text-sky-300">
                  <Sparkles className="w-3.5 h-3.5 text-[#5ea1ff]" />
                  <span>Marketing Digital, Gateways &amp; Lucro Líquido Real</span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-[3.35rem] font-bold tracking-tight text-white leading-[1.08]">
                  Seus anúncios, suas vendas e seu{" "}
                  <span className="bg-gradient-to-r from-[#5ea1ff] via-[#3b8bff] to-emerald-400 bg-clip-text text-transparent">
                    lucro líquido em tempo real.
                  </span>
                </h1>

                <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
                  A <strong className="text-white font-semibold">Dashfy</strong>{" "}
                  reúne operações flexíveis (conecte TikTok Ads ou seu gateway em qualquer operação), gráficos claros de ROAS e margem, e alertas de venda com som de dinheiro direto no seu telefone.
                </p>

                <div className="flex flex-wrap items-center gap-3.5 pt-1">
                  <Link
                    href={isLoggedIn ? "/dashboard" : "/cadastro"}
                    className="btn-pressable inline-flex items-center gap-2 rounded-xl bg-[#1d74ff] hover:bg-[#2a80ff] text-white text-sm font-semibold px-6 py-3.5 shadow-[0_14px_34px_-8px_rgba(29,116,255,0.65)]"
                  >
                    <span>{isLoggedIn ? "Ir para o meu painel" : "Começar agora"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  {!isLoggedIn && (
                    <Link
                      href="/login"
                      className="btn-pressable inline-flex items-center gap-2 rounded-xl border border-blue-200/20 bg-white/[0.04] hover:bg-white/[0.08] text-white text-sm font-semibold px-6 py-3.5"
                    >
                      <span>Entrar</span>
                    </Link>
                  )}

                  <a
                    href="#visualizacoes"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white px-3 py-2 transition-colors"
                  >
                    <span>Explorar gráficos</span>
                  </a>
                </div>

                <div className="pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-400">
                  <div className="flex items-center gap-2 rounded-xl border border-blue-200/10 bg-white/[0.02] px-3.5 py-2.5">
                    <Lock className="w-3.5 h-3.5 text-[#5ea1ff] shrink-0" />
                    <span>Auth &amp; RLS isolado</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-blue-200/10 bg-white/[0.02] px-3.5 py-2.5">
                    <BellRing className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Alertas no celular</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-blue-200/10 bg-white/[0.02] px-3.5 py-2.5">
                    <Globe className="w-3.5 h-3.5 text-[#5ea1ff] shrink-0" />
                    <span>usedashfy.com.br</span>
                  </div>
                </div>
              </div>

              {/* Prévia interativa honesta com gráfico SVG + seletor de operações + notificação mobile */}
              <div className="lg:col-span-6 relative">
                {/* Glow de contorno suave */}
                <div
                  className="absolute -inset-1 rounded-[28px] bg-gradient-to-br from-[#1d74ff]/25 via-transparent to-emerald-400/20 blur-xl opacity-70 pointer-events-none"
                  aria-hidden="true"
                />

                <div className="relative rounded-3xl border border-blue-300/20 bg-[#081122]/95 p-5 sm:p-7 shadow-[0_28px_70px_-20px_rgba(0,0,0,0.9)] space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-blue-200/10">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
                      <span className="text-xs font-semibold text-white">
                        Dashfy — {heroOp.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#1d74ff]/15 border border-[#1d74ff]/30 text-sky-300">
                        {heroOp.tag}
                      </span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium border border-blue-300/20 bg-white/[0.03] text-slate-300">
                      Prévia ilustrativa
                    </span>
                  </div>

                  {/* Seletor clicável das 3 operações flexíveis */}
                  <div className="grid grid-cols-3 gap-2">
                    {HERO_OPS.map((op, i) => {
                      const active = activeHeroOp === i;
                      return (
                        <button
                          key={op.name}
                          type="button"
                          onClick={() => setActiveHeroOp(i as 0 | 1 | 2)}
                          className={`rounded-xl border px-3 py-2 text-left transition-all ${
                            active
                              ? "border-[#1d74ff]/60 bg-[#1d74ff]/15 text-white"
                              : "border-blue-200/10 bg-[#050c1a] text-slate-400 hover:text-white hover:border-blue-200/25"
                          }`}
                        >
                          <div className="text-[11px] font-semibold truncate">{op.name}</div>
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">{op.tag}</div>
                        </button>
                      );
                    })}
                  </div>

                  {/* 4 KPIs */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="rounded-2xl border border-blue-200/10 bg-[#050c1a] p-4">
                      <span className="text-[11px] text-slate-400 block">Faturamento Bruto</span>
                      <span className="text-lg font-bold font-mono tabular-nums text-white mt-1 block">
                        {heroOp.rev}
                      </span>
                    </div>

                    <div className="rounded-2xl border border-blue-200/10 bg-[#050c1a] p-4">
                      <span className="text-[11px] text-slate-400 block">Gastos com Anúncios</span>
                      <span className="text-lg font-bold font-mono tabular-nums text-white mt-1 block">
                        {heroOp.ads}
                      </span>
                    </div>

                    <div className="rounded-2xl border border-blue-200/10 bg-[#050c1a] p-4">
                      <span className="text-[11px] text-slate-400 block">ROAS / ROI</span>
                      <span className="text-lg font-bold font-mono tabular-nums text-emerald-400 mt-1 block">
                        {heroOp.roas}
                      </span>
                    </div>

                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-4">
                      <span className="text-[11px] text-emerald-200/80 block">Lucro Líquido</span>
                      <span className="text-lg font-bold font-mono tabular-nums text-emerald-400 mt-1 block">
                        {heroOp.profit}
                      </span>
                    </div>
                  </div>

                  {/* Mini curva SVG de evolução */}
                  <div className="rounded-2xl border border-blue-200/10 bg-[#050c1a] p-4 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300 font-medium">Curva de Faturamento &amp; Lucro</span>
                      <span className="text-emerald-400 font-mono text-[10px]">Tempo real</span>
                    </div>
                    <svg viewBox="0 0 360 72" className="w-full h-16 overflow-visible">
                      <defs>
                        <linearGradient id="heroCurveFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b8bff" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#3b8bff" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M 4 56 C 45 48, 70 52, 110 38 C 155 24, 185 32, 230 22 C 275 12, 315 16, 356 8 L 356 70 L 4 70 Z"
                        fill="url(#heroCurveFill)"
                      />
                      <path
                        d="M 4 56 C 45 48, 70 52, 110 38 C 155 24, 185 32, 230 22 C 275 12, 315 16, 356 8"
                        fill="none"
                        stroke="#3b8bff"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                      />
                      <path
                        d="M 4 64 C 45 58, 70 60, 110 49 C 155 40, 185 44, 230 35 C 275 26, 315 29, 356 20"
                        fill="none"
                        stroke="#34d399"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <circle cx="356" cy="8" r="4" fill="#60a5fa" />
                      <circle cx="356" cy="20" r="3.5" fill="#34d399" />
                    </svg>
                  </div>

                  {/* Card de notificação mobile flutuante integrado */}
                  <div className="rounded-2xl border border-emerald-400/25 bg-[#061322] p-3.5 flex items-center gap-3 shadow-lg">
                    <div className="w-10 h-10 rounded-xl bg-[#0a1c36] border border-blue-400/30 flex items-center justify-center shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/assets/logo-dashfy-icon.png"
                        alt="Dashfy"
                        className="w-7 h-7 object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-white">
                          Venda feita! &bull; Dashfy
                        </span>
                        <span className="text-[10px] text-emerald-300 font-mono">agora</span>
                      </div>
                      <p className="text-[11px] text-slate-300 truncate mt-0.5">
                        Você recebeu <strong className="text-emerald-400 font-mono">R$ 297,00</strong> — Produto Digital (PIX)
                      </p>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    * Valores exibidos acima são ilustrativos. Os dados reais de cada usuário exigem autenticação individual.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="h-px bg-gradient-to-r from-transparent via-blue-400/25 to-transparent" />

        {/* ==================== 2. NOVA SEÇÃO: GRÁFICOS INTERATIVOS, CELULAR E SONS ==================== */}
        <section id="visualizacoes" className="py-24 sm:py-32 bg-[#050c1a]/75">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 space-y-14">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div className="max-w-2xl space-y-3">
                <span className="text-xs font-semibold uppercase tracking-widest text-[#5ea1ff]">
                  Inteligência Visual &amp; Alertas
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
                  Gráficos nítidos, composição do lucro e alertas com som de dinheiro
                </h2>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  Visualize exatamente para onde vai cada real da sua operação e experimente os alertas de venda direto abaixo.
                </p>
              </div>

              {/* Botões de período da demonstração */}
              <div className="inline-flex items-center gap-1 rounded-xl border border-blue-200/15 bg-[#081122] p-1 self-start lg:self-auto">
                {(["7d", "30d", "90d"] as DemoPeriodKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDemoPeriod(key)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                      demoPeriod === key
                        ? "bg-[#1d74ff] text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {key.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Gráfico de Curva Interativo */}
              <div className="lg:col-span-7 rounded-3xl border border-blue-200/15 bg-[#081225] p-6 sm:p-8 flex flex-col justify-between space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-400">{activeDemo.label} • Exemplo interativo</div>
                    <div className="mt-1 flex flex-wrap items-baseline gap-3">
                      <span className="text-2xl sm:text-3xl font-bold font-mono text-white tabular-nums">
                        {activeDemo.revenue}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                        Lucro {activeDemo.profit}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">ROAS</span>
                      <span className="text-emerald-400 font-bold">{activeDemo.roas}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Margem</span>
                      <span className="text-white font-bold">{activeDemo.margin}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase">Volume</span>
                      <span className="text-sky-300 font-bold">{activeDemo.salesCount}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-200/10 bg-[#050b18] p-4">
                  <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-48 overflow-visible">
                    <defs>
                      <linearGradient id="landingRevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b8bff" stopOpacity="0.32" />
                        <stop offset="100%" stopColor="#3b8bff" stopOpacity="0.01" />
                      </linearGradient>
                    </defs>
                    {[0.25, 0.5, 0.75, 1].map((s) => (
                      <line
                        key={s}
                        x1={padX}
                        x2={chartW - padX}
                        y1={padY + (chartH - padY * 2) * s}
                        y2={padY + (chartH - padY * 2) * s}
                        stroke="rgba(148,163,184,0.12)"
                        strokeDasharray="4 5"
                      />
                    ))}
                    {revAreaPath && <path d={revAreaPath} fill="url(#landingRevGrad)" />}
                    <path
                      d={revCurve}
                      fill="none"
                      stroke="#3b8bff"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <path
                      d={profCurve}
                      fill="none"
                      stroke="#34d399"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    />
                    {plotted.map((p) => (
                      <g key={p.label}>
                        <circle cx={p.x} cy={p.yRev} r="4.5" fill="#60a5fa" stroke="#050b18" strokeWidth="2" />
                        <circle cx={p.x} cy={p.yProf} r="3.5" fill="#34d399" stroke="#050b18" strokeWidth="1.5" />
                        <text
                          x={p.x}
                          y={chartH - 3}
                          textAnchor="middle"
                          fontSize="11"
                          fill="#94a3b8"
                          fontFamily="var(--font-mono), monospace"
                        >
                          {p.label}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#3b8bff]" />
                      Faturamento
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      Lucro Líquido
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Disponível no Dash Geral e em todas as 3 operações
                  </span>
                </div>
              </div>

              {/* Coluna direita: Donut de Margem + Prévia de Sons de Dinheiro */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                {/* Donut de Composição */}
                <div className="rounded-3xl border border-blue-200/15 bg-[#081225] p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PieChart className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-sm font-semibold text-white">
                        Distribuição da Receita
                      </h3>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-300">Margem real</span>
                  </div>

                  <div className="flex items-center gap-5">
                    <div className="relative w-28 h-28 shrink-0">
                      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                        <circle cx="60" cy="60" r="44" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="12" />
                        {/* 49% Lucro */}
                        <circle
                          cx="60"
                          cy="60"
                          r="44"
                          fill="none"
                          stroke="#34d399"
                          strokeWidth="12"
                          strokeDasharray="135.5 276.5"
                          strokeDashoffset="0"
                        />
                        {/* 33% Mídia */}
                        <circle
                          cx="60"
                          cy="60"
                          r="44"
                          fill="none"
                          stroke="#3b8bff"
                          strokeWidth="12"
                          strokeDasharray="91.2 276.5"
                          strokeDashoffset="-135.5"
                        />
                        {/* 11% Taxas */}
                        <circle
                          cx="60"
                          cy="60"
                          r="44"
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="12"
                          strokeDasharray="30.4 276.5"
                          strokeDashoffset="-226.7"
                        />
                        {/* 7% Outros */}
                        <circle
                          cx="60"
                          cy="60"
                          r="44"
                          fill="none"
                          stroke="#71717a"
                          strokeWidth="12"
                          strokeDasharray="19.4 276.5"
                          strokeDashoffset="-257.1"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[10px] text-slate-400">Lucro</span>
                        <span className="text-base font-bold font-mono text-emerald-400">49%</span>
                      </div>
                    </div>

                    <div className="flex-1 space-y-2 text-xs">
                      {[
                        { label: "Lucro Líquido", pct: "49%", color: "bg-emerald-400" },
                        { label: "Anúncios (Ads)", pct: "33%", color: "bg-[#3b8bff]" },
                        { label: "Taxas Gateway", pct: "11%", color: "bg-amber-400" },
                        { label: "Despesas Extras", pct: "7%", color: "bg-zinc-500" },
                      ].map((row) => (
                        <div key={row.label} className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 text-slate-300">
                            <span className={`w-2 h-2 rounded-full ${row.color}`} />
                            {row.label}
                          </span>
                          <span className="font-mono font-semibold text-white">{row.pct}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sons de Dinheiro — Prévia ao vivo */}
                <div className="rounded-3xl border border-blue-200/15 bg-[#081225] p-6 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-[#5ea1ff]" />
                      <h3 className="text-sm font-semibold text-white">
                        Sons de Dinheiro nas Vendas
                      </h3>
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300">
                      Clique para ouvir
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {SOUND_DEMO_ITEMS.map((item) => {
                      const playing = playingSoundId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handlePlayDemoSound(item.id, item.src)}
                          className={`btn-pressable rounded-xl border p-3 text-left transition flex items-center justify-between gap-2 ${
                            playing
                              ? "border-emerald-400/50 bg-emerald-500/15 text-white"
                              : "border-blue-200/10 bg-[#050b18] hover:border-[#1d74ff]/45 text-slate-200"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold truncate">{item.label}</div>
                            <div className="text-[10px] text-slate-400 truncate">{item.sub}</div>
                          </div>
                          <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                            {playing ? (
                              <Coins className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
                            ) : (
                              <Play className="w-3 h-3 text-sky-300 ml-0.5" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="h-px bg-gradient-to-r from-transparent via-blue-400/20 to-transparent" />

        {/* ==================== 3. SOBRE A DASHFY ==================== */}
        <section id="sobre" className="py-24 sm:py-32">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
              <div className="lg:col-span-5 space-y-4">
                <span className="text-xs font-semibold uppercase tracking-widest text-[#5ea1ff]">
                  Sobre a Dashfy
                </span>
                <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
                  Gestão financeira e mídia paga conectadas à realidade da sua operação.
                </h2>
              </div>

              <div className="lg:col-span-7 space-y-5 text-sm sm:text-base text-slate-300 leading-relaxed">
                <p>
                  A <strong className="text-white">Dashfy</strong> é uma plataforma SaaS desenvolvida para empreendedores digitais, gestores de tráfego e equipes de marketing que precisam acompanhar o desempenho real das campanhas junto aos custos financeiros da operação.
                </p>
                <p>
                  Em vez de analisar apenas faturamento bruto ou métricas isoladas, a Dashfy reúne investimento em anúncios, taxas, despesas, vendas aprovadas e alertas instantâneos em operações totalmente flexíveis — permitindo calcular ROAS, ROI e margem líquida com clareza.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3">
                  {[
                    {
                      icon: Layers,
                      title: "3 Operações Livres",
                      desc: "Escolha TikTok Ads ou Gateway de Pagamento em qualquer operação.",
                    },
                    {
                      icon: CreditCard,
                      title: "Lucro Sem Mistura",
                      desc: "Receita, taxas, despesas e margem líquida separados com transparência.",
                    },
                    {
                      icon: ShieldCheck,
                      title: "Acesso Protegido",
                      desc: "Cada conta acessa exclusivamente seus próprios dados via Auth + RLS.",
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.title}
                        className="rounded-2xl border border-blue-200/12 bg-[#081225]/90 p-5 space-y-2.5"
                      >
                        <div className="w-9 h-9 rounded-xl bg-[#1d74ff]/15 border border-[#1d74ff]/30 flex items-center justify-center text-[#5ea1ff]">
                          <Icon className="w-4 h-4" />
                        </div>
                        <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="h-px bg-gradient-to-r from-transparent via-blue-400/20 to-transparent" />

        {/* ==================== 4. FUNCIONALIDADES ==================== */}
        <section id="funcionalidades" className="py-24 sm:py-32 bg-[#050c1a]/75">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 space-y-14">
            <div className="max-w-2xl space-y-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#5ea1ff]">
                Funcionalidades
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Tudo o que você precisa para escalar com controle financeiro
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Cada módulo da Dashfy foi projetado para velocidade, clareza visual e separação real entre canais de aquisição, gateways e custos.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((feat) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={feat.title}
                    className="rounded-3xl border border-blue-200/12 bg-[#081225] hover:border-[#1d74ff]/50 hover:-translate-y-0.5 transition-all duration-200 p-7 flex flex-col justify-between space-y-5"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="w-11 h-11 rounded-2xl bg-[#1d74ff]/15 border border-[#1d74ff]/30 flex items-center justify-center text-[#5ea1ff]">
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-400/25 bg-emerald-500/10 text-emerald-300">
                          {feat.status}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-semibold text-white">{feat.title}</h3>
                        <p className="text-xs sm:text-sm text-slate-400 mt-2.5 leading-relaxed">
                          {feat.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <div className="h-px bg-gradient-to-r from-transparent via-blue-400/20 to-transparent" />

        {/* ==================== 5. COMO FUNCIONA ==================== */}
        <section id="como-funciona" className="py-24 sm:py-32">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 space-y-14">
            <div className="max-w-2xl space-y-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#5ea1ff]">
                Como funciona
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Do cadastro ao controle total em 4 passos
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Workspace isolado, integração sob escolha livre em cada operação e alertas em tempo real.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {STEPS.map((item) => (
                <div
                  key={item.step}
                  className="rounded-3xl border border-blue-200/12 bg-[#081225]/90 p-7 space-y-4 relative overflow-hidden"
                >
                  <span className="inline-flex items-center justify-center px-3 py-1 rounded-xl bg-[#1d74ff]/15 border border-[#1d74ff]/30 text-xs font-mono font-bold text-[#5ea1ff]">
                    {item.step}
                  </span>
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="h-px bg-gradient-to-r from-transparent via-blue-400/20 to-transparent" />

        {/* ==================== 6. INTEGRAÇÕES ==================== */}
        <section id="integracoes" className="py-24 sm:py-32 bg-[#050c1a]/75">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 space-y-12">
            <div className="max-w-3xl space-y-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#5ea1ff]">
                Integrações
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Status transparente das integrações da plataforma
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Em qualquer operação você escolhe integrar com TikTok Ads ou com seu gateway de pagamento, com credenciais mantidas exclusivamente no servidor.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {INTEGRATIONS.map((integ) => {
                const Icon = integ.icon;
                const badgeClass =
                  integ.statusTone === "emerald"
                    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
                    : integ.statusTone === "amber"
                      ? "border-amber-400/30 bg-amber-500/10 text-amber-300"
                      : "border-[#1d74ff]/40 bg-[#1d74ff]/15 text-sky-300";

                return (
                  <div
                    key={integ.name}
                    className="rounded-3xl border border-blue-200/12 bg-[#081225] p-7 space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-white/[0.04] border border-blue-200/15 flex items-center justify-center text-sky-300 shrink-0">
                          <Icon className="w-5 h-5" />
                        </div>
                        <h3 className="text-base font-semibold text-white">{integ.name}</h3>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${badgeClass}`}
                      >
                        {integ.statusTone === "amber" ? (
                          <Clock className="w-3 h-3 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                        )}
                        <span>{integ.status}</span>
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {integ.description}
                    </p>

                    <div className="pt-3.5 border-t border-blue-200/10 text-xs text-slate-400">
                      {integ.detail}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border border-blue-300/15 bg-[#081225] p-5 flex items-start gap-3 text-xs text-slate-300 leading-relaxed">
              <SlidersHorizontal className="w-4 h-4 text-[#5ea1ff] shrink-0 mt-0.5" />
              <p>
                <strong className="text-white">Aviso de independência:</strong> A Dashfy é um software independente de análise de marketing e gestão financeira. Não possuímos afiliação, endosso ou parceria comercial oficial com o TikTok ou outras plataformas de anúncios. O acesso a APIs de terceiros ocorre exclusivamente mediante autorização OAuth expressa do próprio usuário.
              </p>
            </div>
          </div>
        </section>

        <div className="h-px bg-gradient-to-r from-transparent via-blue-400/20 to-transparent" />

        {/* ==================== 7. SOBRE O PROJETO E RESPONSÁVEL ==================== */}
        <section id="responsavel" className="py-24 sm:py-32">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
            <div className="rounded-3xl border border-blue-200/15 bg-[#081225] p-7 sm:p-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              <div className="lg:col-span-5 space-y-4">
                <span className="text-xs font-semibold uppercase tracking-widest text-[#5ea1ff]">
                  Sobre o projeto e responsável
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Transparência sobre quem desenvolve e opera a Dashfy
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  A Dashfy é um projeto SaaS independente idealizado, desenvolvido e mantido no Brasil com foco em simplicidade operacional, clareza de métricas e proteção de dados dos usuários.
                </p>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-blue-200/10 bg-[#050b18] p-5 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <UserCheck className="w-4 h-4 text-[#5ea1ff]" />
                    <span>Responsável pelo projeto</span>
                  </div>
                  <p className="text-sm font-semibold text-white">Tiago Mendonça</p>
                  <p className="text-xs text-slate-400">Fundador e Desenvolvedor Independente</p>
                </div>

                <div className="rounded-2xl border border-blue-200/10 bg-[#050b18] p-5 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Globe className="w-4 h-4 text-[#5ea1ff]" />
                    <span>Site oficial &amp; País</span>
                  </div>
                  <p className="text-sm font-semibold text-white">https://www.usedashfy.com.br</p>
                  <p className="text-xs text-slate-400">Operação no Brasil</p>
                </div>

                <div className="rounded-2xl border border-blue-200/10 bg-[#050b18] p-5 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Mail className="w-4 h-4 text-[#5ea1ff]" />
                    <span>E-mail profissional</span>
                  </div>
                  <a
                    href="mailto:contato@usedashfy.com.br"
                    className="text-sm font-semibold text-sky-300 hover:text-white transition-colors block break-all"
                  >
                    contato@usedashfy.com.br
                  </a>
                  <p className="text-xs text-slate-400">Suporte, privacidade e revisões técnicas</p>
                </div>

                <div className="rounded-2xl border border-blue-200/10 bg-[#050b18] p-5 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Shield className="w-4 h-4 text-[#5ea1ff]" />
                    <span>Arquitetura e Segurança</span>
                  </div>
                  <p className="text-sm font-semibold text-white">
                    Next.js &bull; PostgreSQL (Supabase) &bull; Vercel
                  </p>
                  <p className="text-xs text-slate-400">
                    Sessões autenticadas, HTTPS e Row Level Security (RLS)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="h-px bg-gradient-to-r from-transparent via-blue-400/20 to-transparent" />

        {/* ==================== 8. CONTATO ==================== */}
        <section id="contato" className="py-24 sm:py-32 bg-[#050c1a]/75">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10">
            <div className="rounded-3xl border border-[#1d74ff]/30 bg-gradient-to-br from-[#0b1833] via-[#091326] to-[#050b18] p-7 sm:p-12 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="space-y-3 max-w-2xl">
                <span className="text-xs font-semibold uppercase tracking-widest text-[#5ea1ff]">
                  Contato
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Fale com a equipe da Dashfy
                </h2>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  Para suporte técnico, dúvidas comerciais, solicitações de revisão de integrações (como TikTok for Business Developers) ou pedidos relacionados à privacidade e exclusão de dados, utilize nosso canal oficial por e-mail.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
                <a
                  href="mailto:contato@usedashfy.com.br"
                  className="btn-pressable inline-flex items-center justify-center gap-2 rounded-xl bg-[#1d74ff] hover:bg-[#2a80ff] text-white text-sm font-semibold px-6 py-3.5 shadow-[0_10px_28px_-8px_rgba(29,116,255,0.6)]"
                >
                  <Mail className="w-4 h-4" />
                  <span>contato@usedashfy.com.br</span>
                </a>

                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="btn-pressable inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200/20 bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 text-xs font-semibold px-5 py-2.5"
                >
                  {copiedEmail ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300">E-mail copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar endereço de e-mail</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className="h-px bg-gradient-to-r from-transparent via-blue-400/20 to-transparent" />

        {/* ==================== 9. PRIVACIDADE E TERMOS ==================== */}
        <section className="py-24 sm:py-32">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 space-y-10">
            <div className="max-w-2xl space-y-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#5ea1ff]">
                Documentação Legal &amp; Conformidade
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Política de Privacidade e Termos de Uso
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <article
                id="privacidade"
                className="rounded-3xl border border-blue-200/12 bg-[#081225] p-7 sm:p-8 flex flex-col justify-between space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#1d74ff]/15 border border-[#1d74ff]/30 flex items-center justify-center text-[#5ea1ff]">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Política de Privacidade</h3>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    A Dashfy trata os dados pessoais e operacionais estritamente para fornecer as funcionalidades de autenticação, análise de campanhas e gestão financeira ao próprio usuário titular da conta, em conformidade com a LGPD (Lei nº 13.709/2018).
                  </p>

                  <ul className="space-y-2.5 text-xs text-slate-400">
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#5ea1ff] shrink-0 mt-0.5" />
                      <span>Não vendemos nem compartilhamos dados financeiros ou de campanhas dos usuários com terceiros.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#5ea1ff] shrink-0 mt-0.5" />
                      <span>Credenciais de integração e tokens ficam restritos ao backend e protegidos por RLS.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#5ea1ff] shrink-0 mt-0.5" />
                      <span>
                        Solicitações de acesso, correção ou exclusão podem ser enviadas para{" "}
                        <span className="text-slate-200">contato@usedashfy.com.br</span>.
                      </span>
                    </li>
                  </ul>
                </div>

                <div>
                  <Link
                    href="/privacidade"
                    className="btn-pressable inline-flex items-center gap-2 rounded-xl border border-blue-200/15 bg-white/[0.04] hover:bg-white/[0.08] text-white text-xs font-semibold px-4 py-2.5"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#5ea1ff]" />
                    <span>Ler Política de Privacidade completa</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </article>

              <article
                id="termos"
                className="rounded-3xl border border-blue-200/12 bg-[#081225] p-7 sm:p-8 flex flex-col justify-between space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#1d74ff]/15 border border-[#1d74ff]/30 flex items-center justify-center text-[#5ea1ff]">
                      <Scale className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Termos de Uso</h3>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    O acesso aos painéis e ferramentas da Dashfy requer cadastro individual e concordância com as regras de uso responsável da plataforma, veracidade das informações fornecidas e proteção das credenciais de login.
                  </p>

                  <ul className="space-y-2.5 text-xs text-slate-400">
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#5ea1ff] shrink-0 mt-0.5" />
                      <span>O usuário é o único titular dos dados financeiros e de campanhas que importa ou conecta à sua conta.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#5ea1ff] shrink-0 mt-0.5" />
                      <span>Integrações externas dependem da autorização do usuário e da disponibilidade das APIs de terceiros.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#5ea1ff] shrink-0 mt-0.5" />
                      <span>A Dashfy atua como ferramenta de apoio analítico e não substitui assessoria contábil, fiscal ou jurídica.</span>
                    </li>
                  </ul>
                </div>

                <div>
                  <Link
                    href="/termos"
                    className="btn-pressable inline-flex items-center gap-2 rounded-xl border border-blue-200/15 bg-white/[0.04] hover:bg-white/[0.08] text-white text-xs font-semibold px-4 py-2.5"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#5ea1ff]" />
                    <span>Ler Termos de Uso completos</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </article>
            </div>
          </div>
        </section>
      </main>

      {/* ==================== FOOTER ==================== */}
      <footer className="relative z-10 border-t border-blue-200/10 bg-[#02050c]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-10 py-14 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-5 space-y-3">
              <DashfyBrand size="md" />
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                Plataforma SaaS de análise de marketing digital e gestão financeira para acompanhamento de campanhas, gastos, ROAS, ROI, alertas móveis e lucro líquido.
              </p>
              <p className="text-xs text-slate-500">
                Responsável: Tiago Mendonça &bull;{" "}
                <a
                  href="mailto:contato@usedashfy.com.br"
                  className="text-slate-300 hover:text-white transition-colors"
                >
                  contato@usedashfy.com.br
                </a>
              </p>
            </div>

            <div className="md:col-span-3 space-y-2.5 text-xs">
              <div className="font-semibold text-white">Navegação</div>
              <ul className="space-y-2 text-slate-400">
                <li>
                  <a href="#visualizacoes" className="hover:text-white transition">
                    Gráficos &amp; Alertas
                  </a>
                </li>
                <li>
                  <a href="#sobre" className="hover:text-white transition">
                    Sobre a Dashfy
                  </a>
                </li>
                <li>
                  <a href="#funcionalidades" className="hover:text-white transition">
                    Funcionalidades
                  </a>
                </li>
                <li>
                  <a href="#integracoes" className="hover:text-white transition">
                    Integrações
                  </a>
                </li>
              </ul>
            </div>

            <div className="md:col-span-2 space-y-2.5 text-xs">
              <div className="font-semibold text-white">Acesso</div>
              <ul className="space-y-2 text-slate-400">
                <li>
                  <Link href="/login" className="hover:text-white transition">
                    Entrar
                  </Link>
                </li>
                <li>
                  <Link href="/cadastro" className="hover:text-white transition">
                    Criar conta
                  </Link>
                </li>
                <li>
                  <Link href="/recuperar-senha" className="hover:text-white transition">
                    Recuperar senha
                  </Link>
                </li>
              </ul>
            </div>

            <div className="md:col-span-2 space-y-2.5 text-xs">
              <div className="font-semibold text-white">Legal</div>
              <ul className="space-y-2 text-slate-400">
                <li>
                  <Link href="/privacidade" className="hover:text-white transition">
                    Política de Privacidade
                  </Link>
                </li>
                <li>
                  <Link href="/termos" className="hover:text-white transition">
                    Termos de Uso
                  </Link>
                </li>
                <li>
                  <a href="#contato" className="hover:text-white transition">
                    Contato
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 border-t border-blue-200/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-slate-500">
            <p>
              &copy; {new Date().getFullYear()} Dashfy (usedashfy.com.br). Todos os direitos reservados.
            </p>
            <p>
              Plataforma independente — sem afiliação oficial com TikTok ou outras redes de anúncios.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
