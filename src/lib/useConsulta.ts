import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

export type Consulta<T> = {
  dados: T | undefined;
  carregando: boolean;
  erro: boolean;
  /** Busca de novo; `silencioso` não pisca o skeleton (pull-to-refresh, polling). */
  recarregar: (silencioso?: boolean) => Promise<void>;
};

type Estado<T> = {
  /** Chave a que este resultado pertence. */
  chave: string | null;
  dados: T | undefined;
  erro: boolean;
  carregando: boolean;
};

/**
 * Busca simples com estado de carregando/erro, no lugar do react-query do web.
 * - `chave` nula desliga a consulta (ex.: sem usuário logado).
 * - Recarrega sempre que a tela volta ao foco (voltar de um resgate atualiza a economia).
 * - `intervaloMs` faz polling enquanto a tela estiver montada.
 *
 * O resultado guarda a chave de origem: trocou a chave, o que era da anterior
 * some no mesmo render (nada de dados do usuário antigo por um frame). Cada
 * busca é numerada e só a mais recente escreve — foco, polling e
 * pull-to-refresh podem responder fora de ordem.
 */
export function useConsulta<T>(
  chave: string | null,
  buscar: () => Promise<T>,
  opcoes: { intervaloMs?: number } = {},
): Consulta<T> {
  const [estado, setEstado] = useState<Estado<T>>({
    chave,
    dados: undefined,
    erro: false,
    carregando: chave !== null,
  });
  const buscarRef = useRef(buscar);
  buscarRef.current = buscar;
  const chaveRef = useRef(chave);
  chaveRef.current = chave;
  const ultimaBusca = useRef(0);

  const recarregar = useCallback(async (silencioso = false) => {
    const chaveDaBusca = chaveRef.current;
    if (chaveDaBusca === null) {
      return;
    }
    const numero = ++ultimaBusca.current;
    if (!silencioso) {
      setEstado(e =>
        e.chave === chaveDaBusca
          ? { ...e, carregando: true }
          : {
              chave: chaveDaBusca,
              dados: undefined,
              erro: false,
              carregando: true,
            },
      );
    }
    let resultado: { ok: true; dados: T } | { ok: false };
    try {
      resultado = { ok: true, dados: await buscarRef.current() };
    } catch {
      resultado = { ok: false };
    }
    if (numero !== ultimaBusca.current || chaveRef.current !== chaveDaBusca) {
      return; // chegou uma busca mais nova, ou a chave mudou no meio do caminho
    }
    setEstado(e => {
      const mesma = e.chave === chaveDaBusca;
      return resultado.ok
        ? {
            chave: chaveDaBusca,
            dados: resultado.dados,
            erro: false,
            carregando: false,
          }
        : {
            chave: chaveDaBusca,
            dados: mesma ? e.dados : undefined,
            erro: true,
            carregando: false,
          };
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      recarregar(true);
    }, [recarregar, chave]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  const { intervaloMs } = opcoes;
  useEffect(() => {
    if (!intervaloMs || chave === null) {
      return;
    }
    const id = setInterval(() => recarregar(true), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs, chave, recarregar]);

  // Resultado de outra chave não vale: trata como "ainda carregando".
  const atual = estado.chave === chave;
  const dados = atual ? estado.dados : undefined;
  const carregandoAgora =
    chave !== null && (atual ? estado.carregando : true) && dados === undefined;

  return {
    dados,
    carregando: carregandoAgora,
    erro: atual && estado.erro,
    recarregar,
  };
}
