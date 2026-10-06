import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

export type Papel =
  | 'entregador'
  | 'admin_trakto'
  | 'admin_associacao'
  | 'parceiro'
  | 'contratante';

export type TipoVeiculo = 'moto' | 'bike' | 'carro' | 'a_pe';

export type DadosCadastro = {
  nome: string;
  email: string;
  senha: string;
  telefone: string;
  cidade: string;
  veiculo: TipoVeiculo;
};

type Resultado = { erro: string | null };

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  papeis: Papel[];
  carregando: boolean;
  /** Visitante que escolheu "Explorar sem cadastro". */
  visitante: boolean;
  explorarSemCadastro: () => void;
  sairDoModoVisitante: () => void;
  entrar: (email: string, senha: string) => Promise<Resultado>;
  criarConta: (
    dados: DadosCadastro,
  ) => Promise<Resultado & { precisaConfirmar: boolean }>;
  recuperarSenha: (email: string) => Promise<Resultado>;
  sair: () => Promise<void>;
  temPapel: (papel: Papel) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Igual ao `garantirPerfil` do web: cria a linha em `usuarios` e o papel
 * `entregador` se ainda não existirem. Falhas são ignoradas (não bloqueiam o login).
 */
async function garantirPerfil(user: User) {
  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  try {
    const { data: perfil } = await supabase
      .from('usuarios')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!perfil) {
      const associacao = await associacaoPadrao();
      await supabase.from('usuarios').insert({
        id: user.id,
        nome: meta.nome ?? '',
        email: user.email ?? null,
        telefone: meta.telefone ?? null,
        cidade: meta.cidade ?? null,
        uf: associacao?.uf ?? null,
        tipo_veiculo: meta.tipo_veiculo ?? null,
      });
    }

    const { data: papel } = await supabase
      .from('papeis_usuario')
      .select('id')
      .eq('usuario_id', user.id)
      .eq('papel', 'entregador')
      .maybeSingle();

    // Sem associacao_id: o vínculo com a associação só nasce na filiação
    // aprovada (regra validada; a RLS papeis_insert_entregador_proprio exige null).
    if (!papel) {
      await supabase
        .from('papeis_usuario')
        .insert({ usuario_id: user.id, papel: 'entregador' });
    }
  } catch {
    // Mesmo comportamento do web: segue sem perfil e tenta de novo no próximo login.
  }
}

/**
 * O estado (uf) é atributo da associação, não constante no código. Com uma
 * única associação ativa (hoje a ASSEMAG), o perfil nasce com o estado dela.
 */
async function associacaoPadrao(): Promise<{ uf: string | null } | null> {
  const { data } = await supabase
    .from('associacoes')
    .select('uf')
    .eq('ativa', true)
    .limit(2);
  return data?.length === 1 ? data[0] : null;
}

/** Erro do signUp do Supabase Auth → texto da tela. */
export function motivoCadastro(e: { code?: string; message: string }): string {
  const m = e.message.toLowerCase();
  if (e.code === 'user_already_exists' || m.includes('registered')) {
    return 'Esse e-mail já tem conta. Tenta entrar.';
  }
  if (e.code === 'weak_password') {
    return 'Senha fraca. Use letras e números, com pelo menos 8 caracteres.';
  }
  if (e.code === 'email_address_invalid') {
    return 'Esse e-mail não parece válido. Confere aí.';
  }
  if (e.code === 'over_email_send_rate_limit' || m.includes('rate limit')) {
    return 'Muitos cadastros agora. Espera uns minutos e tenta de novo.';
  }
  return 'Não deu pra criar a conta agora. Tenta de novo.';
}

async function carregarPapeis(userId: string): Promise<Papel[]> {
  const { data } = await supabase
    .from('papeis_usuario')
    .select('papel')
    .eq('usuario_id', userId);
  return (data ?? []).map(p => p.papel as Papel);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [papeis, setPapeis] = useState<Papel[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [visitante, setVisitante] = useState(false);

  useEffect(() => {
    let ativo = true;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!ativo) {
          return;
        }
        setSession(data.session);
        if (data.session) {
          setPapeis(await carregarPapeis(data.session.user.id));
        }
      })
      .finally(() => ativo && setCarregando(false));

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, nova) => {
      setSession(nova);
      if (nova) {
        setVisitante(false);
        // Fora do callback para não travar o cliente (recomendação do supabase-js).
        setTimeout(() => {
          carregarPapeis(nova.user.id).then(p => ativo && setPapeis(p));
        }, 0);
      } else {
        setPapeis([]);
      }
    });

    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const entrar = useCallback(async (email: string, senha: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    if (error) {
      return {
        erro: error.message.toLowerCase().includes('invalid')
          ? 'E-mail ou senha errados. Confere aí.'
          : 'Não deu pra entrar agora. Tenta de novo.',
      };
    }
    await garantirPerfil(data.user);
    setPapeis(await carregarPapeis(data.user.id));
    return { erro: null };
  }, []);

  const criarConta = useCallback(async (d: DadosCadastro) => {
    const { data, error } = await supabase.auth.signUp({
      email: d.email.trim(),
      password: d.senha,
      options: {
        data: {
          nome: d.nome.trim(),
          telefone: d.telefone,
          cidade: d.cidade.trim(),
          tipo_veiculo: d.veiculo,
        },
      },
    });
    if (error) {
      if (__DEV__) {
        console.warn('signUp', error.status, error.code, error.message);
      }
      return { erro: motivoCadastro(error), precisaConfirmar: false };
    }
    if (data.session && data.user) {
      await garantirPerfil(data.user);
      setPapeis(await carregarPapeis(data.user.id));
      return { erro: null, precisaConfirmar: false };
    }
    return { erro: null, precisaConfirmar: true };
  }, []);

  const recuperarSenha = useCallback(async (email: string) => {
    if (!email.trim()) {
      return { erro: 'Escreve seu e-mail primeiro que a gente manda o link.' };
    }
    // Sem redirectTo: o link abre a página /nova-senha do site (Site URL do projeto).
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    return {
      erro: error ? 'Não rolou enviar o link agora. Tenta em instantes.' : null,
    };
  }, []);

  const sair = useCallback(async () => {
    await supabase.auth.signOut();
    setVisitante(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      papeis,
      carregando,
      visitante,
      explorarSemCadastro: () => setVisitante(true),
      sairDoModoVisitante: () => setVisitante(false),
      entrar,
      criarConta,
      recuperarSenha,
      sair,
      temPapel: (p: Papel) => papeis.includes(p),
    }),
    [
      session,
      papeis,
      carregando,
      visitante,
      entrar,
      criarConta,
      recuperarSenha,
      sair,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  }
  return ctx;
}

/** Primeiro nome do metadata, como no web (fallback "entregador"). */
export function primeiroNome(user: User | null): string {
  const nome = ((user?.user_metadata?.nome as string | undefined) ?? '').trim();
  return nome.split(' ')[0] || 'entregador';
}
