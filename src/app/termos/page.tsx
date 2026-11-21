import type { Metadata } from "next";
import { PublicLegalShell } from "@/components/landing/PublicLegalShell";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description:
    "Termos de Uso da plataforma SaaS Dashfy (usedashfy.com.br) para análise de marketing digital e gestão financeira.",
};

export default function TermosPage() {
  return (
    <PublicLegalShell
      badge="Termos & Condições"
      title="Termos de Uso"
      updatedAt="21 de novembro de 2026"
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">
          1. Aceitação e Objeto
        </h2>
        <p>
          Estes Termos de Uso regulam o acesso e a utilização da plataforma{" "}
          <strong className="text-white">Dashfy</strong> (
          <a
            href="https://www.usedashfy.com.br"
            className="text-sky-300 hover:underline"
          >
            https://www.usedashfy.com.br
          </a>
          ), software como serviço (SaaS) voltado à análise de campanhas de
          marketing digital e gestão financeira operacional, mantido por{" "}
          <strong className="text-white">Tiago Mendonça</strong>.
        </p>
        <p>
          Ao criar uma conta ou utilizar os dashboards da Dashfy, você declara
          ter lido, compreendido e concordado com estes Termos e com a nossa{" "}
          <a href="/privacidade" className="text-sky-300 hover:underline">
            Política de Privacidade
          </a>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">
          2. Cadastro, Conta e Segurança
        </h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            O acesso aos dashboards financeiros e operacionais é restrito a
            usuários autenticados com conta individual.
          </li>
          <li>
            O usuário é responsável pela veracidade das informações fornecidas
            no cadastro e pela guarda segura de sua senha de acesso.
          </li>
          <li>
            Cada conta possui ambiente isolado; tentativas de acesso não
            autorizado a dados de terceiros, exploração de vulnerabilidades ou
            uso abusivo das rotas da aplicação são estritamente proibidas e podem
            resultar na suspensão da conta.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">
          3. Funcionalidades e Integrações de Terceiros
        </h2>
        <p>
          A Dashfy permite organizar operações separadas, importar relatórios
          CSV de campanhas, cadastrar despesas e taxas, configurar regras de
          monitoramento e conectar integrações suportadas via API ou webhooks.
        </p>
        <p>
          Integrações sinalizadas como{" "}
          <strong className="text-white">
            &ldquo;Em desenvolvimento&rdquo; ou &ldquo;Aguardando autorização&rdquo;
          </strong>{" "}
          (como a integração automática via OAuth com o TikTok Ads) não estão
          ativas até sua liberação oficial pelos respectivos provedores. A
          Dashfy é um software independente e não possui afiliação, parceria ou
          endosso oficial com o TikTok ou outras plataformas de anúncios.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">
          4. Titularidade dos Dados e Uso Analítico
        </h2>
        <p>
          Todos os dados financeiros, transações, despesas e relatórios de
          campanhas inseridos ou sincronizados pelo usuário permanecem de
          titularidade exclusiva do próprio usuário.
        </p>
        <p>
          Os indicadores exibidos pela plataforma (como ROAS, ROI, margem e
          lucro estimado) baseiam-se nos dados fornecidos ou integrados pelo
          usuário e têm caráter de apoio à gestão, não substituindo consultoria
          contábil, fiscal ou jurídica.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">
          5. Disponibilidade e Encerramento
        </h2>
        <p>
          Buscamos manter a plataforma disponível e atualizada de forma contínua,
          podendo realizar manutenções técnicas ou evoluções de recursos. O
          usuário pode deixar de utilizar a plataforma ou solicitar o
          encerramento da sua conta e exclusão dos dados a qualquer momento pelo
          e-mail{" "}
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
          6. Contato e Legislação Aplicável
        </h2>
        <p>
          Estes Termos são regidos pelas leis da República Federativa do Brasil.
          Para dúvidas, suporte ou solicitações formais, entre em contato pelo
          e-mail{" "}
          <a
            href="mailto:contato@usedashfy.com.br"
            className="text-sky-300 hover:underline"
          >
            contato@usedashfy.com.br
          </a>
          .
        </p>
      </section>
    </PublicLegalShell>
  );
}
