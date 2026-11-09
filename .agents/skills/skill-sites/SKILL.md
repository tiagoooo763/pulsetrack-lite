---
name: skill-sites
description: Use esta skill OBRIGATORIAMENTE todas as vezes que o usuário precisar criar, estruturar, estilizar, refatorar ou desenvolver um site, landing page, web app, dashboard ou qualquer interface web do zero ou para melhoria. Orquestra direção de arte premium, sistema de design, tipografia, paletas de cores, microinterações, animações e checklist rigoroso de polimento visual.
---

# Skill Sites - Criação de Sites e Interfaces Web Profissionais

Esta skill centraliza e orquestra o fluxo de criação de sites modernos, elegantes e de alto padrão (evitando templates genéricos de IA), integrando os módulos de direção visual, tipografia, design system, animações e auditoria visual.

---

## 🎯 Quando Usar
Ative esta skill automaticamente sempre que o usuário:
- Solicitar a criação de um novo site, landing page, blog, e-commerce, portfólio ou dashboard.
- Pedir para desenhar, prototipar, codificar ou melhorar o visual/UI de páginas web.
- Quiser transformar uma ideia ou mockup em uma aplicação web com visual profissional e responsivo.

---

## 🧭 Fluxo de Desenvolvimento em 5 Etapas

### 1. Direção Visual & Conceito (Módulo: `premium-ui-direction`)
- **Identificar o arquétipo visual** do projeto de acordo com o nicho:
  - *SaaS / Produto Tech:* Linhas limpas, contrastes bem definidos, tipografia precisa, dark mode ou light refinado.
  - *Luxury / Editorial:* Serifas elegantes, espaçamento generoso (whitespace), paletas sóbrias.
  - *Criativo / Portfólio:* Tipografia display ousada, microinterações com personalidade, grids assimétricos.
- **Hierarquia de conteúdo essencial**:
  - `Hero Section`: Headline clara, proposta de valor, CTA primário de alto contraste e prova social visual.
  - `Corpo`: Seção de benefícios, demonstração interativa/visual do produto, depoimentos reais e FAQ.
  - `Footer`: Navegação clara, links secundários, copyright e branding.
- **Anti-padrões a evitar**: Não crie páginas genéricas cheias de degradês roxos saturados, cards de vidro idênticos, nem use emojis no lugar de ícones SVG semânticos.

---

### 2. Tipografia & Paleta de Cores (Módulos: `typography-system` & `ui-ux-pro-max`)
- **Pairing Tipográfico**:
  - Escolha **1 fonte Display com personalidade** para títulos (`h1`, `h2`) e **1 fonte neutra e altamente legível** para corpo de texto (`body`).
  - Defina uma escala tipográfica modular consistente (ex.: 12px, 14px, 16px base, 20px, 24px, 32px, 48px, 64px).
  - Altura de linha (`line-height`): ~1.1 a 1.2 para títulos grandes; 1.5 a 1.6 para textos corridos.
- **Tokens de Cores Semânticos**:
  - `Background` & `Surface`: Camadas de profundidade sutis.
  - `Foreground` & `Muted`: Texto principal e texto de apoio com contraste testado (mínimo 4.5:1 para WCAG AA).
  - `Accent / Brand`: Cor de destaque reservada para ações principais (CTAs e links ativos).
  - `Border`: Bordas sutis (ex.: `rgba(255,255,255,0.08)` em dark mode ou `rgba(0,0,0,0.06)` em light mode).

---

### 3. Componentes & Design System (Módulos: `design-system` & `ui-styling`)
- **Botões & Ações**:
  - Botão Primário: preenchimento sólido, contraste máximo, feedback tátil (`:active:scale-95`).
  - Botão Secundário: borda com fundo transparente ou superfície neutra.
  - Tamanho de toque mínimo para mobile: `44x44px`.
- **Cards & Containers**:
  - Bordas arredondadas harmônicas (ex.: `rounded-xl` ou `rounded-2xl`).
  - Sombras suaves em múltiplas camadas em vez de sombras duras e escuras.
- **Ícones**:
  - Use sempre bibliotecas de ícones SVG semânticos (ex.: `lucide-react`, `phosphor-icons`).
  - Mantenha espessura de traço (`stroke-width`) e tamanho proporcionais ao texto ao redor.

---

### 4. Microinterações & Movimento (Módulos: `ui-microinteractions` & `scroll-motion-gsap`)
- **Feedback Interativo**:
  - Todo elemento clicável deve reagir a `:hover`, `:focus-visible` e `:active`.
  - Transições curtas e intencionais (`150ms` a `250ms`, `cubic-bezier(0.16, 1, 0.3, 1)`).
- **Entrada & Revelação de Conteúdo**:
  - Animações sutis de entrada (fade-in com leve deslocamento para cima) nos elementos do Hero e cards à medida que surgem na tela.
  - **Acessibilidade**: Sempre respeitar `prefers-reduced-motion` para usuários com sensibilidade a movimentos.

---

### 5. Auditoria & Polimento Visual (Módulo: `visual-polish-audit`)
Antes de finalizar qualquer entrega de página, valide os seguintes itens:
- [ ] **Sem Scroll Horizontal**: Nenhum elemento pode estourar a largura da tela em mobile (`overflow-x: hidden`).
- [ ] **Contraste de Cores**: Todo texto possui legibilidade clara contra o plano de fundo.
- [ ] **Mobile First**: O layout se reorganiza fluidamente em telas pequenas (grids de 1 coluna, menus colapsáveis).
- [ ] **Hierarquia Visual**: O olhar do usuário é guiado naturalmente do título para a ação principal.
- [ ] **Responsividade de Imagens & Mídias**: Imagens com `object-cover` e dimensões protegidas para evitar Layout Shifts (CLS).
- [ ] **Interatividade Real**: Formulários e botões possuem estados visuais de foco, carregamento e erro claros.

---

## 🛠️ Recursos e Módulos Integrados Disponíveis
Esta skill trabalha em conjunto com os módulos detalhados presentes no diretório:
1. `premium-ui-direction`: Direção de arte e conceitos visuais avançados.
2. `ui-ux-pro-max`: Base de dados de 80 estilos, 192 paletas de cores e 120 diretrizes UX.
3. `typography-system`: Especificações e tokens de tipografia.
4. `design-system`: Criação e padronização de bibliotecas de componentes.
5. `ui-microinteractions`: Estilos e efeitos de microinteração CSS/JS.
6. `scroll-motion-gsap`: Presets e componentes de animação de scroll.
7. `visual-polish-audit`: Lista de verificação e checklist de qualidade final.
