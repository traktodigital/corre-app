import { supabase } from '../../../core/supabase/client';
import { startOfMonthInBrasilia, todayInBrasilia } from '../../../shared/date';
import {
  generateRedemptionCode,
  openRedemptionCutoff,
  refusalFromDbMessage,
  refusals,
  summarizeSavings,
  validityWindowRefusal,
  type Category,
  type Offer,
  type Partner,
  type PartnerSummary,
  type Redemption,
  type RedemptionResult,
  type RedemptionSummary,
  type Savings,
} from '../domain';
import {
  type CategoryRow,
  type OfferRow,
  type PartnerRow,
  type PartnerSummaryRow,
  type RedemptionRow,
  type RedemptionSummaryRow,
  type ValidatedRedemptionRow,
  toCategory,
  toOffer,
  toPartner,
  toPartnerSummary,
  toRedemption,
  toRedemptionSummary,
  toValidatedRedemption,
} from './mappers';

type QueryResult = { data: unknown; error: unknown };

function many<T>({ data, error }: QueryResult): T[] {
  if (error) {
    throw error;
  }
  return (data ?? []) as T[];
}

function one<T>({ data, error }: QueryResult): T | null {
  if (error) {
    throw error;
  }
  return (data ?? null) as T | null;
}

const OFFER_COLUMNS =
  'id, titulo, descricao, tipo, valor_desconto, preco_de, preco_por, exclusivo_associados, exclusivo_premium, destaque, validade_fim, parceiro_id';

export async function listCategories(): Promise<Category[]> {
  return many<CategoryRow>(
    await supabase
      .from('categorias')
      .select('id, nome, icone')
      .eq('ativa', true)
      .order('ordem'),
  ).map(toCategory);
}

export async function listPartners(): Promise<PartnerSummary[]> {
  return many<PartnerSummaryRow>(
    await supabase
      .from('parceiros')
      .select(
        'id, nome_fantasia, bairro, cidade, logo_url, nota_media, categoria:categorias(id, nome, icone)',
      )
      .eq('status', 'ativo')
      .order('nota_media', { ascending: false })
      .limit(100),
  ).map(toPartnerSummary);
}

export async function listFeaturedOffers(): Promise<Offer[]> {
  return many<OfferRow>(
    await supabase
      .from('ofertas')
      .select(
        `${OFFER_COLUMNS}, parceiro:parceiros!inner(id, nome_fantasia, cidade, status)`,
      )
      .eq('destaque', true)
      .eq('status', 'ativa')
      .eq('parceiros.status', 'ativo')
      .limit(6),
  ).map(toOffer);
}

export async function fetchPartner(id: string): Promise<Partner | null> {
  const row = one<PartnerRow>(
    await supabase
      .from('parceiros')
      .select(
        'id, nome_fantasia, descricao, logo_url, endereco, bairro, cidade, uf, telefone, whatsapp, instagram, horario_funcionamento, nota_media, categoria:categorias(id, nome, icone)',
      )
      .eq('id', id)
      .eq('status', 'ativo')
      .maybeSingle(),
  );
  return row ? toPartner(row) : null;
}

export async function listPartnerOffers(partnerId: string): Promise<Offer[]> {
  return many<OfferRow>(
    await supabase
      .from('ofertas')
      .select(OFFER_COLUMNS)
      .eq('parceiro_id', partnerId)
      .eq('status', 'ativa')
      .limit(50),
  ).map(toOffer);
}

export async function fetchOffer(id: string): Promise<Offer | null> {
  const row = one<OfferRow>(
    await supabase
      .from('ofertas')
      .select(
        `${OFFER_COLUMNS}, regras, validade_inicio, parceiro:parceiros(id, nome_fantasia, cidade)`,
      )
      .eq('id', id)
      .eq('status', 'ativa')
      .maybeSingle(),
  );
  return row ? toOffer(row) : null;
}

export async function fetchRedemption(id: string): Promise<Redemption | null> {
  const row = one<RedemptionRow>(
    await supabase
      .from('resgates')
      .select(
        'id, codigo, qr_token, gerado_em, validado_em, status, valor_economizado, oferta:ofertas(id, titulo, regras), parceiro:parceiros(id, nome_fantasia)',
      )
      .eq('id', id)
      .maybeSingle(),
  );
  return row ? toRedemption(row) : null;
}

