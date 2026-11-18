import {
  formatDuration,
  formatKm,
  parseBrazilianNumber,
  parseOdometer,
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
