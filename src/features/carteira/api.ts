import AsyncStorage from '@react-native-async-storage/async-storage';
import { env } from '../../config/env';
import { supabase } from '../../lib/supabase';
import type { TipoVeiculo } from '../auth/AuthProvider';

/** Mesmas consultas do web (goias-delivery-link/src/lib/carteirinha.ts). */

export type StatusAssociado =
  | 'ativo'
  | 'inadimplente'
  | 'suspenso'
  | 'desligado';

export type Carteirinha = {
  id: string;
  numero_carteirinha: string;
  status: StatusAssociado;
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

/** Carteirinha do associado logado, com a associação (white-label) e o perfil. */
export async function buscarCarteirinha(
  usuarioId: string,
): Promise<Carteirinha | null> {
  const { data, error } = await supabase
    .from('associados')
    .select(
      'id, numero_carteirinha, status, data_filiacao, validade_carteirinha, associacao:associacoes(id, nome, sigla, logo_url, cor_primaria, cor_secundaria)',
    )
    .eq('usuario_id', usuarioId)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }
  // Se falhar, a busca toda falha: uma carteirinha sem nome/CPF não pode
  // sobrescrever o cache offline bom.
  const { data: usuario, error: erroUsuario } = await supabase
    .from('usuarios')
    .select('nome, cpf, foto_url, tipo_veiculo, placa')
    .eq('id', usuarioId)
    .maybeSingle();
  if (erroUsuario) {
    throw erroUsuario;
  }
  return { ...(data as object), usuario: usuario ?? null } as Carteirinha;
}

/**
 * Token opaco novo (RPC `gerar_token_carteirinha`): giramos a cada 60s e ele vale
 * 90s no banco — a folga cobre o tempo do fiscal apontar a câmera.
 * Nenhum dado pessoal vai no QR; print de tela não serve depois que o token expira.
 */
export async function girarToken(associadoId: string): Promise<string> {
  const { data, error } = await supabase.rpc('gerar_token_carteirinha', {
    _associado_id: associadoId,
  });
  if (error) {
    throw error;
  }
  return data as string;
}

export const INTERVALO_TOKEN_MS = 60_000;
/** Sem internet, tenta gerar o token de novo nesse intervalo. */
export const RETENTATIVA_TOKEN_MS = 8_000;

/** O QR abre a página pública de verificação do site. */
export function urlVerificacao(token: string) {
  return `${env.SITE_URL}/verificar/${token}`;
}

export function selo(status: StatusAssociado): {
  tom: 'ativo' | 'a-vencer' | 'inadimplente';
  texto: string;
} {
  if (status === 'ativo') {
    return { tom: 'ativo', texto: 'Ativo' };
  }
  if (status === 'inadimplente') {
    return { tom: 'inadimplente', texto: 'Inadimplente' };
  }
  if (status === 'suspenso') {
    return { tom: 'a-vencer', texto: 'Suspenso' };
  }
  return { tom: 'inadimplente', texto: 'Desligado' };
}

// ─── Modo offline ───────────────────────────────────────────────────────────
// A carteirinha precisa abrir sem internet: guardamos a última versão no celular.
// Sem internet não há token novo, então a tela mostra a identificação + aviso
// de "última sincronização" e o QR volta quando a conexão voltar.

const CHAVE_CACHE = 'corre:carteirinha';

/**
 * Card parado há dias não é prova de nada (basta desligar o Wi-Fi): passado o
 * prazo, a carteirinha some e a tela pede internet pra confirmar o status.
 */
export const DIAS_MAX_CACHE = 7;

export function cacheVencido(
  c: Pick<CacheCarteirinha, 'sincronizadoEm'>,
  agora = Date.now(),
): boolean {
  const idade = agora - new Date(c.sincronizadoEm).getTime();
  return !(idade <= DIAS_MAX_CACHE * 86_400_000);
}

export type CacheCarteirinha = {
  usuarioId: string;
  dados: Carteirinha;
  sincronizadoEm: string;
};

export async function salvarCache(usuarioId: string, dados: Carteirinha) {
  try {
    const cache: CacheCarteirinha = {
      usuarioId,
      dados,
      sincronizadoEm: new Date().toISOString(),
    };
    await AsyncStorage.setItem(CHAVE_CACHE, JSON.stringify(cache));
  } catch {
    // Sem espaço: segue sem cache.
  }
}

/** Só devolve o cache do mesmo usuário (celular compartilhado não vaza carteirinha). */
export async function lerCache(
  usuarioId: string,
): Promise<CacheCarteirinha | null> {
  try {
    const bruto = await AsyncStorage.getItem(CHAVE_CACHE);
    if (!bruto) {
      return null;
    }
    const cache = JSON.parse(bruto) as CacheCarteirinha;
    return cache.usuarioId === usuarioId ? cache : null;
  } catch {
    return null;
  }
}

export async function limparCache() {
  try {
    await AsyncStorage.removeItem(CHAVE_CACHE);
  } catch {
    // nada a fazer
  }
}

// ─── Filiação ───────────────────────────────────────────────────────────────

export type AssociacaoAtiva = {
  id: string;
  nome: string;
  sigla: string;
  cidade: string | null;
  uf: string | null;
};

export async function listarAssociacoesAtivas(): Promise<AssociacaoAtiva[]> {
  const { data, error } = await supabase
    .from('associacoes')
    .select('id, nome, sigla, cidade, uf')
    .eq('ativa', true)
    .order('sigla');
  if (error) {
    throw error;
  }
  return data ?? [];
}

export type Solicitacao = {
  id: string;
  status: 'pendente' | 'aprovada' | 'rejeitada' | 'cancelada';
  criado_em: string;
  observacao: string | null;
  associacao: { nome: string; sigla: string } | null;
};

export async function buscarMinhaSolicitacao(
  usuarioId: string,
): Promise<Solicitacao | null> {
  const { data, error } = await supabase
    .from('solicitacoes_filiacao')
    .select(
      'id, status, criado_em, observacao, associacao:associacoes(nome, sigla)',
    )
    .eq('usuario_id', usuarioId)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data as unknown as Solicitacao | null;
}

export type DadosFiliacao = {
  associacaoId: string;
  nome: string;
  cpf: string;
  telefone: string;
  cidade: string;
  uf: string;
  veiculo: TipoVeiculo;
  placa: string;
};

/**
 * Pedido de filiação: a diretoria aprova no painel da associação e aí nasce o
 * `associados` (com `associacao_id`) que libera a carteirinha.
 */
export async function enviarFiliacao(usuarioId: string, d: DadosFiliacao) {
  const { error } = await supabase.from('solicitacoes_filiacao').insert({
    usuario_id: usuarioId,
    associacao_id: d.associacaoId,
    nome: d.nome.trim(),
    cpf: d.cpf || null,
    telefone: d.telefone || null,
    cidade: d.cidade.trim() || null,
    uf: d.uf.trim().toUpperCase() || null,
    tipo_veiculo: d.veiculo,
    placa: d.placa.trim().toUpperCase() || null,
    aceite_estatuto: true,
  });
  if (error) {
    throw error;
  }
}
