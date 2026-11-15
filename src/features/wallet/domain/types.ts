import type { VehicleType } from '../../auth';

export type MemberStatus = 'active' | 'delinquent' | 'suspended' | 'terminated';

export type CardAssociation = {
  id: string;
  name: string;
  acronym: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
};

export type CardHolder = {
  name: string;
  cpf: string | null;
  photoUrl: string | null;
  vehicleType: string | null;
  plate: string | null;
};

export type MembershipCard = {
  id: string;
  number: string;
  status: MemberStatus;
  memberSince: string;
  expiresAt: string | null;
  association: CardAssociation | null;
  holder: CardHolder | null;
};

export type CachedCard = {
  userId: string;
  card: MembershipCard;
  syncedAt: string;
};

export type Association = {
  id: string;
  name: string;
  acronym: string;
  city: string | null;
  state: string | null;
};

export type MembershipRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type MembershipRequest = {
  id: string;
  status: MembershipRequestStatus;
  createdAt: string;
  note: string | null;
  association: { name: string; acronym: string } | null;
};

export type MembershipRequestInput = {
  associationId: string;
  name: string;
  cpf: string;
  phone: string;
  city: string;
  state: string;
  vehicleType: VehicleType;
  plate: string;
};

export type MembershipRequestForm = Pick<
  MembershipRequestInput,
  'associationId' | 'name' | 'cpf' | 'phone' | 'city'
> & { acceptedBylaws: boolean };
