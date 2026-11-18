import { supabase } from '../../../core/supabase/client';
import type { ConsentStatus, ConsentText, Sender } from '../domain';

const PURPOSE = '3b_indenizacao';
const FLAG = 'rota_3b';

export async function isThreeBRouteEnabled(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('app_flags')
      .select('ligada')
      .eq('chave', FLAG)
      .maybeSingle<{ ligada: boolean }>();
    return !error && data?.ligada === true;
  } catch {
    return false;
  }
}

export async function fetchThreeBConsent(
  userId: string,
): Promise<ConsentStatus> {
  const { data, error } = await supabase
    .from('consentimentos')
    .select('acao')
    .eq('usuario_id', userId)
    .eq('finalidade', PURPOSE)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle<{ acao: 'aceitou' | 'revogou' }>();
  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }
  return data.acao === 'aceitou' ? 'accepted' : 'revoked';
}

export async function recordThreeBConsent(
  status: Exclude<ConsentStatus, null>,
): Promise<void> {
  const { error } = await supabase.from('consentimentos').insert({
    finalidade: PURPOSE,
    acao: status === 'accepted' ? 'aceitou' : 'revogou',
  });
  if (error) {
    throw error;
  }
}

export async function fetchConsentText(): Promise<ConsentText> {
  const { data, error } = await supabase
    .from('textos_consentimento')
    .select('versao, texto')
    .eq('finalidade', PURPOSE)
    .order('criado_em', { ascending: false })
    .limit(1)
    .single<{ versao: string; texto: string }>();
  if (error) {
    throw error;
  }
  return { version: data.versao, text: data.texto };
}

export async function recordThreeBLead(): Promise<void> {
  try {
    await supabase.from('leads_parceiros').insert({ parceiro: '3b' });
  } catch {}
}

type SenderRow = {
  nome: string | null;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
};

export async function fetchSender(userId: string): Promise<Sender> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('nome, cpf, telefone, email')
    .eq('id', userId)
    .maybeSingle<SenderRow>();
  if (error) {
    throw error;
  }
  return {
    name: data?.nome ?? '',
    cpf: data?.cpf ?? null,
    phone: data?.telefone ?? null,
    email: data?.email ?? null,
  };
}
