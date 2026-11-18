import { onlyDigits } from '../../../shared/format';

export const HOLD_TO_TRIGGER_MS = 3000;

export type EmergencyEvent =
  | 'triggered'
  | 'called192'
  | 'called193'
  | 'notifiedContact'
  | 'ended';

export const EMERGENCY_LINES = [
  { number: '192', label: 'SAMU', event: 'called192' },
  { number: '193', label: 'Bombeiros', event: 'called193' },
] as const;

export type EmergencyContact = { name: string; phone: string };

export type Position = { lat: number; lng: number };

const BRASILIA_OFFSET_MS = 3 * 3600_000;

export function mapsLink({ lat, lng }: Position): string {
  return `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

function brasiliaTime(at: Date): string {
  const local = new Date(at.getTime() - BRASILIA_OFFSET_MS);
  const hh = String(local.getUTCHours()).padStart(2, '0');
  const mm = String(local.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function emergencyMessage(
  senderName: string,
  position: Position | null,
  at: Date,
): string {
  const who = senderName.trim() ? `Aqui é ${senderName.trim()}. ` : '';
  const where = position
    ? `Minha localização: ${mapsLink(position)}`
    : 'Não consegui pegar minha localização.';
  return (
    `EMERGÊNCIA. ${who}Acionei o botão de emergência do CORRE às ${brasiliaTime(
      at,
    )}. ` +
    `${where} Me liga. Se eu não atender, chama o 192 (SAMU) ou o 193 (Bombeiros).`
  );
}

export function validateContact(contact: EmergencyContact): string | null {
  if (!contact.name.trim()) {
    return 'Qual o nome do seu contato?';
  }
  const digits = onlyDigits(contact.phone);
  if (digits.length < 10 || digits.length > 11) {
    return 'Confere o telefone com DDD.';
  }
  return null;
}

export function whatsappUrl(phone: string, text: string): string {
  return `https://wa.me/55${onlyDigits(phone)}?text=${encodeURIComponent(
    text,
  )}`;
}

export function smsUrl(
  phone: string,
  text: string,
  platform: 'ios' | 'android',
): string {
  const separator = platform === 'ios' ? '&' : '?';
  return `sms:+55${onlyDigits(phone)}${separator}body=${encodeURIComponent(
    text,
  )}`;
}
