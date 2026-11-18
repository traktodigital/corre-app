import {
  appendPage,
  drawRoute,
  formatClock,
  formatDuration,
  formatKm,
  groupByMonth,
  parseBrazilianNumber,
  parseOdometer,
  parseRoute,
  trackerNeedsStart,
  validateEnd,
  validateRefuel,
  validateStart,
} from '../src/features/trip/domain';

describe('jornada: parse de número brasileiro', () => {
  it('aceita vírgula, ponto e milhar', () => {
    expect(parseBrazilianNumber('12,50')).toBe(12.5);
    expect(parseBrazilianNumber('12.50')).toBe(12.5);
    expect(parseBrazilianNumber('1.234,5')).toBe(1234.5);
    expect(parseBrazilianNumber(' 30 ')).toBe(30);
    expect(parseBrazilianNumber('')).toBeNull();
    expect(parseBrazilianNumber('abc')).toBeNull();
  });
  it('odômetro ignora ponto e espaço', () => {
    expect(parseOdometer('23.450')).toBe(23450);
    expect(parseOdometer('')).toBeNull();
  });
});

describe('jornada: abertura', () => {
  const ok = {
    appIds: ['ifood'],
    hasPhoto: true,
    fuel: 'gasoline' as const,
    odometer: '23450',
  };
  it('pede app, foto, combustível e odômetro', () => {
    expect(validateStart(ok)).toBeNull();
    expect(validateStart({ ...ok, appIds: [] })).toMatch(/app/);
    expect(validateStart({ ...ok, hasPhoto: false })).toMatch(/foto/);
    expect(validateStart({ ...ok, fuel: null })).toMatch(/Gasolina/);
    expect(validateStart({ ...ok, odometer: '' })).toMatch(/odômetro/);
  });
});

describe('jornada: abastecimento', () => {
  const ok = {
    liters: '5,12',
    price: '30,00',
    odometer: '23500',
    fuel: 'ethanol' as const,
    hasOdometerPhoto: true,
    hasGaugePhoto: true,
  };
  it('valida como os CHECKs do banco', () => {
    expect(validateRefuel(ok)).toBeNull();
    expect(validateRefuel({ ...ok, price: '0' })).toMatch(/valor/);
    expect(validateRefuel({ ...ok, price: '2500' })).toMatch(/valor/);
    expect(validateRefuel({ ...ok, liters: '150' })).toMatch(/litros/);
    expect(validateRefuel({ ...ok, hasGaugePhoto: false })).toMatch(/fotos/);
  });
});

describe('jornada: encerramento', () => {
  const ok = {
    hasPhoto: true,
    startOdometer: 23450,
    endOdometer: '23562',
    earnings: [
      { app: 'iFood', amount: '120,00' },
      { app: '99', amount: '0' },
    ],
  };
  it('aceita app sem ganho (0) e barra odômetro voltando ou absurdo', () => {
    expect(validateEnd(ok)).toBeNull();
    expect(validateEnd({ ...ok, endOdometer: '23000' })).toMatch(/menor/);
    expect(validateEnd({ ...ok, endOdometer: '30000' })).toMatch(/1\.500/);
    expect(
      validateEnd({ ...ok, earnings: [{ app: 'iFood', amount: '' }] }),
    ).toMatch(/iFood/);
  });
});

describe('jornada: formatação', () => {
  it('km e duração', () => {
    expect(formatKm(42.36)).toBe('42,4 km');
    expect(formatKm(null)).toBe('0,0 km');
    expect(formatDuration(72 * 60_000)).toBe('1h 12min');
    expect(formatDuration(5 * 60_000)).toBe('5min');
  });
});

describe('jornada: religar o GPS quando o serviço morreu', () => {
  it('liga quando não há estado, está parado ou é de outra jornada', () => {
    expect(trackerNeedsStart('j1', null)).toBe(true);
    expect(trackerNeedsStart('j1', { active: false, tripId: 'j1' })).toBe(true);
    expect(trackerNeedsStart('j1', { active: true, tripId: 'j0' })).toBe(true);
  });

  it('não mexe quando o serviço já está contando a jornada certa', () => {
    expect(trackerNeedsStart('j1', { active: true, tripId: 'j1' })).toBe(false);
  });
});

describe('jornada: trajeto no resumo', () => {
  const csv =
    '1763432400000,-16.686900,-49.264800,12\n' +
    'lixo\n' +
    '\n' +
    '1763432405000,-16.687900,-49.264800,8\n' +
    '1763432410000,-16.687900,-49.262800,9\n';

  it('lê o CSV e ignora linhas ruins', () => {
    expect(parseRoute(csv)).toEqual([
      { lat: -16.6869, lng: -49.2648 },
      { lat: -16.6879, lng: -49.2648 },
      { lat: -16.6879, lng: -49.2628 },
    ]);
  });

  it('desenha dentro da caixa, do início ao fim', () => {
    const drawing = drawRoute(parseRoute(csv), 300, 200, 20)!;
    expect(drawing.d.startsWith('M')).toBe(true);
    expect(drawing.d.match(/L/g)).toHaveLength(2);
    const [sx, sy] = drawing.start;
    const [ex, ey] = drawing.end;
    for (const v of [sx, ex]) {
      expect(v).toBeGreaterThanOrEqual(20);
      expect(v).toBeLessThanOrEqual(280);
    }
    for (const v of [sy, ey]) {
      expect(v).toBeGreaterThanOrEqual(20);
      expect(v).toBeLessThanOrEqual(180);
    }
    expect(sy).toBeLessThan(ey);
    expect(ex).toBeGreaterThan(sx);
  });

  it('sem trajeto não desenha', () => {
    expect(drawRoute([], 300, 200)).toBeNull();
    expect(drawRoute([{ lat: 1, lng: 1 }], 300, 200)).toBeNull();
    expect(
      drawRoute(
        [
          { lat: 1, lng: 1 },
          { lat: 1, lng: 1 },
        ],
        300,
        200,
      ),
    ).toBeNull();
  });

  it('relógio da jornada', () => {
    expect(formatClock(5.7)).toBe('5:42');
    expect(formatClock(0.94)).toBe('0:56');
  });
});

describe('jornada: histórico', () => {
  it('agrupa por mês na ordem que veio, mais recente primeiro', () => {
    const groups = groupByMonth([
      { id: 'c', startedAt: '2026-11-18T15:00:00-03:00' },
      { id: 'b', startedAt: '2026-11-02T15:00:00-03:00' },
      { id: 'a', startedAt: '2026-10-30T15:00:00-03:00' },
    ]);
    expect(groups.map(g => g.items.map(i => i.id))).toEqual([
      ['c', 'b'],
      ['a'],
    ]);
    expect(groups[0].month.charAt(0)).toBe(
      groups[0].month.charAt(0).toUpperCase(),
    );
  });
});

describe('jornada: páginas do histórico', () => {
  it('junta a próxima página sem repetir jornada', () => {
    const first = [{ id: 'a' }, { id: 'b' }];
    expect(appendPage(first, [{ id: 'b' }, { id: 'c' }])).toEqual([
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
    ]);
    expect(appendPage([], first)).toEqual(first);
  });
});
