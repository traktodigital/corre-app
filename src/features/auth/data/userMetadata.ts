import type { User } from '@supabase/supabase-js';
import type { SignUpInput, VehicleType } from '../domain/types';
import { firstNameOf } from '../domain/userName';

type StoredUserMetadata = {
  nome?: string;
  telefone?: string;
  cidade?: string;
  tipo_veiculo?: VehicleType;
};

export type UserMetadata = {
  name?: string;
  phone?: string;
  city?: string;
  vehicleType?: VehicleType;
};

export function toStoredUserMetadata(input: SignUpInput): StoredUserMetadata {
  return {
    nome: input.name.trim(),
    telefone: input.phone,
    cidade: input.city.trim(),
    tipo_veiculo: input.vehicleType,
  };
}

export function readUserMetadata(user: User | null): UserMetadata {
  const stored = (user?.user_metadata ?? {}) as StoredUserMetadata;
  return {
    name: stored.nome,
    phone: stored.telefone,
    city: stored.cidade,
    vehicleType: stored.tipo_veiculo,
  };
}

export function firstName(user: User | null): string {
  return firstNameOf(readUserMetadata(user).name ?? '');
}
