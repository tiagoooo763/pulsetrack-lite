"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileSpreadsheet,
  FileText,
  Globe,
  Layers,
  LayoutDashboard,
  Lock,
  Mail,
  Megaphone,
  Menu,
  Plug,
  Receipt,
  Scale,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  UserCheck,
  Wallet,
  X,
} from "lucide-react";
import { DashfyBrand } from "@/components/dashfy/DashfyBrand";

interface PublicLandingPageProps {
  isLoggedIn: boolean;
}

const NAV_LINKS = [
  { href: "#inicio", label: "Início" },
  { href: "#sobre", label: "Sobre" },
  { href: "#funcionalidades", label: "Funcionalidades" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#integracoes", label: "Integrações" },
  { href: "#responsavel", label: "Responsável" },
  { href: "#contato", label: "Contato" },
];

const FEATURES = [
  {
    icon: BarChart3,
    title: "Acompanhamento de Campanhas",
    status: "Disponível",
    description:
      "Consolide investimento em mídia, impressões, cliques, CPC, CPM, conversões e receita atribuída por campanha, conjunto e anúncio via importação CSV ou registro manual.",
  },
  {
    icon: TrendingUp,
    title: "ROAS, ROI e Margem Líquida",
    status: "Disponível",
    description:
      "Cálculo automático de retorno sobre investimento publicitário (ROAS), retorno total sobre custos (ROI) e margem de lucro real considerando taxas e despesas.",
  },
  {
    icon: Wallet,
    title: "Gestão Financeira Completa",
    status: "Disponível",
    description:
      "Controle faturamento bruto, faturamento líquido, recebimentos, saques, saldo disponível e histórico de vendas em um painel estruturado por período.",
  },
  {
    icon: Layers,
    title: "Dashboards Separados & Dash Geral",
    status: "Disponível",
    description:
      "Organize múltiplas operações independentes e renomeáveis sem misturar métricas, além de uma visão consolidada no Dash Geral.",
  },
  {
    icon: Receipt,
    title: "Taxas, Despesas e Regras",
    status: "Disponível",
    description:
      "Cadastre despesas operacionais e taxas fixas ou percentuais que impactam os resultados, além de regras configuráveis de alerta para ROAS, CPA, CPC e gastos.",
  },
  {
    icon: ShieldCheck,
    title: "Multi-Usuário com Isolamento",
    status: "Disponível",
    description:
      "Contas individuais com autenticação segura, confirmação de e-mail, recuperação de senha, credenciais armazenadas apenas no backend e isolamento de dados por usuário (RLS).",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Crie sua conta isolada",
    description:
      "Cadastre-se com e-mail e senha em poucos passos. Cada usuário recebe um workspace próprio, protegido por autenticação e políticas de acesso restrito.",
  },
  {
    step: "02",
    title: "Estruture suas operações",
    description:
      "Organize e renomeie seus dashboards separados (como operações de mídia paga e gateways de pagamento) para manter cada frente de negócio organizada.",
  },
  {
    step: "03",
    title: "Conecte fontes ou importe relatórios",
    description:
      "Configure integrações ativas via API e webhook no backend, importe arquivos CSV de campanhas e registre despesas ou taxas personalizadas.",
  },
  {
    step: "04",
    title: "Acompanhe ROAS, ROI e lucro real",
    description:
      "Filtre por período, campanha, conta de anúncio, fonte de tráfego ou produto para tomar decisões baseadas em margem líquida e desempenho real.",
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
    statusTone: "emerald" as const,
    description:
      "Integração operacional via API e webhooks autenticados para acompanhamento de vendas, recebimentos, saldo, taxas e histórico de transações.",
    detail: "Credenciais armazenadas exclusivamente no servidor, isoladas por conta.",
  },
  {
    icon: FileSpreadsheet,
    name: "Importação CSV de Campanhas",
    status: "Ativa",
    statusTone: "emerald" as const,
    description:
      "Importação direta de relatórios de campanhas, conjuntos e anúncios para análise de investimento, impressões, cliques, conversões, ROAS e lucro estimado.",
    detail: "Compatível com planilhas CSV em formato brasileiro (;) e internacional (,).",
  },
  {
    icon: Megaphone,
    name: "TikTok Ads (TikTok Marketing API)",
    status: "OAuth 2.0 (Somente Leitura)",
    statusTone: "emerald" as const,
    description:
      "Integração via OAuth oficial para conexão de Business Centers e contas de anúncios autorizadas, com consulta somente-leitura de gastos e relatórios de desempenho.",
    detail:
      "Não cria, edita nem exclui anúncios. Tokens armazenados criptografados no backend e isolados por conta.",
  },
  {
    icon: Activity,
    name: "Webhooks Personalizados & Receptor Nexus",
    status: "Compatível",
    statusTone: "blue" as const,
    description:
      "Receptor de webhooks autenticado por usuário para registrar notificações de vendas e eventos financeiros com auditoria e deduplicação automática.",
    detail: "URL dedicada por conta autenticada, sem compartilhamento de dados entre usuários.",
  },
];

export function PublicLandingPage({ isLoggedIn }: PublicLandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      gsap.from(".hero-reveal", {
        opacity: 0,
        y: 18,
        duration: 0.65,
        stagger: 0.08,
        ease: "power3.out",
        clearProps: "transform,opacity",
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  function handleCopyEmail() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText("contato@usedashfy.com.br");
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    }
  }

  return (
    <div
      ref={rootRef}
      className="min-h-screen bg-[#040914] text-slate-100 relative overflow-x-hidden"
    >
      {/* Fundo arquitetônico azul-marinho com brilho azul sutil */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden="true"
      >
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #93c5fd 1px, transparent 1px), linear-gradient(to bottom, #93c5fd 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[920px] h-[520px] rounded-full bg-[#1d74ff]/15 blur-[130px]" />
        <div className="absolute top-[42%] -right-40 w-[520px] h-[520px] rounded-full bg-[#0f4fd6]/10 blur-[140px]" />
      </div>

      {/* ==================== HEADER / NAVBAR ==================== */}
      <header className="sticky top-0 z-40 border-b border-blue-200/10 bg-[#040914]/85 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center focus:outline-none rounded-lg"
            aria-label="Dashfy — Página inicial"
          >
            <DashfyBrand size="md" />
          </Link>

          <nav
            aria-label="Navegação principal"
            className="hidden lg:flex items-center gap-6 text-xs font-medium text-slate-300"
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

          <div className="hidden sm:flex items-center gap-2.5">
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
            className="lg:hidden p-2 rounded-xl border border-blue-200/15 bg-white/[0.03] text-slate-200 hover:text-white"
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
          <div className="lg:hidden border-t border-blue-200/10 bg-[#071022] px-4 py-4 space-y-3">
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

            <div className="pt-3 border-t border-blue-200/10 flex flex-col gap-2">
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  className="btn-pressable w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1d74ff] text-white text-sm font-semibold py-2.5"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Acessar Painel</span>
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="btn-pressable w-full inline-flex items-center justify-center rounded-xl border border-blue-200/15 bg-white/[0.04] text-white text-sm font-semibold py-2.5"
                  >
                    Entrar
                  </Link>
                  <Link
                    href="/cadastro"
                    className="btn-pressable w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1d74ff] text-white text-sm font-semibold py-2.5"
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
          className="pt-16 pb-20 sm:pt-24 sm:pb-28 border-b border-blue-200/10"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-7 space-y-6">
                <div className="hero-reveal inline-flex items-center gap-2 rounded-full border border-[#1d74ff]/35 bg-[#1d74ff]/10 px-3.5 py-1.5 text-xs font-medium text-sky-300">
                  <span className="w-2 h-2 rounded-full bg-[#1d74ff]" />
                  <span>Plataforma SaaS de Marketing Digital &amp; Gestão Financeira</span>
                </div>

                <h1 className="hero-reveal text-3xl sm:text-5xl font-bold tracking-tight text-white leading-[1.12]">
                  Clareza financeira e análise de campanhas{" "}
                  <span className="text-[#3b8bff]">em um só painel.</span>
                </h1>

                <p className="hero-reveal text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
                  A <strong className="text-white font-semibold">Dashfy</strong>{" "}
                  centraliza o acompanhamento de campanhas de mídia paga, gastos
                  publicitários, taxas, despesas, ROAS, ROI e lucro líquido em
                  dashboards separados por operação — com isolamento de dados por
                  conta.
                </p>

                <div className="hero-reveal flex flex-wrap items-center gap-3 pt-1">
                  <Link
                    href={isLoggedIn ? "/dashboard" : "/cadastro"}
                    className="btn-pressable inline-flex items-center gap-2 rounded-xl bg-[#1d74ff] hover:bg-[#2a80ff] text-white text-sm font-semibold px-6 py-3.5 shadow-[0_12px_32px_-8px_rgba(29,116,255,0.65)]"
                  >
                    <span>{isLoggedIn ? "Ir para o meu painel" : "Criar conta"}</span>
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
                    href="#funcionalidades"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white px-3 py-2 transition-colors"
                  >
                    <span>Ver funcionalidades</span>
                  </a>
                </div>

                <div className="hero-reveal pt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#3b8bff]" />
                    Dashboards protegidos por autenticação
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#3b8bff]" />
                    Isolamento multi-usuário com RLS
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#3b8bff]" />
                    usedashfy.com.br
                  </span>
                </div>
              </div>

              {/* Prévia ilustrativa honesta da interface (dados demonstrativos) */}
              <div className="lg:col-span-5 hero-reveal">
                <div className="rounded-2xl border border-blue-300/15 bg-[#091224]/95 p-5 sm:p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)] space-y-5">
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-blue-200/10">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#1d74ff]" />
                      <span className="text-xs font-semibold text-white">
                        Dashfy — Visão da Operação
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium border border-blue-300/20 bg-blue-500/10 text-sky-300">
                      Prévia ilustrativa
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-blue-200/10 bg-[#050c1a] p-3.5">
                      <span className="text-[11px] text-slate-400 block">
                        Faturamento Bruto
                      </span>
                      <span className="text-base font-bold font-mono tabular-nums text-white mt-1 block">
                        R$ 42.850,00
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        Receita consolidada
                      </span>
                    </div>

                    <div className="rounded-xl border border-blue-200/10 bg-[#050c1a] p-3.5">
                      <span className="text-[11px] text-slate-400 block">
                        Gastos com Anúncios
                      </span>
                      <span className="text-base font-bold font-mono tabular-nums text-white mt-1 block">
                        R$ 14.200,00
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        Mídia paga atribuída
                      </span>
                    </div>

                    <div className="rounded-xl border border-blue-200/10 bg-[#050c1a] p-3.5">
                      <span className="text-[11px] text-slate-400 block">
                        ROAS / ROI
                      </span>
                      <span className="text-base font-bold font-mono tabular-nums text-emerald-400 mt-1 block">
                        3,02x &bull; 148%
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        Retorno operacional
                      </span>
                    </div>

                    <div className="rounded-xl border border-blue-200/10 bg-[#050c1a] p-3.5">
                      <span className="text-[11px] text-slate-400 block">
                        Lucro Líquido
                      </span>
                      <span className="text-base font-bold font-mono tabular-nums text-emerald-400 mt-1 block">
                        R$ 21.090,00
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        Após taxas e despesas
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-200/10 bg-[#050c1a] p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-slate-200">
                        Estrutura de Abas Separadas
                      </span>
                      <span className="text-sky-400 font-mono">Multi-operação</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div className="rounded-lg border border-[#1d74ff]/40 bg-[#1d74ff]/15 px-2.5 py-1.5 text-center font-medium text-white">
                        Dash Geral
                      </div>
                      <div className="rounded-lg border border-blue-200/10 bg-white/[0.03] px-2.5 py-1.5 text-center text-slate-300">
                        Campanhas
                      </div>
                      <div className="rounded-lg border border-blue-200/10 bg-white/[0.03] px-2.5 py-1.5 text-center text-slate-300">
                        Gateway
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    * Valores exibidos acima são meramente demonstrativos para
                    ilustrar a organização do painel. Os dados reais dos usuários
                    exigem autenticação individual.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== 2. SOBRE A DASHFY ==================== */}
        <section
          id="sobre"
          className="py-20 sm:py-24 border-b border-blue-200/10"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              <div className="lg:col-span-5 space-y-4">
                <span className="text-xs font-semibold uppercase tracking-widest text-[#3b8bff]">
                  Sobre a Dashfy
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
                  Gestão financeira e performance de mídia conectadas à realidade
                  da operação.
                </h2>
              </div>

              <div className="lg:col-span-7 space-y-4 text-sm sm:text-base text-slate-300 leading-relaxed">
                <p>
                  A <strong className="text-white">Dashfy</strong> é uma
                  plataforma SaaS desenvolvida para empreendedores digitais,
                  gestores de tráfego e equipes de marketing que precisam
                  acompanhar o desempenho real de suas campanhas junto aos custos
                  financeiros da operação.
                </p>
                <p>
                  Em vez de analisar apenas o faturamento bruto ou métricas
                  isoladas de anúncios, a Dashfy reúne em um ambiente organizado
                  o investimento em mídia, taxas de processamento, impostos,
                  despesas operacionais e vendas aprovadas — permitindo calcular
                  ROAS, ROI e margem líquida com precisão.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
                  {[
                    {
                      title: "Operações separadas",
                      desc: "Cada frente de negócio tem seu próprio painel, filtros e histórico.",
                    },
                    {
                      title: "Métricas transparentes",
                      desc: "Receita atribuída, taxas e lucro estimado exibidos sem mistura.",
                    },
                    {
                      title: "Acesso seguro",
                      desc: "Cada conta acessa exclusivamente seus próprios dados via autenticação.",
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-xl border border-blue-200/10 bg-[#0a1326]/80 p-4"
                    >
                      <h3 className="text-xs font-semibold text-white">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== 3. FUNCIONALIDADES ==================== */}
        <section
          id="funcionalidades"
          className="py-20 sm:py-24 border-b border-blue-200/10 bg-[#060d1c]/60"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="max-w-2xl space-y-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#3b8bff]">
                Funcionalidades
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Recursos reais para acompanhar marketing e resultado financeiro
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Cada módulo da Dashfy foi estruturado para oferecer visibilidade
                operacional clara, preservando a separação entre fontes de
                tráfego, gateways e custos.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((feat) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={feat.title}
                    className="rounded-2xl border border-blue-200/12 bg-[#0a1326] hover:border-[#1d74ff]/45 transition-all duration-200 p-6 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="w-10 h-10 rounded-xl bg-[#1d74ff]/15 border border-[#1d74ff]/30 flex items-center justify-center text-[#5ea1ff]">
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-400/25 bg-emerald-500/10 text-emerald-300">
                          {feat.status}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-semibold text-white">
                          {feat.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
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

        {/* ==================== 4. COMO FUNCIONA ==================== */}
        <section
          id="como-funciona"
          className="py-20 sm:py-24 border-b border-blue-200/10"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="max-w-2xl space-y-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#3b8bff]">
                Como funciona
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Fluxo direto do cadastro à análise financeira
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Comece com um workspace isolado e configure suas operações no seu
                ritmo.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {STEPS.map((item) => (
                <div
                  key={item.step}
                  className="rounded-2xl border border-blue-200/12 bg-[#0a1326]/90 p-6 space-y-3"
                >
                  <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-[#1d74ff]/15 border border-[#1d74ff]/30 text-xs font-mono font-bold text-[#5ea1ff]">
                    {item.step}
                  </span>
                  <h3 className="text-sm sm:text-base font-semibold text-white">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==================== 5. INTEGRAÇÕES ==================== */}
        <section
          id="integracoes"
          className="py-20 sm:py-24 border-b border-blue-200/10 bg-[#060d1c]/60"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="max-w-3xl space-y-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#3b8bff]">
                Integrações
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Status transparente das integrações da plataforma
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Informamos claramente quais integrações já estão operacionais e
                quais estão em fase de desenvolvimento ou aguardando autorização
                oficial dos respectivos provedores.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                    className="rounded-2xl border border-blue-200/12 bg-[#0a1326] p-6 space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-blue-200/15 flex items-center justify-center text-sky-300 shrink-0">
                          <Icon className="w-5 h-5" />
                        </div>
                        <h3 className="text-base font-semibold text-white">
                          {integ.name}
                        </h3>
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

                    <div className="pt-3 border-t border-blue-200/10 text-xs text-slate-400">
                      {integ.detail}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border border-blue-300/15 bg-[#091224] p-5 flex items-start gap-3 text-xs text-slate-300 leading-relaxed">
              <SlidersHorizontal className="w-4 h-4 text-[#3b8bff] shrink-0 mt-0.5" />
              <p>
                <strong className="text-white">Aviso de independência:</strong> A
                Dashfy é um software independente de análise de marketing e
                gestão financeira. Não possuímos afiliação, endosso ou parceria
                comercial oficial com o TikTok ou outras plataformas de anúncios.
                O acesso a APIs de terceiros, quando habilitado, ocorre
                exclusivamente mediante autorização OAuth expressa do próprio
                usuário.
              </p>
            </div>
          </div>
        </section>

        {/* ==================== 6. SOBRE O PROJETO E RESPONSÁVEL ==================== */}
        <section
          id="responsavel"
          className="py-20 sm:py-24 border-b border-blue-200/10"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl border border-blue-200/15 bg-[#0a1326] p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-5 space-y-3">
                <span className="text-xs font-semibold uppercase tracking-widest text-[#3b8bff]">
                  Sobre o projeto e responsável
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Transparência sobre quem desenvolve e opera a Dashfy
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  A Dashfy é um projeto SaaS independente idealizado, desenvolvido
                  e mantido no Brasil com foco em simplicidade operacional,
                  clareza de métricas e proteção de dados dos usuários.
                </p>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-blue-200/10 bg-[#050c1a] p-4 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <UserCheck className="w-4 h-4 text-[#3b8bff]" />
                    <span>Responsável pelo projeto</span>
                  </div>
                  <p className="text-sm font-semibold text-white">
                    Tiago Mendonça
                  </p>
                  <p className="text-xs text-slate-400">
                    Fundador e Desenvolvedor Independente
                  </p>
                </div>

                <div className="rounded-xl border border-blue-200/10 bg-[#050c1a] p-4 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Globe className="w-4 h-4 text-[#3b8bff]" />
                    <span>Site oficial &amp; País</span>
                  </div>
                  <p className="text-sm font-semibold text-white">
                    https://www.usedashfy.com.br
                  </p>
                  <p className="text-xs text-slate-400">Operação no Brasil</p>
                </div>

                <div className="rounded-xl border border-blue-200/10 bg-[#050c1a] p-4 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Mail className="w-4 h-4 text-[#3b8bff]" />
                    <span>E-mail profissional</span>
                  </div>
                  <a
                    href="mailto:contato@usedashfy.com.br"
                    className="text-sm font-semibold text-sky-300 hover:text-white transition-colors block break-all"
                  >
                    contato@usedashfy.com.br
                  </a>
                  <p className="text-xs text-slate-400">
                    Suporte, privacidade e revisões técnicas
                  </p>
                </div>

                <div className="rounded-xl border border-blue-200/10 bg-[#050c1a] p-4 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Shield className="w-4 h-4 text-[#3b8bff]" />
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

        {/* ==================== 7. CONTATO ==================== */}
        <section
          id="contato"
          className="py-20 sm:py-24 border-b border-blue-200/10 bg-[#060d1c]/60"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl border border-[#1d74ff]/30 bg-gradient-to-br from-[#0b1833] via-[#091326] to-[#060c1a] p-6 sm:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="space-y-3 max-w-2xl">
                <span className="text-xs font-semibold uppercase tracking-widest text-[#5ea1ff]">
                  Contato
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Fale com a equipe da Dashfy
                </h2>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  Para suporte técnico, dúvidas comerciais, solicitações de
                  revisão de integrações (como TikTok for Business Developers) ou
                  pedidos relacionados à privacidade e exclusão de dados, utilize
                  nosso canal oficial por e-mail.
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

        {/* ==================== 8 & 9. PRIVACIDADE E TERMOS ==================== */}
        <section className="py-20 sm:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="max-w-2xl space-y-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#3b8bff]">
                Documentação Legal &amp; Conformidade
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Política de Privacidade e Termos de Uso
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 8. Política de Privacidade */}
              <article
                id="privacidade"
                className="rounded-2xl border border-blue-200/12 bg-[#0a1326] p-6 sm:p-7 flex flex-col justify-between space-y-5"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#1d74ff]/15 border border-[#1d74ff]/30 flex items-center justify-center text-[#5ea1ff]">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">
                      Política de Privacidade
                    </h3>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    A Dashfy trata os dados pessoais e operacionais estritamente
                    para fornecer as funcionalidades de autenticação, análise de
                    campanhas e gestão financeira ao próprio usuário titular da
                    conta, em conformidade com a Lei Geral de Proteção de Dados
                    (LGPD — Lei nº 13.709/2018).
                  </p>

                  <ul className="space-y-2 text-xs text-slate-400">
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#3b8bff] shrink-0 mt-0.5" />
                      <span>
                        Não vendemos nem compartilhamos dados financeiros ou de
                        campanhas dos usuários com terceiros.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#3b8bff] shrink-0 mt-0.5" />
                      <span>
                        Credenciais de integração e tokens ficam restritos ao
                        backend e protegidos por isolamento por usuário (RLS).
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#3b8bff] shrink-0 mt-0.5" />
                      <span>
                        Solicitações de acesso, correção ou exclusão de dados
                        podem ser enviadas para{" "}
                        <span className="text-slate-200">
                          contato@usedashfy.com.br
                        </span>
                        .
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

              {/* 9. Termos de Uso */}
              <article
                id="termos"
                className="rounded-2xl border border-blue-200/12 bg-[#0a1326] p-6 sm:p-7 flex flex-col justify-between space-y-5"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#1d74ff]/15 border border-[#1d74ff]/30 flex items-center justify-center text-[#5ea1ff]">
                      <Scale className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">
                      Termos de Uso
                    </h3>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    O acesso aos painéis e ferramentas da Dashfy requer cadastro
                    individual e concordância com as regras de uso responsável da
                    plataforma, veracidade das informações fornecidas e proteção
                    das credenciais de login.
                  </p>

                  <ul className="space-y-2 text-xs text-slate-400">
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#3b8bff] shrink-0 mt-0.5" />
                      <span>
                        O usuário é o único titular dos dados financeiros e de
                        campanhas que importa ou conecta à sua conta.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#3b8bff] shrink-0 mt-0.5" />
                      <span>
                        Integrações externas dependem da autorização do usuário e
                        da disponibilidade das respectivas APIs de terceiros.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#3b8bff] shrink-0 mt-0.5" />
                      <span>
                        A Dashfy atua como ferramenta de apoio analítico e não
                        substitui assessoria contábil, fiscal ou jurídica.
                      </span>
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
      <footer className="relative z-10 border-t border-blue-200/10 bg-[#030710]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-5 space-y-3">
              <DashfyBrand size="md" />
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                Plataforma SaaS de análise de marketing digital e gestão
                financeira para acompanhamento de campanhas, gastos, ROAS, ROI e
                lucro líquido.
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
                  <a href="#sobre" className="hover:text-white transition">
                    Sobre a Dashfy
                  </a>
                </li>
                <li>
                  <a
                    href="#funcionalidades"
                    className="hover:text-white transition"
                  >
                    Funcionalidades
                  </a>
                </li>
                <li>
                  <a
                    href="#como-funciona"
                    className="hover:text-white transition"
                  >
                    Como funciona
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
                  <Link
                    href="/recuperar-senha"
                    className="hover:text-white transition"
                  >
                    Recuperar senha
                  </Link>
                </li>
              </ul>
            </div>

            <div className="md:col-span-2 space-y-2.5 text-xs">
              <div className="font-semibold text-white">Legal</div>
              <ul className="space-y-2 text-slate-400">
                <li>
                  <Link
                    href="/privacidade"
                    className="hover:text-white transition"
                  >
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
              &copy; {new Date().getFullYear()} Dashfy (usedashfy.com.br). Todos
              os direitos reservados.
            </p>
            <p>
              Plataforma independente — sem afiliação oficial com TikTok ou
              outras redes de anúncios.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
