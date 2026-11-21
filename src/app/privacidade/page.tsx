import type { Metadata } from "next";
import { PublicLegalShell } from "@/components/landing/PublicLegalShell";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description:
    "Política de Privacidade da Dashfy (usedashfy.com.br) sobre coleta, uso, proteção e direitos dos usuários conforme a LGPD.",
};

export default function PrivacidadePage() {
  return (
    <PublicLegalShell
      badge="Privacidade & LGPD"
      title="Política de Privacidade"
      updatedAt="21 de novembro de 2026"
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">
          1. Identificação do Controlador
        </h2>
        <p>
          Esta Política de Privacidade descreve como a plataforma{" "}
          <strong className="text-white">Dashfy</strong> (
          <a
            href="https://www.usedashfy.com.br"
            className="text-sky-300 hover:underline"
          >
            https://www.usedashfy.com.br
          </a>
          ), projeto SaaS independente desenvolvido e operado por{" "}
          <strong className="text-white">Tiago Mendonça</strong> no Brasil,
          coleta, armazena, utiliza e protege os dados dos seus usuários, em
          conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD — Lei
          nº 13.709/2018).
        </p>
        <p>
          Canal oficial para dúvidas ou solicitações de privacidade:{" "}
          <a
            href="mailto:contato@usedashfy.com.br"
            className="text-sky-300 hover:underline"
          >
            contato@usedashfy.com.br
          </a>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">
          2. Dados Coletados
        </h2>
        <p>Coletamos apenas os dados necessários para o funcionamento seguro da plataforma:</p>
        <ul className="list-disc pl-5 space-y-2 text-slate-300">
          <li>
            <strong className="text-white">Dados de cadastro e conta:</strong>{" "}
            nome de exibição, nome do workspace (opcional), endereço de e-mail e
            credenciais de autenticação gerenciadas com criptografia via Supabase
            Auth.
          </li>
          <li>
            <strong className="text-white">
              Dados financeiros e de marketing inseridos ou sincronizados pelo
              usuário:
            </strong>{" "}
            registros de vendas, recebimentos, saldos, taxas, despesas manuais,
            regras de monitoramento e métricas de campanhas (como investimento,
            impressões, cliques, conversões e receita atribuída) importadas via
            CSV ou integradas por webhooks/APIs autorizadas.
          </li>
          <li>
            <strong className="text-white">
              Dados de integrações futuras via OAuth (como TikTok Marketing API):
            </strong>{" "}
            caso a integração com o TikTok Ads seja autorizada e ativada no
            futuro, a Dashfy acessará apenas os dados estritamente autorizados
            pelo usuário no fluxo OAuth oficial (como leitura de campanhas,
            gastos publicitários e métricas de desempenho) para exibição no
            próprio dashboard da conta.
          </li>
          <li>
            <strong className="text-white">Dados técnicos de segurança:</strong>{" "}
            cookies de sessão HTTP-Only e controle temporário de taxa de
            requisições (rate limiting) para prevenir acessos abusivos.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">
          3. Finalidade do Tratamento
        </h2>
        <p>Os dados tratados pela Dashfy são utilizados exclusivamente para:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Autenticar usuários, confirmar e-mails e permitir recuperação de senha;</li>
          <li>Exibir dashboards financeiros e de marketing isolados por conta;</li>
          <li>Calcular indicadores operacionais como ROAS, ROI, margem e lucro líquido;</li>
          <li>Processar webhooks e consultas de API configuradas pelo próprio usuário;</li>
          <li>Manter a segurança, estabilidade e prevenção a abusos na aplicação.</li>
        </ul>
        <p>
          <strong className="text-white">
            A Dashfy não vende, aluga nem comercializa dados pessoais,
            financeiros ou de campanhas dos usuários a terceiros.
          </strong>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">
          4. Armazenamento, Isolamento e Segurança
        </h2>
        <p>
          Os dados são armazenados em banco de dados PostgreSQL gerenciado
          (Supabase) com políticas de <strong className="text-white">Row Level Security (RLS)</strong>{" "}
          e validação de autorização no servidor em todas as rotas de API,
          garantindo que cada usuário acesse exclusivamente seus próprios
          registros.
        </p>
        <p>
          Credenciais de APIs externas e tokens de webhook informados pelo
          usuário são mantidos exclusivamente no backend e nunca expostos no
          código do navegador. Logs de webhooks passam por sanitização para
          omitir dados pessoais sensíveis como documentos, telefones e chaves
          bancárias.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">
          5. Compartilhamento com Operadores de Infraestrutura
        </h2>
        <p>
          Para operar o serviço em nuvem, a Dashfy utiliza provedores técnicos
          de infraestrutura estritamente necessários à hospedagem e banco de
          dados (Vercel e Supabase), além das APIs externas que o próprio usuário
          escolher conectar à sua conta.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">
          6. Retenção, Revogação e Direitos do Titular (LGPD)
        </h2>
        <p>
          O titular dos dados pode, a qualquer momento, solicitar confirmação da
          existência de tratamento, acesso, correção de dados incompletos ou
          desatualizados, revogação de consentimento de integrações ou exclusão
          definitiva de sua conta e registros associados.
        </p>
        <p>
          Para exercer qualquer um desses direitos ou solicitar a exclusão
          completa dos seus dados, envie um e-mail para{" "}
          <a
            href="mailto:contato@usedashfy.com.br"
            className="text-sky-300 hover:underline"
          >
            contato@usedashfy.com.br
          </a>{" "}
          informando o e-mail cadastrado na plataforma.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">
          7. Atualizações desta Política
        </h2>
        <p>
          Esta Política de Privacidade pode ser atualizada periodicamente para
          refletir melhorias na plataforma ou novas integrações autorizadas. A
          data da última revisão estará sempre visível no topo desta página.
        </p>
      </section>
    </PublicLegalShell>
  );
}
