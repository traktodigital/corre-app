import {
  discountSummary,
  displayedStatus,
  generateRedemptionCode,
  REDEMPTION_VALIDITY_MINUTES,
  refusalFromDbMessage,
  type OfferPricing,
} from '../src/features/club/domain';
import {
  toOfferKind,
  toRedemptionSummary,
} from '../src/features/club/data/mappers';

describe('discountSummary', () => {
  const base: OfferPricing = {
    kind: 'fixedDiscount',
    discountValue: null,
    priceFrom: null,
    priceTo: null,
  };

  test('percentual', () => {
    expect(
      discountSummary({
        ...base,
        kind: 'percentDiscount',
        discountValue: 10,
      }),
    ).toBe('10% OFF');
  });

  test('preço de/por tem prioridade', () => {
    expect(discountSummary({ ...base, priceFrom: 20, priceTo: 15 })).toMatch(
      /^De R\$\s?20,00 por R\$\s?15,00$/,
    );
  });

  test('brinde sem valor', () => {
    expect(discountSummary({ ...base, kind: 'gift' })).toBe('Brinde');
  });
});

describe('displayedStatus', () => {
  const now = new Date('2026-10-17T12:00:00Z').getTime();

  test('gerado dentro do prazo continua gerado', () => {
    const generatedAt = new Date(now - 60_000).toISOString();
    expect(displayedStatus({ status: 'generated', generatedAt }, now)).toBe(
      'generated',
    );
  });

  test(`gerado há mais de ${REDEMPTION_VALIDITY_MINUTES} min aparece vencido`, () => {
    const generatedAt = new Date(
      now - (REDEMPTION_VALIDITY_MINUTES + 1) * 60_000,
    ).toISOString();
    expect(displayedStatus({ status: 'generated', generatedAt }, now)).toBe(
      'expired',
    );
  });

  test('validado não muda', () => {
    expect(
      displayedStatus({ status: 'validated', generatedAt: '2020-01-01' }, now),
    ).toBe('validated');
  });
});

describe('refusalFromDbMessage (recusas do trigger corre_resgates_antes_inserir)', () => {
  test.each([
    ['oferta exclusiva de associado', 'associado'],
    ['oferta exclusiva premium', 'premium'],
    ['limite da oferta atingido', 'máximo'],
    ['oferta ainda nao comecou', 'não começou'],
    ['oferta vencida', 'acabou'],
    ['oferta fora do ar', 'não está mais no ar'],
  ])('%s', (message, fragment) => {
    const r = refusalFromDbMessage(message);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain(fragment);
  });

  test('rate limit de geração (trigger corre_resgates_antes_inserir)', () => {
    expect(refusalFromDbMessage('muitos códigos em pouco tempo')).toMatchObject(
      {
        ok: false,
        reason: expect.stringMatching(/1 minuto/),
      },
    );
  });

  test('exclusiva de associado oferece a filiação', () => {
    expect(refusalFromDbMessage('oferta exclusiva de associado')).toMatchObject(
      {
        requiresMembership: true,
      },
    );
  });
});

test('código do resgate no formato CC-XXXX sem caracteres ambíguos', () => {
  for (let i = 0; i < 50; i++) {
    expect(generateRedemptionCode()).toMatch(/^CC-[A-HJ-NP-Z2-9]{4}$/);
  }
});

describe('mapeamento das linhas do banco (PT) para o domínio (EN)', () => {
  test('tipo da oferta', () => {
    expect(toOfferKind('desconto_percentual')).toBe('percentDiscount');
    expect(toOfferKind('cashback')).toBe('cashback');
    expect(toOfferKind('brinde')).toBe('gift');
    expect(toOfferKind('desconto_fixo')).toBe('fixedDiscount');
  });

  test.each([
    ['gerado', 'generated'],
    ['validado', 'validated'],
    ['expirado', 'expired'],
    ['cancelado', 'cancelled'],
  ] as const)('status %s → %s', (row, status) => {
    expect(
      toRedemptionSummary({
        id: 'r1',
        codigo: 'CC-AB12',
        status: row,
        gerado_em: '2026-10-17T12:00:00Z',
        validado_em: null,
        valor_economizado: '12.5',
        oferta: { titulo: 'Lavagem' },
        parceiro: { nome_fantasia: 'Lava Jato' },
      }),
    ).toEqual({
      id: 'r1',
      code: 'CC-AB12',
      status,
      generatedAt: '2026-10-17T12:00:00Z',
      validatedAt: null,
      savedAmount: 12.5,
      offer: { title: 'Lavagem' },
      partner: { name: 'Lava Jato' },
    });
  });
});
