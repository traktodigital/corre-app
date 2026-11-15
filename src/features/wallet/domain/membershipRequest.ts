import { isValidCpf } from '../../../shared/format';
import { isValidPhone } from '../../auth';
import type { MembershipRequestForm } from './types';

export function validateMembershipRequest(
  form: MembershipRequestForm,
): string | null {
  if (!form.associationId) {
    return 'Escolha a associação.';
  }
  if (form.name.trim().split(/\s+/).length < 2) {
    return 'Escreve seu nome completo, por favor.';
  }
  if (!isValidCpf(form.cpf)) {
    return 'CPF inválido. Confere os números.';
  }
  if (!isValidPhone(form.phone)) {
    return 'Telefone incompleto. Use DDD + 9 dígitos.';
  }
  if (!form.city.trim()) {
    return 'Qual a sua cidade?';
  }
  if (!form.acceptedBylaws) {
    return 'Você precisa aceitar o estatuto pra continuar.';
  }
  return null;
}
