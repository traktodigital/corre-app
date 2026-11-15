import { env } from '../../core/config/env';
import { supabase } from '../../core/supabase/client';
import type { VehicleType } from '../auth';

export type Perfil = {
  id: string;
  nome: string;
  email: string | null;
  cpf: string | null;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
  tipo_veiculo: VehicleType | null;
  placa: string | null;
  plano: 'free' | 'premium';
  criado_em: string;
};

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
  tipo_veiculo: VehicleType;
  placa: string;
};

export async function salvarPerfil(usuarioId: string, d: EdicaoPerfil) {
  const campos = {
    nome: d.nome.trim(),
    telefone: d.telefone || null,
    cidade: d.cidade.trim() || null,
    uf: d.uf.trim().toUpperCase() || null,
    tipo_veiculo: d.tipo_veiculo,
    placa: d.placa.trim().toUpperCase() || null,
  };

  const { data, error } = await supabase
    .from('usuarios')
    .update(campos)
    .eq('id', usuarioId)
    .select('id');
  if (error) {
    throw error;
  }
  if (!data || data.length === 0) {
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

export async function excluirMinhaConta(): Promise<void> {
  const { error } = await supabase.rpc('excluir_minha_conta');
  if (error) {
    throw error;
  }
}

export const urlPrivacidade = () => `${env.SITE_URL}/privacidade`;
