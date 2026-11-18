import { supabase } from '../../../core/supabase/client';
import { onlyDigits } from '../../../shared/format';
import type { EmergencyContact, EmergencyEvent } from '../domain';

const EVENT_TO_DB: Record<EmergencyEvent, string> = {
  triggered: 'acionou',
  called192: 'ligou_192',
  called193: 'ligou_193',
  notifiedContact: 'avisou_contato',
  ended: 'encerrou',
};

type ContactRow = { nome: string; telefone: string };

export type StartPosition = {
  lat: number;
  lng: number;
  accuracy: number | null;
};

export async function fetchEmergencyContact(
  userId: string,
): Promise<EmergencyContact | null> {
  const { data, error } = await supabase
    .from('contatos_emergencia')
    .select('nome, telefone')
    .eq('usuario_id', userId)
    .maybeSingle<ContactRow>();
  if (error) {
    throw error;
  }
  return data ? { name: data.nome, phone: data.telefone } : null;
}

export async function saveEmergencyContact(
  userId: string,
  contact: EmergencyContact,
): Promise<void> {
  const { error } = await supabase.from('contatos_emergencia').upsert({
    usuario_id: userId,
    nome: contact.name.trim(),
    telefone: onlyDigits(contact.phone),
  });
  if (error) {
    throw error;
  }
}

export async function startEmergency(
  position: StartPosition | null,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('emergencia_eventos')
      .insert({
        tipo: EVENT_TO_DB.triggered,
        lat: position?.lat ?? null,
        lng: position?.lng ?? null,
        precisao_m: position?.accuracy ?? null,
      })
      .select('emergencia_id')
      .single<{ emergencia_id: string }>();
    return error ? null : data.emergencia_id;
  } catch {
    return null;
  }
}

export async function logEmergencyEvent(
  emergencyId: string,
  event: Exclude<EmergencyEvent, 'triggered'>,
): Promise<void> {
  try {
    await supabase
      .from('emergencia_eventos')
      .insert({ emergencia_id: emergencyId, tipo: EVENT_TO_DB[event] });
  } catch {}
}
