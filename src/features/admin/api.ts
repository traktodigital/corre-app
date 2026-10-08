import { supabase } from '../../lib/supabase';

export type AssociacaoAdministrada = {
  id: string;
  nome: string;
  sigla: string;
};

export type PedidoFiliacao = {
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

export async function listarAssociacoesAdministradas(
  ids: string[],
): Promise<AssociacaoAdministrada[]> {
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
  return data ?? [];
}

export async function listarPedidosPendentes(
  associacaoId: string,
): Promise<PedidoFiliacao[]> {
  const { data, error } = await supabase
    .from('solicitacoes_filiacao')
    .select(
      'id, usuario_id, associacao_id, nome, cpf, telefone, cidade, uf, tipo_veiculo, placa, criado_em',
    )
    .eq('associacao_id', associacaoId)
    .eq('status', 'pendente')
    .order('criado_em', { ascending: true });
  if (error) {
    throw error;
  }
  return data ?? [];
}

/**
 * A RPC confere a permissão no servidor e conclui, numa única transação,
 * perfil + associado + papel da associação + status da solicitação.
 */
export async function aprovarPedidoFiliacao(solicitacaoId: string) {
  const { error } = await supabase.rpc('aprovar_solicitacao_filiacao', {
    _solicitacao_id: solicitacaoId,
  });
  if (error) {
    throw error;
  }
}

export async function rejeitarPedidoFiliacao(
  solicitacaoId: string,
  observacao: string,
) {
  const { error } = await supabase.rpc('rejeitar_solicitacao_filiacao', {
    _solicitacao_id: solicitacaoId,
    _observacao: observacao.trim(),
  });
  if (error) {
    throw error;
  }
}

export const MIN_MOTIVO_RECUSA = 5; // espelha o check de rejeitar_solicitacao_filiacao

/** Traduz o erro das RPCs de filiação; `recarregar` indica que a fila mudou. */
export function motivoFiliacao(mensagem: string): {
  motivo: string;
  recarregar: boolean;
} {
  const m = mensagem.toLowerCase();
  if (m.includes('já analisado') || m.includes('não encontrado')) {
    return {
      motivo:
        'Esse pedido já foi analisado por outra pessoa. A lista foi atualizada.',
      recarregar: true,
    };
  }
  if (m.includes('motivo da recusa')) {
    return {
      motivo: `Escreva um motivo com pelo menos ${MIN_MOTIVO_RECUSA} letras.`,
      recarregar: false,
    };
  }
  if (m.includes('could not find the function')) {
    return {
      motivo: 'A aprovação ainda não está ativa no servidor. Avise o suporte.',
      recarregar: false,
    };
  }
  if (m.includes('sem permissão') || m.includes('autenticação')) {
    return {
      motivo: 'Sua conta não tem permissão para esta associação.',
      recarregar: false,
    };
  }
  return {
    motivo: 'Não foi possível concluir. Verifique a conexão e tente novamente.',
    recarregar: false,
  };
}
