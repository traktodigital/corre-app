import {
  duracao,
  formatarKm,
  numeroBr,
  odometroDe,
  validarAbastecimento,
  validarEncerramento,
  validarInicio,
} from '../src/features/trip/regras';

describe('jornada: parse de número brasileiro', () => {
  it('aceita vírgula, ponto e milhar', () => {
    expect(numeroBr('12,50')).toBe(12.5);
    expect(numeroBr('12.50')).toBe(12.5);
    expect(numeroBr('1.234,5')).toBe(1234.5);
    expect(numeroBr(' 30 ')).toBe(30);
    expect(numeroBr('')).toBeNull();
    expect(numeroBr('abc')).toBeNull();
  });
  it('odômetro ignora ponto e espaço', () => {
    expect(odometroDe('23.450')).toBe(23450);
    expect(odometroDe('')).toBeNull();
  });
});

describe('jornada: abertura', () => {
  const ok = {
    apps: ['ifood'],
    temFoto: true,
    combustivel: 'gasolina' as const,
    odometro: '23450',
  };
  it('pede app, foto, combustível e odômetro', () => {
    expect(validarInicio(ok)).toBeNull();
    expect(validarInicio({ ...ok, apps: [] })).toMatch(/app/);
    expect(validarInicio({ ...ok, temFoto: false })).toMatch(/foto/);
    expect(validarInicio({ ...ok, combustivel: null })).toMatch(/Gasolina/);
    expect(validarInicio({ ...ok, odometro: '' })).toMatch(/odômetro/);
  });
});

describe('jornada: abastecimento', () => {
  const ok = {
    litros: '5,12',
    valor: '30,00',
    odometro: '23500',
    combustivel: 'etanol' as const,
    temFotoOdometro: true,
    temFotoMarcador: true,
  };
  it('valida como os CHECKs do banco', () => {
    expect(validarAbastecimento(ok)).toBeNull();
    expect(validarAbastecimento({ ...ok, valor: '0' })).toMatch(/valor/);
    expect(validarAbastecimento({ ...ok, valor: '2500' })).toMatch(/valor/);
    expect(validarAbastecimento({ ...ok, litros: '150' })).toMatch(/litros/);
    expect(validarAbastecimento({ ...ok, temFotoMarcador: false })).toMatch(
      /fotos/,
    );
  });
});

describe('jornada: encerramento', () => {
  const ok = {
    temFoto: true,
    odometroInicio: 23450,
    odometroFim: '23562',
    valores: [
      { app: 'iFood', valor: '120,00' },
      { app: '99', valor: '0' },
    ],
  };
  it('aceita app sem ganho (0) e barra odômetro voltando ou absurdo', () => {
    expect(validarEncerramento(ok)).toBeNull();
    expect(validarEncerramento({ ...ok, odometroFim: '23000' })).toMatch(
      /menor/,
    );
    expect(validarEncerramento({ ...ok, odometroFim: '30000' })).toMatch(
      /1\.500/,
    );
    expect(
      validarEncerramento({ ...ok, valores: [{ app: 'iFood', valor: '' }] }),
    ).toMatch(/iFood/);
  });
});

describe('jornada: formatação', () => {
  it('km e duração', () => {
    expect(formatarKm(42.36)).toBe('42,4 km');
    expect(formatarKm(null)).toBe('0,0 km');
    expect(duracao(72 * 60_000)).toBe('1h 12min');
    expect(duracao(5 * 60_000)).toBe('5min');
  });
});
