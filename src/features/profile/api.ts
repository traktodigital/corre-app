import { env } from '../../config/env';
import { supabase } from '../../lib/supabase';
import type { TipoVeiculo } from '../auth/AuthProvider';

export type Perfil = {
  id: string;
  nome: string;
  email: string | null;
  cpf: string | null;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
  tipo_veiculo: TipoVeiculo | null;
  placa: string | null;
  plano: 'free' | 'premium';
  criado_em: string;
};

/** Linha do próprio usuário em `usuarios` (RLS `usuarios_select_proprio`). */
export async function buscarPerfil(usuarioId: string): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from('usuarios')
    .select(
      'id, nome, email, cpf, telefone, cidade, uf, tipo_veiculo, placa, plano, criado_em',
    )
    .eq('id', usuarioId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data as Perfil | null;
}

export type EdicaoPerfil = {
  nome: string;
  telefone: string;
  cidade: string;
  uf: string;
  tipo_veiculo: TipoVeiculo;
  placa: string;
};

/**
 * Atualiza só os campos que o entregador pode mexer — plano e status ficam
 * com o admin. Também espelha no metadata do auth para o "Olá, fulano".
 */
export async function salvarPerfil(usuarioId: string, d: EdicaoPerfil) {
  const campos = {
    nome: d.nome.trim(),
    telefone: d.telefone || null,
    cidade: d.cidade.trim() || null,
    uf: d.uf.trim().toUpperCase() || null,
    tipo_veiculo: d.tipo_veiculo,
    placa: d.placa.trim().toUpperCase() || null,
  };
  // `.select` para saber se alguma linha mudou: update em 0 linhas não dá erro.
  const { data, error } = await supabase
    .from('usuarios')
    .update(campos)
    .eq('id', usuarioId)
    .select('id');
  if (error) {
    throw error;
  }
  if (!data || data.length === 0) {
    // Cadastro sem linha em `usuarios` (o garantirPerfil do login falhou):
    // cria agora. O trigger corre_usuarios_ao_criar força plano free / status ativo.
    const { error: erroInsert } = await supabase
      .from('usuarios')
      .insert({ id: usuarioId, ...campos });
    if (erroInsert) {
      throw erroInsert;
    }
  }
  await supabase.auth.updateUser({
    data: {
      nome: campos.nome,
      telefone: campos.telefone,
      cidade: campos.cidade,
      tipo_veiculo: campos.tipo_veiculo,
    },
  });
}

export const urlExclusaoConta = () => `${env.SITE_URL}/excluir-conta`;
