export type ManagedAssociation = {
  id: string;
  name: string;
  acronym: string;
};

export type PendingMembershipRequest = {
  id: string;
  userId: string;
  associationId: string;
  name: string;
  cpf: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  vehicleType: string | null;
  plate: string | null;
  createdAt: string;
};

export type ReviewFailure = {
  reason: string;
  reload: boolean;
};
