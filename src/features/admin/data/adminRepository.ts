import { supabase } from '../../../core/supabase/client';
import type { ManagedAssociation, PendingMembershipRequest } from '../domain';

type ManagedAssociationRow = {
  id: string;
  nome: string;
  sigla: string;
};

type PendingRequestRow = {
  id: string;
  usuario_id: string;
  associacao_id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
  tipo_veiculo: string | null;
  placa: string | null;
  criado_em: string;
};

function toManagedAssociation(row: ManagedAssociationRow): ManagedAssociation {
  return { id: row.id, name: row.nome, acronym: row.sigla };
}

function toPendingRequest(row: PendingRequestRow): PendingMembershipRequest {
  return {
    id: row.id,
    userId: row.usuario_id,
    associationId: row.associacao_id,
    name: row.nome,
    cpf: row.cpf,
    phone: row.telefone,
    city: row.cidade,
    state: row.uf,
    vehicleType: row.tipo_veiculo,
    plate: row.placa,
    createdAt: row.criado_em,
  };
}

export async function fetchManagedAssociations(
  ids: string[],
): Promise<ManagedAssociation[]> {
  if (ids.length === 0) {
    return [];
  }
  const { data, error } = await supabase
    .from('associacoes')
    .select('id, nome, sigla')
    .in('id', ids)
    .order('sigla');
  if (error) {
    throw error;
  }
  return ((data ?? []) as ManagedAssociationRow[]).map(toManagedAssociation);
}

export async function fetchPendingRequests(
  associationId: string,
): Promise<PendingMembershipRequest[]> {
  const { data, error } = await supabase
    .from('solicitacoes_filiacao')
    .select(
      'id, usuario_id, associacao_id, nome, cpf, telefone, cidade, uf, tipo_veiculo, placa, criado_em',
    )
    .eq('associacao_id', associationId)
    .eq('status', 'pendente')
    .order('criado_em', { ascending: true });
  if (error) {
    throw error;
  }
  return ((data ?? []) as PendingRequestRow[]).map(toPendingRequest);
}

export async function approveMembershipRequest(requestId: string) {
  const { error } = await supabase.rpc('aprovar_solicitacao_filiacao', {
    _solicitacao_id: requestId,
  });
  if (error) {
    throw error;
  }
}

export async function rejectMembershipRequest(requestId: string, note: string) {
  const { error } = await supabase.rpc('rejeitar_solicitacao_filiacao', {
    _solicitacao_id: requestId,
    _observacao: note.trim(),
  });
  if (error) {
    throw error;
  }
}
