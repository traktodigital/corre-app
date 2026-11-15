import { motivoFiliacao } from '../src/features/admin/api';
import { cacheVencido } from '../src/features/wallet/api';
import { validarFiliacao } from '../src/features/wallet/FiliacaoScreen';

describe('validarFiliacao', () => {
  const ok = {
    associacaoId: 'assemag',
    nome: 'Ana Maria',
    cpf: '529.982.247-25',
    telefone: '(62) 9 9999-8888',
    cidade: 'Goiânia',
    aceite: true,
  };

  test('aceita dados válidos', () => {
    expect(validarFiliacao(ok)).toBeNull();
  });

  test('exige CPF válido', () => {
    expect(validarFiliacao({ ...ok, cpf: '111.111.111-11' })).toMatch(/CPF/);
  });

  test('exige aceite do estatuto', () => {
    expect(validarFiliacao({ ...ok, aceite: false })).toMatch(/estatuto/);
  });
});

describe('cache da carteirinha', () => {
  const agora = Date.parse('2026-10-17T12:00:00Z');
  const dia = 86_400_000;

  test('vale até 7 dias sem sincronizar', () => {
    expect(
      cacheVencido(
        { sincronizadoEm: new Date(agora - 7 * dia).toISOString() },
        agora,
      ),
    ).toBe(false);
    expect(
      cacheVencido(
        { sincronizadoEm: new Date(agora - 7 * dia - 1).toISOString() },
        agora,
      ),
    ).toBe(true);
  });

  test('data inválida conta como vencido', () => {
    expect(cacheVencido({ sincronizadoEm: 'lixo' }, agora)).toBe(true);
  });
});

describe('motivoFiliacao (erros das RPCs de aprovação)', () => {
  test('pedido já analisado pede recarga da fila', () => {
    expect(motivoFiliacao('filiação: pedido já analisado').recarregar).toBe(
      true,
    );
  });
  test('motivo curto não culpa a permissão', () => {
    const r = motivoFiliacao('filiação: informe o motivo da recusa');
    expect(r.recarregar).toBe(false);
    expect(r.motivo).toMatch(/pelo menos 5/);
  });
  test('sem permissão', () => {
    expect(
      motivoFiliacao('filiação: sem permissão para esta associação').motivo,
    ).toMatch(/permissão/);
  });
});
