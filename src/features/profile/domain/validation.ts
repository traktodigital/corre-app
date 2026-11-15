import { isValidPhone, type VehicleType } from '../../auth';

export type ProfileFormInput = {
  name: string;
  phone: string;
  city: string;
};

export function validateProfile(input: ProfileFormInput): string | null {
  if (input.name.trim().split(/\s+/).length < 2) {
    return 'Escreve seu nome completo, por favor.';
  }
  if (!isValidPhone(input.phone)) {
    return 'Telefone incompleto. Use DDD + 9 dígitos.';
  }
  if (!input.city.trim()) {
    return 'Qual a sua cidade?';
  }
  return null;
}

export function vehicleHasPlate(vehicleType: VehicleType): boolean {
  return vehicleType === 'moto' || vehicleType === 'carro';
}
