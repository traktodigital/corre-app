export type Role =
  | 'entregador'
  | 'admin_trakto'
  | 'admin_associacao'
  | 'parceiro'
  | 'contratante';

export type VehicleType = 'moto' | 'bike' | 'carro' | 'a_pe';

export type SignUpInput = {
  name: string;
  email: string;
  password: string;
  phone: string;
  city: string;
  vehicleType: VehicleType;
};

export type AuthResult = { error: string | null };

export type SignUpResult = AuthResult & { needsConfirmation: boolean };

export type UserAccess = {
  roles: Role[];
  managedAssociationIds: string[];
};

export const NO_ACCESS: UserAccess = { roles: [], managedAssociationIds: [] };
