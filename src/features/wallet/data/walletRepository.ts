import AsyncStorage from '@react-native-async-storage/async-storage';
import { env } from '../../../core/config/env';
import { supabase } from '../../../core/supabase/client';
import type {
  Association,
  CachedCard,
  MemberStatus,
  MembershipCard,
  MembershipRequest,
  MembershipRequestInput,
  MembershipRequestStatus,
} from '../domain';

const CARD_CACHE_KEY = 'corre:carteirinha';

type MemberStatusRow = 'ativo' | 'inadimplente' | 'suspenso' | 'desligado';

type CardRow = {
  id: string;
  numero_carteirinha: string;
  status: MemberStatusRow;
  data_filiacao: string;
  validade_carteirinha: string | null;
  associacao: {
    id: string;
    nome: string;
    sigla: string;
    logo_url: string | null;
    cor_primaria: string;
    cor_secundaria: string;
  } | null;
  usuario: {
    nome: string;
    cpf: string | null;
    foto_url: string | null;
    tipo_veiculo: string | null;
    placa: string | null;
  } | null;
};

type CardCacheRow = {
  usuarioId: string;
  dados: CardRow;
  sincronizadoEm: string;
};

type AssociationRow = {
  id: string;
  nome: string;
  sigla: string;
  cidade: string | null;
  uf: string | null;
};

type MembershipRequestRow = {
  id: string;
  status: 'pendente' | 'aprovada' | 'rejeitada' | 'cancelada';
  criado_em: string;
  observacao: string | null;
  associacao: { nome: string; sigla: string } | null;
};

const memberStatusFromRow: Record<MemberStatusRow, MemberStatus> = {
  ativo: 'active',
  inadimplente: 'delinquent',
  suspenso: 'suspended',
  desligado: 'terminated',
};

const memberStatusToRow: Record<MemberStatus, MemberStatusRow> = {
  active: 'ativo',
  delinquent: 'inadimplente',
  suspended: 'suspenso',
  terminated: 'desligado',
};

const requestStatusFromRow: Record<
  MembershipRequestRow['status'],
  MembershipRequestStatus
> = {
  pendente: 'pending',
  aprovada: 'approved',
  rejeitada: 'rejected',
  cancelada: 'cancelled',
};

function toMembershipCard(row: CardRow): MembershipCard {
  const association = row.associacao;
  const holder = row.usuario;
  return {
    id: row.id,
    number: row.numero_carteirinha,
    status: memberStatusFromRow[row.status] ?? 'terminated',
    memberSince: row.data_filiacao,
    expiresAt: row.validade_carteirinha,
    association: association
      ? {
          id: association.id,
          name: association.nome,
          acronym: association.sigla,
          logoUrl: association.logo_url,
          primaryColor: association.cor_primaria,
          secondaryColor: association.cor_secundaria,
        }
      : null,
    holder: holder
      ? {
          name: holder.nome,
          cpf: holder.cpf,
          photoUrl: holder.foto_url,
          vehicleType: holder.tipo_veiculo,
          plate: holder.placa,
        }
      : null,
  };
}

function toCardRow(card: MembershipCard): CardRow {
  const association = card.association;
  const holder = card.holder;
  return {
    id: card.id,
    numero_carteirinha: card.number,
    status: memberStatusToRow[card.status],
    data_filiacao: card.memberSince,
    validade_carteirinha: card.expiresAt,
    associacao: association
      ? {
          id: association.id,
          nome: association.name,
          sigla: association.acronym,
          logo_url: association.logoUrl,
          cor_primaria: association.primaryColor,
          cor_secundaria: association.secondaryColor,
        }
      : null,
    usuario: holder
      ? {
          nome: holder.name,
          cpf: holder.cpf,
          foto_url: holder.photoUrl,
          tipo_veiculo: holder.vehicleType,
          placa: holder.plate,
        }
      : null,
  };
}

function toAssociation(row: AssociationRow): Association {
  return {
    id: row.id,
    name: row.nome,
    acronym: row.sigla,
    city: row.cidade,
    state: row.uf,
  };
}

