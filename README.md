# PulseTrack Lite — Dashboard Financeiro & Integração Oficial OmegaPay (v1)

Dashboard financeiro minimalista em **Next.js 14 (App Router)**, **TypeScript** e **Tailwind CSS**, integrado à documentação oficial da **OmegaPay** (`https://app.omegapayments.com.br/docs/v1/webhooks`) com suporte a banco de dados persistente gratuito (**SQLite/LibSQL local**, **Turso Cloud** ou **PostgreSQL no Neon/Supabase**).

---

## Arquitetura e Conformidade com a Documentação Oficial OmegaPay

### 1. Eventos Oficiais de Webhook (`POST /api/webhooks/omegapay`)

Todos os identificadores de eventos seguem estritamente a documentação oficial da OmegaPay:

- **Webhooks de Pagamento (`/docs/v1/webhooks/payment`)**:
  - `TRANSACTION_CREATED` — Transação criada (`PENDING`)
  - `TRANSACTION_PAID` — Pagamento concluído (`COMPLETED`)
  - `TRANSACTION_CANCELED` — Transação cancelada ou expirada (`CANCELED`)
  - `TRANSACTION_REFUNDED` — Transação reembolsada/estornada (`REFUNDED`)
  - `TRANSACTION_CHARGED_BACK` — Transação contestada/chargeback (`CHARGED_BACK`)
- **Webhooks de Transferência (`/docs/v1/webhooks/transfer`)**:
  - `TRANSFER_CREATED` — Transferência solicitada (`PENDING`)
  - `TRANSFER_COMPLETED` — Transferência concluída (`COMPLETED`)
  - `TRANSFER_FAILED` — Transferência falhou ou foi cancelada (`FAILED` / `CANCELED`)
- **Webhooks Complementares Suportados**:
  - Contestação (`/docs/v1/webhooks/chargebacks`): `CHARGEBACK_CREATED`, `MED_CREATED`, `CHARGEBACK_UPDATED`, `MED_UPDATED`
  - Assinaturas (`/docs/v1/webhooks/subscription`): `SUBSCRIPTION_TRIAL_STARTED`, `SUBSCRIPTION_STARTED`, `SUBSCRIPTION_RENEWAL_PENDING`, `SUBSCRIPTION_RENEWED`, `SUBSCRIPTION_EXPIRED`, `SUBSCRIPTION_CANCELED`
  - Sessões de Checkout (`/docs/v1/webhooks/session`): `SESSION_CREATED`, `SESSION_UPDATED`, `SESSION_CLIENT_UPDATED`, `SESSION_ABANDONED`

### 2. Endpoints Oficiais de Leitura (`GET`)

Base URL oficial: `https://app.omegapayments.com.br/api/v1`  
Headers de autenticação: `x-public-key` e `x-secret-key` (mantidos exclusivamente no servidor).

| Recurso na Documentação | Método e Rota Oficial | Retorno Oficial |
| :--- | :--- | :--- |
| **Meu saldo** | `GET /gateway/producer/balance` | `{ available: number, pending: number, fundLock: number }` |
| **Testar credenciais** | `GET /gateway/producer/credentials` | `{ name: string, permissions: string[], grantAllPermissions: boolean, expiresAt: string \| null }` |
| **Buscar transação** | `GET /gateway/transactions?id=...&clientIdentifier=...` | Objeto da transação (`id`, `status`, `paymentMethod`, `amount`, `originalAmount`, `payedAmount`, `orderItems`, etc.) |
| **Buscar transferência** | `GET /gateway/transfers?id=...&clientIdentifier=...` | Objeto da transferência (`id`, `amount`, `fee`, `netAmount`, `status`, `createdAt`, `completedAt`) |

> **Nota sobre Saldo e Valores Transferidos:** O endpoint `GET /gateway/producer/balance` retorna separadamente o saldo **disponível** (`available`), **pendente** (`pending`) e **retido em garantia/bloqueio cautelar** (`fundLock`). O **Valor Recebido (Transferido)** é consolidado a partir das transferências com status `COMPLETED` recebidas via webhook (`TRANSFER_COMPLETED`) ou consultadas pontualmente em `GET /gateway/transfers`.

### 3. Segurança e Privacidade

- **Validação de Token (`payload.token`)**: Comparação em tempo constante (`crypto.timingSafeEqual` sobre hash SHA-256) antes de qualquer processamento.
- **Idempotência e Não Duplicação**: Cada evento possui chave única (`dedupe_key`) na tabela `webhook_events`, e a tabela `transactions` faz *upsert* pelo `id` da transação com máquina de estados que impede regressão de status fora de ordem.
- **Proteção de Dados Sensíveis (LGPD)**: O sanitizador (`src/lib/sanitize.ts`) remove recursivamente CPF, CNPJ, telefone, dados bancários (`bankAccount`, `pixKey`), tokens e chaves secretas antes de qualquer log ou gravação.
- **Somente Leitura Financeira**: Nenhuma rota de saque, transferência ou criação de cobrança foi implementada.

