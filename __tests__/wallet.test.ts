import { parseReviewError } from '../src/features/admin/domain';
import {
  isCacheExpired,
  validateMembershipRequest,
} from '../src/features/wallet/domain';

describe('validateMembershipRequest', () => {
  const ok = {
    associationId: 'assemag',
    name: 'Ana Maria',
    cpf: '529.982.247-25',
    phone: '(62) 9 9999-8888',
    city: 'Goiânia',
    acceptedBylaws: true,
  };

  test('aceita dados válidos', () => {
    expect(validateMembershipRequest(ok)).toBeNull();
  });

  test('exige CPF válido', () => {
    expect(validateMembershipRequest({ ...ok, cpf: '111.111.111-11' })).toMatch(
      /CPF/,
    );
  });

  test('exige aceite do estatuto', () => {
    expect(validateMembershipRequest({ ...ok, acceptedBylaws: false })).toMatch(
      /estatuto/,
    );
  });
});

describe('cache da carteirinha', () => {
  const now = Date.parse('2026-10-17T12:00:00Z');
  const day = 86_400_000;

  test('vale até 7 dias sem sincronizar', () => {
    expect(
      isCacheExpired({ syncedAt: new Date(now - 7 * day).toISOString() }, now),
    ).toBe(false);
    expect(
      isCacheExpired(
        { syncedAt: new Date(now - 7 * day - 1).toISOString() },
        now,
      ),
    ).toBe(true);
  });

  test('data inválida conta como vencido', () => {
    expect(isCacheExpired({ syncedAt: 'lixo' }, now)).toBe(true);
  });
});

describe('parseReviewError (erros das RPCs de aprovação)', () => {
  test('pedido já analisado pede recarga da fila', () => {
    expect(parseReviewError('filiação: pedido já analisado').reload).toBe(true);
  });
  test('motivo curto não culpa a permissão', () => {
    const r = parseReviewError('filiação: informe o motivo da recusa');
    expect(r.reload).toBe(false);
    expect(r.reason).toMatch(/pelo menos 5/);
  });
  test('sem permissão', () => {
    expect(
      parseReviewError('filiação: sem permissão para esta associação').reason,
    ).toMatch(/permissão/);
  });
});