export async function listUserRedemptions(
  userId: string,
): Promise<RedemptionSummary[]> {
  return many<RedemptionSummaryRow>(
    await supabase
      .from('resgates')
      .select(
        'id, codigo, status, gerado_em, validado_em, valor_economizado, oferta:ofertas(titulo), parceiro:parceiros(nome_fantasia)',
      )
      .eq('usuario_id', userId)
      .order('gerado_em', { ascending: false })
      .limit(50),
  ).map(toRedemptionSummary);
}

export async function fetchSavings(userId: string): Promise<Savings> {
  const validated = many<ValidatedRedemptionRow>(
    await supabase
      .from('resgates')
      .select('valor_economizado, validado_em')
      .eq('usuario_id', userId)
      .eq('status', 'validado'),
  ).map(toValidatedRedemption);
  return summarizeSavings(validated, startOfMonthInBrasilia());
}

type RedeemableOfferRow = {
  id: string;
  parceiro_id: string;
  status: string;
  exclusivo_associados: boolean;
  exclusivo_premium: boolean;
  limite_por_usuario: number | null;
  validade_inicio: string | null;
  validade_fim: string | null;
};

export async function createRedemption(
  offerId: string,
  userId: string,
): Promise<RedemptionResult> {
  const offer = one<RedeemableOfferRow>(
    await supabase
      .from('ofertas')
      .select(
        'id, parceiro_id, status, exclusivo_associados, exclusivo_premium, limite_por_usuario, validade_inicio, validade_fim, valor_desconto, preco_de, preco_por, tipo',
      )
      .eq('id', offerId)
      .maybeSingle(),
  );
  if (!offer || offer.status !== 'ativa') {
    return refusals.unavailable;
  }

  const windowRefusal = validityWindowRefusal(
    { validFrom: offer.validade_inicio, validUntil: offer.validade_fim },
    todayInBrasilia(),
  );
  if (windowRefusal) {
    return windowRefusal;
  }

  const cutoff = openRedemptionCutoff();
  const findOpen = async () => {
    const { data } = await supabase
      .from('resgates')
      .select('id')
      .eq('oferta_id', offer.id)
      .eq('usuario_id', userId)
      .eq('status', 'gerado')
      .gte('gerado_em', cutoff)
      .limit(1)
      .maybeSingle();
    return data?.id as string | undefined;
  };
  const open = await findOpen();
  if (open) {
    return { ok: true, redemptionId: open };
  }

  if (offer.exclusivo_premium) {
    const { data: user } = await supabase
      .from('usuarios')
      .select('plano')
      .eq('id', userId)
      .maybeSingle();
    if (user?.plano !== 'premium') {
      return refusals.premiumOnly;
    }
  }

  if (offer.exclusivo_associados) {
    const { data: member } = await supabase
      .from('associados')
      .select('id')
      .eq('usuario_id', userId)
      .in('status', ['ativo', 'inadimplente'])
      .limit(1)
      .maybeSingle();
    if (!member) {
      return refusals.membersOnly;
    }
  }

  if (offer.limite_por_usuario) {
    const { count } = await supabase
      .from('resgates')
      .select('id', { count: 'exact', head: true })
      .eq('oferta_id', offer.id)
      .eq('usuario_id', userId)
      .or(`status.eq.validado,and(status.eq.gerado,gerado_em.gte.${cutoff})`);
    if ((count ?? 0) >= offer.limite_por_usuario) {
      return refusals.usageLimitReached;
    }
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: created, error } = await supabase
      .from('resgates')
      .insert({
        oferta_id: offer.id,
        parceiro_id: offer.parceiro_id,
        usuario_id: userId,
        codigo: generateRedemptionCode(),
      })
      .select('id')
      .single();
    if (!error) {
      return { ok: true, redemptionId: created.id };
    }
    if (error.code === 'P0001') {
      return refusalFromDbMessage(error.message);
    }
    if (error.code !== '23505') {
      throw error;
    }
    const existing = await findOpen();
    if (existing) {
      return { ok: true, redemptionId: existing };
    }
  }
  return refusals.generationFailed;
}