---

## Guia Passo a Passo

### Passo 1: Publicar a Aplicação (HTTPS Gratuito)

1. Suba este projeto em um repositório privado no **GitHub**.
2. Crie um banco de dados gratuito em um dos serviços abaixo:
   - **Opção A — Turso (SQLite/LibSQL Serverless Gratuito)**: crie um banco em [turso.tech](https://turso.tech) e copie a `DATABASE_URL` (`libsql://...`) e `DATABASE_AUTH_TOKEN`.
   - **Opção B — Neon ou Supabase (PostgreSQL Gratuito)**: crie um projeto gratuito e copie a string `DATABASE_URL` (`postgresql://...`).
   - *(Em ambiente local ou VPS com disco persistente, o sistema utiliza automaticamente `file:./data/pulsetrack.db` sem configuração extra).*
3. Importe o repositório na **Vercel** (plano Hobby gratuito, que fornece HTTPS automático).

### Passo 2: Configurar as Credenciais

Configure as seguintes variáveis de ambiente no painel da Vercel (`Settings > Environment Variables`) ou no arquivo `.env` local (veja `.env.example`):

```env
DATABASE_URL="file:./data/pulsetrack.db"
DASHBOARD_USER="admin"
DASHBOARD_PASSWORD="sua-senha-forte-aqui"
SESSION_SECRET=" gere-uma-string-aleatoria-com-32-caracteres-ou-mais "

OMEGAPAY_API_BASE_URL="https://app.omegapayments.com.br/api/v1"
OMEGAPAY_PUBLIC_KEY="sua_x_public_key"
OMEGAPAY_SECRET_KEY="sua_x_secret_key"
OMEGAPAY_WEBHOOK_TOKEN="seu_token_de_webhook_omegapay"
```

> Você também pode cadastrar ou atualizar `x-public-key`, `x-secret-key` e `payload.token` diretamente pela interface do painel na aba **"Integração & Guia OmegaPay"**, que salva as chaves de forma segura no banco do servidor.

### Passo 3: Criar um Novo Webhook no Painel da OmegaPay

1. Acesse sua conta em `https://app.omegapayments.com.br`.
2. No menu lateral, navegue até **Configurações > Webhooks** e clique em **Criar Webhook** (não altere nem remova seus webhooks já existentes).
3. No campo **URL de Destino (Endpoint HTTPS)**, informe:
   ```text
   https://SEU-DOMINIO.vercel.app/api/webhooks/omegapay
   ```
4. Selecione os produtos que deseja monitorar (ou todos os produtos).

### Passo 4: Selecionar os Eventos

Marque os eventos oficiais abaixo no painel da OmegaPay:
- **Pagamentos**:
  - `TRANSACTION_CREATED`
  - `TRANSACTION_PAID`
  - `TRANSACTION_CANCELED`
  - `TRANSACTION_REFUNDED`
  - `TRANSACTION_CHARGED_BACK`
- **Transferências** *(caso utilize um webhook unificado ou crie um segundo webhook para transferências)*:
  - `TRANSFER_CREATED`
  - `TRANSFER_COMPLETED`
  - `TRANSFER_FAILED`

5. Salve o webhook, copie o **Token de Validação** gerado pela OmegaPay e salve-o em `OMEGAPAY_WEBHOOK_TOKEN` (ou pelo formulário da aba **Integração & Guia OmegaPay**). Se você criar mais de um webhook no painel da OmegaPay, separe os tokens por vírgula.

### Passo 5: Testar Notificações

1. Faça login no **PulseTrack Lite** e abra a aba **Integração & Guia OmegaPay**.
2. No bloco **Testador Local de Notificações Webhook**, escolha:
   - `TRANSACTION_CREATED` e clique em **Disparar**: a venda aparecerá no Histórico como **Pendente** (sem somar na Receita Confirmada).
   - `TRANSACTION_PAID` com o mesmo ID e clique em **Disparar**: a mesma transação será atualizada para **Aprovada (`COMPLETED`)** sem duplicar e passará a compor o Faturamento Bruto, Taxas, Receita Líquida, Lucro Estimado e ROAS.
   - Dispare novamente o mesmo evento para confirmar a proteção contra duplicidade (Idempotência).

### Passo 6: Conferir Saldo e Vendas

1. Na aba **Integração & Guia OmegaPay**, clique em **Testar Credenciais (GET)** para validar sua chave via `GET /gateway/producer/credentials`.
2. No topo do dashboard, clique em **Atualizar Saldo OmegaPay** para consultar pontualmente `GET /gateway/producer/balance` e visualizar os valores **Disponível**, **Pendente** e **Retido (`fundLock`)**.
3. Para consultar uma transação ou transferência específica diretamente na API da OmegaPay sem fazer polling, utilize o cartão **Consulta Pontual de Transação ou Transferência (GET)** informando o `id` ou `clientIdentifier`.
