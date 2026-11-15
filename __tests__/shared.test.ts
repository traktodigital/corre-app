import { hideCpf, isValidCpf, maskCpf } from '../src/shared/format';
import { startOfMonthInBrasilia, todayInBrasilia } from '../src/shared/date';

describe('CPF', () => {
  test('máscara enquanto digita', () => {
    expect(maskCpf('123')).toBe('123');
    expect(maskCpf('1234')).toBe('123.4');
    expect(maskCpf('1234567')).toBe('123.456.7');
    expect(maskCpf('12345678901999')).toBe('123.456.789-01');
  });

  test('valida dígitos verificadores', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('529.982.247-24')).toBe(false);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('123')).toBe(false);
  });

  test('carteirinha mostra só o meio', () => {
    expect(hideCpf('52998224725')).toBe('***.982.247-**');
    expect(hideCpf(null)).toBe('—');
  });
});

describe('datas em Brasília', () => {
  test('22h de Brasília ainda é o mesmo dia (UTC já virou)', () => {
    expect(todayInBrasilia(Date.parse('2026-10-17T01:00:00Z'))).toBe(
      '2026-10-16',
    );
    expect(todayInBrasilia(Date.parse('2026-10-17T03:00:00Z'))).toBe(
      '2026-10-17',
    );
  });

  test('início do mês é 00:00 de Brasília (03:00 UTC)', () => {
    expect(
      startOfMonthInBrasilia(Date.parse('2026-11-01T02:00:00Z')).toISOString(),
    ).toBe('2026-10-01T03:00:00.000Z');
    expect(
      startOfMonthInBrasilia(Date.parse('2026-11-01T03:00:00Z')).toISOString(),
    ).toBe('2026-11-01T03:00:00.000Z');
  });
});

describe('CPF mascarado no cache offline', () => {
  test('hideCpf não estraga um CPF que já está mascarado', () => {
    const hidden = hideCpf('52998224725');
    expect(hidden).toBe('***.982.247-**');
    expect(hideCpf(hidden)).toBe(hidden);
  });
});
