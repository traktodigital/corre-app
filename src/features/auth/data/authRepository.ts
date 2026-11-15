import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../../core/supabase/client';
import {
  PASSWORD_RESET_FAILED,
  signInErrorMessage,
  signUpErrorMessage,
} from '../domain/authErrors';
import type {
  AuthResult,
  Role,
  SignUpInput,
  SignUpResult,
  UserAccess,
} from '../domain/types';
import { readUserMetadata, toStoredUserMetadata } from './userMetadata';

const COURIER_ROLE: Role = 'entregador';
const ASSOCIATION_ADMIN_ROLE: Role = 'admin_associacao';

type RoleRow = { papel: string; associacao_id: string | null };

export type SignInOutcome = AuthResult & { access: UserAccess | null };

export type SignUpOutcome = SignUpResult & { access: UserAccess | null };

export function toUserAccess(rows: RoleRow[]): UserAccess {
  return {
    roles: rows.map(row => row.papel as Role),
    managedAssociationIds: rows
      .filter(row => row.papel === ASSOCIATION_ADMIN_ROLE && row.associacao_id)
      .map(row => row.associacao_id as string),
  };
}

export async function loadUserAccess(userId: string): Promise<UserAccess> {
  const { data } = await supabase
    .from('papeis_usuario')
    .select('papel, associacao_id')
    .eq('usuario_id', userId);
  return toUserAccess(data ?? []);
}

async function defaultAssociation(): Promise<{ uf: string | null } | null> {
  const { data } = await supabase
    .from('associacoes')
    .select('uf')
    .eq('ativa', true)
    .limit(2);
  return data?.length === 1 ? data[0] : null;
}

async function ensureProfile(user: User): Promise<void> {
  const metadata = readUserMetadata(user);
  try {
    const { data: profile } = await supabase
      .from('usuarios')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      const association = await defaultAssociation();
      await supabase.from('usuarios').insert({
        id: user.id,
        nome: metadata.name ?? '',
        email: user.email ?? null,
        telefone: metadata.phone ?? null,
        cidade: metadata.city ?? null,
        uf: association?.uf ?? null,
        tipo_veiculo: metadata.vehicleType ?? null,
      });
    }

    const { data: courierRole } = await supabase
      .from('papeis_usuario')
      .select('id')
      .eq('usuario_id', user.id)
      .eq('papel', COURIER_ROLE)
      .maybeSingle();

    if (!courierRole) {
      await supabase
        .from('papeis_usuario')
        .insert({ usuario_id: user.id, papel: COURIER_ROLE });
    }
  } catch {}
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function subscribeToSession(
  listener: (session: Session | null) => void,
): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) =>
    listener(session),
  );
  return () => data.subscription.unsubscribe();
}

export async function signIn(
  email: string,
  password: string,
): Promise<SignInOutcome> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) {
    return { error: signInErrorMessage(error), access: null };
  }
  await ensureProfile(data.user);
  return { error: null, access: await loadUserAccess(data.user.id) };
}

export async function signUp(input: SignUpInput): Promise<SignUpOutcome> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: { data: toStoredUserMetadata(input) },
  });
  if (error) {
    if (__DEV__) {
      console.warn('signUp', error.status, error.code, error.message);
    }
    return {
      error: signUpErrorMessage(error),
      needsConfirmation: false,
      access: null,
    };
  }
  if (data.session && data.user) {
    await ensureProfile(data.user);
    return {
      error: null,
      needsConfirmation: false,
      access: await loadUserAccess(data.user.id),
    };
  }
  return { error: null, needsConfirmation: true, access: null };
}

export async function sendPasswordReset(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  return { error: error ? PASSWORD_RESET_FAILED : null };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
