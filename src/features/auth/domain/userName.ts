export const FIRST_NAME_FALLBACK = 'entregador';

export function firstNameOf(fullName: string): string {
  return fullName.trim().split(' ')[0] || FIRST_NAME_FALLBACK;
}
