import { env } from '../../../core/config/env';
import { supabase } from '../../../core/supabase/client';
import type { VehicleType } from '../../auth';
import type { Profile, ProfilePlan, ProfileUpdate } from '../domain/profile';

const PROFILE_COLUMNS =
  'id, nome, email, cpf, telefone, cidade, uf, tipo_veiculo, placa, plano, criado_em';

type ProfileRow = {
  id: string;
  nome: string;
  email: string | null;
  cpf: string | null;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
  tipo_veiculo: VehicleType | null;
  placa: string | null;
  plano: ProfilePlan;
  criado_em: string;
};

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    name: row.nome,
    email: row.email,
    cpf: row.cpf,
    phone: row.telefone,
    city: row.cidade,
    state: row.uf,
    vehicleType: row.tipo_veiculo,
    plate: row.placa,
    plan: row.plano,
    createdAt: row.criado_em,
  };
}

function toRow(update: ProfileUpdate) {
  return {
    nome: update.name.trim(),
    telefone: update.phone || null,
    cidade: update.city.trim() || null,
    uf: update.state.trim().toUpperCase() || null,
    tipo_veiculo: update.vehicleType,
    placa: update.plate.trim().toUpperCase() || null,
  };
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('usuarios')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data ? toProfile(data as ProfileRow) : null;
}

export async function saveProfile(
  userId: string,
  update: ProfileUpdate,
): Promise<void> {
  const row = toRow(update);

  const { data, error } = await supabase
    .from('usuarios')
    .update(row)
    .eq('id', userId)
    .select('id');
  if (error) {
    throw error;
  }
  if (!data || data.length === 0) {
    const { error: insertError } = await supabase
      .from('usuarios')
      .insert({ id: userId, ...row });
    if (insertError) {
      throw insertError;
    }
  }
  await supabase.auth.updateUser({
    data: {
      nome: row.nome,
      telefone: row.telefone,
      cidade: row.cidade,
      tipo_veiculo: row.tipo_veiculo,
    },
  });
}

export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('excluir_minha_conta');
  if (error) {
    throw error;
  }
}

export const privacyPolicyUrl = () => `${env.SITE_URL}/privacidade`;
