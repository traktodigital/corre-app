import type { VehicleType } from '../../auth';

export type ProfilePlan = 'free' | 'premium';

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
  plan: ProfilePlan;
  createdAt: string;
};

export type ProfileUpdate = {
  name: string;
  phone: string;
  city: string;
  state: string;
  vehicleType: VehicleType;
  plate: string;
};
