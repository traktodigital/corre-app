import {
  clearQueryCache,
  isFresh,
  readCache,
  STALE,
  writeCache,
} from '../src/shared/hooks/queryCache';

describe('cache de consultas', () => {
  beforeEach(() => clearQueryCache());

  it('guarda o último dado e diz se ainda está fresco', () => {
    writeCache('apps', ['ifood'], 1_000);
    expect(readCache<string[]>('apps')?.data).toEqual(['ifood']);
    expect(isFresh('apps', STALE.catalog, 1_000 + STALE.catalog - 1)).toBe(
      true,
    );
    expect(isFresh('apps', STALE.catalog, 1_000 + STALE.catalog)).toBe(false);
  });

  it('sempre revalida no padrão e nunca expira o imutável', () => {
    writeCache('rota', [], 1_000);
    expect(isFresh('rota', STALE.always, 1_000)).toBe(false);
    expect(isFresh('rota', STALE.immutable, 10 ** 12)).toBe(true);
    expect(isFresh('outra', STALE.immutable)).toBe(false);
  });

  it('limpa tudo ao sair da conta', () => {
    writeCache('perfil:1', { nome: 'x' });
    clearQueryCache();
    expect(readCache('perfil:1')).toBeUndefined();
  });
});
