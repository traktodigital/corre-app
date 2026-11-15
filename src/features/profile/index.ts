import type { VehicleType } from '../auth';
import { buscarPerfil } from './api';

export { EditarPerfilScreen as EditProfileScreen } from './EditarPerfilScreen';
export { ProfileScreen } from './screen';

export type Profile = {
  id: string;
  name: string;
  email: string | null;
  cpf: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  vehicleType: VehicleType | null;
  plate: string | null;
  plan: 'free' | 'premium';
  createdAt: string;
};

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const p = await buscarPerfil(userId);
  return (
    p && {
      id: p.id,
      name: p.nome,
      email: p.email,
      cpf: p.cpf,
      phone: p.telefone,
      city: p.cidade,
      state: p.uf,
      vehicleType: p.tipo_veiculo,
      plate: p.placa,
      plan: p.plano,
      createdAt: p.criado_em,
    }
  );
}
