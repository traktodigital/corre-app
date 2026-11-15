import { isValidPhone } from './phone';
import type { SignUpInput } from './types';

export const MIN_PASSWORD_LENGTH = 8;

export type SignUpFields = Pick<
  SignUpInput,
  'name' | 'email' | 'phone' | 'password' | 'city'
>;

export function validateSignUp(fields: SignUpFields): string | null {
  if (!fields.name.trim() || !fields.email.trim() || !fields.city.trim()) {
    return 'Preenche todos os campos, por favor.';
  }
  if (!isValidPhone(fields.phone)) {
    return 'Telefone incompleto. Use DDD + 9 dígitos, tipo (62) 9 9999-9999.';
  }
  if (fields.password.length < MIN_PASSWORD_LENGTH) {
    return `A senha precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  return null;
}

export function nameWarning(name: string): string | null {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length === 1
    ? 'Se tiver sobrenome, coloca também — ajuda na carteirinha.'
    : null;
}
