import type {
  Category,
  Offer,
  OfferKind,
  Partner,
  PartnerSummary,
  Redemption,
  RedemptionStatus,
  RedemptionSummary,
  ValidatedRedemption,
} from '../domain';

type Numeric = number | string | null;

export type CategoryRow = { id: string; nome: string; icone: string };

export type PartnerSummaryRow = {
  id: string;
  nome_fantasia: string;
  bairro: string | null;
  cidade: string | null;
  logo_url: string | null;
  nota_media: Numeric;
  categoria: CategoryRow | null;
};

export type PartnerRow = PartnerSummaryRow & {
  descricao: string | null;
  endereco: string | null;
  uf: string | null;
  telefone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  horario_funcionamento: string | null;
};

export type OfferRow = {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  valor_desconto: Numeric;
  preco_de: Numeric;
  preco_por: Numeric;
  regras?: string | null;
  exclusivo_associados: boolean;
  exclusivo_premium: boolean;
  destaque?: boolean;
  validade_inicio?: string | null;
  validade_fim: string | null;
  parceiro_id: string;
  parceiro?: {
    id: string;
    nome_fantasia: string;
    cidade: string | null;
  } | null;
};

export type RedemptionStatusRow =
  | 'gerado'
  | 'validado'
  | 'expirado'
  | 'cancelado';

export type RedemptionRow = {
  id: string;
  codigo: string;
  qr_token: string;
  gerado_em: string;
  validado_em: string | null;
  status: RedemptionStatusRow;
  valor_economizado: Numeric;
  oferta: { id: string; titulo: string; regras: string | null } | null;
  parceiro: { id: string; nome_fantasia: string } | null;
};

export type RedemptionSummaryRow = Pick<
  RedemptionRow,
  'id' | 'codigo' | 'status' | 'gerado_em' | 'validado_em' | 'valor_economizado'
> & {
  oferta: { titulo: string } | null;
  parceiro: { nome_fantasia: string } | null;
};

export type ValidatedRedemptionRow = Pick<
  RedemptionRow,
  'valor_economizado' | 'validado_em'
>;

const REDEMPTION_STATUS: Record<RedemptionStatusRow, RedemptionStatus> = {
  gerado: 'generated',
  validado: 'validated',
  expirado: 'expired',
  cancelado: 'cancelled',
};

function toNumber(value: Numeric | undefined): number | null {
  return value == null ? null : Number(value);
}

export function toOfferKind(tipo: string): OfferKind {
  switch (tipo) {
    case 'desconto_percentual':
      return 'percentDiscount';
    case 'cashback':
      return 'cashback';
    case 'brinde':
      return 'gift';
    default:
      return 'fixedDiscount';
  }
}

export function toRedemptionStatus(status: RedemptionStatusRow) {
  return REDEMPTION_STATUS[status];
}

export function toCategory(row: CategoryRow): Category {
  return { id: row.id, name: row.nome, icon: row.icone };
}

export function toPartnerSummary(row: PartnerSummaryRow): PartnerSummary {
  return {
    id: row.id,
    name: row.nome_fantasia,
    neighborhood: row.bairro,
    city: row.cidade,
    logoUrl: row.logo_url,
    rating: toNumber(row.nota_media),
    category: row.categoria ? toCategory(row.categoria) : null,
  };
}

export function toPartner(row: PartnerRow): Partner {
  return {
    ...toPartnerSummary(row),
    description: row.descricao,
    address: row.endereco,
    state: row.uf,
    phone: row.telefone,
    whatsapp: row.whatsapp,
    instagram: row.instagram,
    openingHours: row.horario_funcionamento,
  };
}

export function toOffer(row: OfferRow): Offer {
  return {
    id: row.id,
    title: row.titulo,
    description: row.descricao,
    kind: toOfferKind(row.tipo),
    discountValue: toNumber(row.valor_desconto),
    priceFrom: toNumber(row.preco_de),
    priceTo: toNumber(row.preco_por),
    rules: row.regras ?? null,
    membersOnly: row.exclusivo_associados,
    premiumOnly: row.exclusivo_premium,
    featured: row.destaque ?? false,
    validFrom: row.validade_inicio ?? null,
    validUntil: row.validade_fim,
    partnerId: row.parceiro_id,
    partner: row.parceiro
      ? {
          id: row.parceiro.id,
          name: row.parceiro.nome_fantasia,
          city: row.parceiro.cidade,
        }
      : null,
  };
}

export function toRedemption(row: RedemptionRow): Redemption {
  return {
    id: row.id,
    code: row.codigo,
    qrToken: row.qr_token,
    generatedAt: row.gerado_em,
    validatedAt: row.validado_em,
    status: toRedemptionStatus(row.status),
    savedAmount: toNumber(row.valor_economizado),
    offer: row.oferta
      ? {
          id: row.oferta.id,
          title: row.oferta.titulo,
          rules: row.oferta.regras,
        }
      : null,
    partner: row.parceiro
      ? { id: row.parceiro.id, name: row.parceiro.nome_fantasia }
      : null,
  };
}

export function toRedemptionSummary(
  row: RedemptionSummaryRow,
): RedemptionSummary {
  return {
    id: row.id,
    code: row.codigo,
    status: toRedemptionStatus(row.status),
    generatedAt: row.gerado_em,
    validatedAt: row.validado_em,
    savedAmount: toNumber(row.valor_economizado),
    offer: row.oferta ? { title: row.oferta.titulo } : null,
    partner: row.parceiro ? { name: row.parceiro.nome_fantasia } : null,
  };
}

export function toValidatedRedemption(
  row: ValidatedRedemptionRow,
): ValidatedRedemption {
  return {
    savedAmount: toNumber(row.valor_economizado),
    validatedAt: row.validado_em,
  };
}