function toMembershipRequest(row: MembershipRequestRow): MembershipRequest {
  return {
    id: row.id,
    status: requestStatusFromRow[row.status] ?? 'cancelled',
    createdAt: row.criado_em,
    note: row.observacao,
    association: row.associacao
      ? { name: row.associacao.nome, acronym: row.associacao.sigla }
      : null,
  };
}

export async function fetchMembershipCard(
  userId: string,
): Promise<MembershipCard | null> {
  const { data, error } = await supabase
    .from('associados')
    .select(
      'id, numero_carteirinha, status, data_filiacao, validade_carteirinha, associacao:associacoes(id, nome, sigla, logo_url, cor_primaria, cor_secundaria)',
    )
    .eq('usuario_id', userId)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  const { data: holder, error: holderError } = await supabase
    .from('usuarios')
    .select('nome, cpf, foto_url, tipo_veiculo, placa')
    .eq('id', userId)
    .maybeSingle();
  if (holderError) {
    throw holderError;
  }
  return toMembershipCard({
    ...(data as unknown as Omit<CardRow, 'usuario'>),
    usuario: (holder as CardRow['usuario']) ?? null,
  });
}

export async function rotateCardToken(memberId: string): Promise<string> {
  const { data, error } = await supabase.rpc('gerar_token_carteirinha', {
    _associado_id: memberId,
  });
  if (error) {
    throw error;
  }
  return data as string;
}

export function verificationUrl(token: string) {
  return `${env.SITE_URL}/verificar/${token}`;
}

export async function saveCardCache(userId: string, card: MembershipCard) {
  try {
    const entry: CardCacheRow = {
      usuarioId: userId,
      dados: toCardRow(card),
      sincronizadoEm: new Date().toISOString(),
    };
    await AsyncStorage.setItem(CARD_CACHE_KEY, JSON.stringify(entry));
  } catch {}
}

export async function readCardCache(
  userId: string,
): Promise<CachedCard | null> {
  try {
    const raw = await AsyncStorage.getItem(CARD_CACHE_KEY);
    if (!raw) {
      return null;
    }
    const entry = JSON.parse(raw) as CardCacheRow;
    if (entry.usuarioId !== userId) {
      return null;
    }
    return {
      userId: entry.usuarioId,
      card: toMembershipCard(entry.dados),
      syncedAt: entry.sincronizadoEm,
    };
  } catch {
    return null;
  }
}

export async function clearCardCache() {
  try {
    await AsyncStorage.removeItem(CARD_CACHE_KEY);
  } catch {}
}

export async function fetchActiveAssociations(): Promise<Association[]> {
  const { data, error } = await supabase
    .from('associacoes')
    .select('id, nome, sigla, cidade, uf')
    .eq('ativa', true)
    .order('sigla');
  if (error) {
    throw error;
  }
  return ((data ?? []) as AssociationRow[]).map(toAssociation);
}

export async function fetchLatestMembershipRequest(
  userId: string,
): Promise<MembershipRequest | null> {
  const { data, error } = await supabase
    .from('solicitacoes_filiacao')
    .select(
      'id, status, criado_em, observacao, associacao:associacoes(nome, sigla)',
    )
    .eq('usuario_id', userId)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data
    ? toMembershipRequest(data as unknown as MembershipRequestRow)
    : null;
}

export async function submitMembershipRequest(
  userId: string,
  input: MembershipRequestInput,
) {
  const { error } = await supabase.from('solicitacoes_filiacao').insert({
    usuario_id: userId,
    associacao_id: input.associationId,
    nome: input.name.trim(),
    cpf: input.cpf || null,
    telefone: input.phone || null,
    cidade: input.city.trim() || null,
    uf: input.state.trim().toUpperCase() || null,
    tipo_veiculo: input.vehicleType,
    placa: input.plate.trim().toUpperCase() || null,
    aceite_estatuto: true,
  });
  if (error) {
    throw error;
  }
}
