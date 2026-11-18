import { maskCpf, onlyDigits } from '../../../shared/format';

export const THREE_B = {
  name: '3B Indenizações',
  whatsapp: '5562991797653',
  phone: '62991797653',
  site: 'https://www.3bindenizacoes.com.br',
  instagram: 'https://www.instagram.com/3BIndenizacoes',
  youtube: 'https://www.youtube.com/@3bindenizacoesGO',
  tiktok: 'https://www.tiktok.com/@3bindenizacoes',
  address: 'Av. Primeira Radial, 950, Setor Pedro Ludovico, Goiânia/GO',
  hours: 'Segunda a sexta, das 8h às 18h, exceto feriados.',
  description:
    'A 3B Indenizações é a maior empresa especializada em ajudar trabalhadores de app ' +
    'que sofrem acidentes a receberem seus benefícios e indenizações de seguros e INSS. ' +
    'Atendimento presencial e online em todo o Brasil, com consulta gratuita e sem custos iniciais.',
  testimonials: [
    {
      author: 'Patrícia Natielly',
      text:
        'Quando precisei, eles correram atrás dos meus direitos e me ajudaram a receber o ' +
        'seguro do iFood e da 99 após o meu acidente. Atendimento sério, transparente e que ' +
        'realmente faz a diferença. Recomendo de coração!',
    },
    {
      author: 'Willian Dhieines',
      text:
        'Fui cliente da 3B Indenizações em 2020 e 2025. Muita gente tem dúvida se dá certo, ' +
        'eu afirmo: dá certo! Com a excelência da 3B, minhas indenizações foram bem maiores ' +
        'do que eu pensava.',
    },
  ],
} as const;

export const ACCIDENT_APPS = ['Uber', '99', 'iFood', 'Outro'] as const;

export type YesNo = 'yes' | 'no';
export type YesNoUnknown = YesNo | 'unknown';
export type ConsentStatus = 'accepted' | 'revoked' | null;

export type ConsentText = { version: string; text: string };

export type AccidentReport = {
  date: string | null;
  working: YesNo | null;
  fracture: YesNoUnknown | null;
  apps: string[];
  includeCpf: boolean;
};

export type Sender = {
  name: string;
  cpf: string | null;
  phone: string | null;
  email: string | null;
};

const ANSWER: Record<YesNoUnknown, string> = {
  yes: 'Sim',
  no: 'Não',
  unknown: 'Não sei',
};

const NOT_INFORMED = 'não informado';

export function maskDate(text: string): string {
  const d = onlyDigits(text).slice(0, 8);
  if (d.length <= 2) {
    return d;
  }
  if (d.length <= 4) {
    return `${d.slice(0, 2)}/${d.slice(2)}`;
  }
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export function validateAccidentDate(text: string, now: Date): string | null {
  if (!text.trim()) {
    return null;
  }
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!match) {
    return 'Data incompleta. Use dia/mês/ano, ou deixe em branco.';
  }
  const [, dd, mm, yyyy] = match.map(Number);
  const date = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (
    date.getUTCFullYear() !== yyyy ||
    date.getUTCMonth() !== mm - 1 ||
    date.getUTCDate() !== dd
  ) {
    return 'Essa data não existe. Confere o dia e o mês.';
  }
  if (date.getTime() > now.getTime()) {
    return 'A data do acidente não pode ser no futuro.';
  }
  return null;
}

export function threeBMessage(report: AccidentReport, sender: Sender): string {
  const lines = [
    'Olá, vim do app Corre! Sofri um acidente e quero fazer minha análise gratuita sobre os benefícios e indenizações que posso receber.',
    '',
    `Nome completo: ${sender.name.trim() || NOT_INFORMED}`,
  ];
  if (report.includeCpf && sender.cpf) {
    lines.push(`CPF: ${maskCpf(sender.cpf)}`);
  }
  lines.push(
    `Telefone: ${sender.phone ? onlyDigits(sender.phone) : NOT_INFORMED}`,
    `Email: ${sender.email || NOT_INFORMED}`,
    `Data do acidente: ${report.date || NOT_INFORMED}`,
    `Estava em corrida? ${
      report.working ? ANSWER[report.working] : NOT_INFORMED
    }`,
    `Lesões: ${report.fracture ? ANSWER[report.fracture] : NOT_INFORMED}`,
    `Aplicativo: ${report.apps.length ? report.apps.join(', ') : NOT_INFORMED}`,
  );
  return lines.join('\n');
}

export function threeBWhatsappUrl(text: string): string {
  return `https://wa.me/${THREE_B.whatsapp}?text=${encodeURIComponent(text)}`;
}
