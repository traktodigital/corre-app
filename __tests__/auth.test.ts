import { isValidPhone, maskPhone } from '../src/features/auth/domain/phone';
import {
  nameWarning,
  validateSignUp,
} from '../src/features/auth/domain/signUpRules';

describe('maskPhone (mesma regra do web)', () => {
  test.each([
    ['', ''],
    ['6', '(6'],
    ['62', '(62'],
    ['629', '(62) 9'],
    ['6299999', '(62) 9 9999'],
    ['62999998888', '(62) 9 9999-8888'],
    ['(62) 9 9999-88889999', '(62) 9 9999-8888'],
  ])('%s -> %s', (input, expected) => {
    expect(maskPhone(input)).toBe(expected);
  });

  test('isValidPhone exige 11 dígitos', () => {
    expect(isValidPhone('(62) 9 9999-8888')).toBe(true);
    expect(isValidPhone('(62) 9 9999-888')).toBe(false);
  });
});

describe('validateSignUp', () => {
  const valid = {
    name: 'Ana Maria',
    email: 'ana@email.com',
    phone: '(62) 9 9999-8888',
    password: '12345678',
    city: 'Goiânia',
  };

  test('aceita dados válidos', () => {
    expect(validateSignUp(valid)).toBeNull();
  });

  test('nome de uma palavra avisa, não bloqueia', () => {
    expect(validateSignUp({ ...valid, name: 'Ana' })).toBeNull();
    expect(nameWarning('Ana')).not.toBeNull();
    expect(nameWarning('Ana Maria')).toBeNull();
    expect(nameWarning('')).toBeNull();
  });

  test('exige telefone completo', () => {
    expect(validateSignUp({ ...valid, phone: '(62) 9 9999' })).toMatch(
      /^Telefone incompleto/,
    );
  });

  test('exige senha com 8+ caracteres', () => {
    expect(validateSignUp({ ...valid, password: '1234567' })).toBe(
      'A senha precisa de pelo menos 8 caracteres.',
    );
  });

  test('exige campos obrigatórios', () => {
    expect(validateSignUp({ ...valid, city: ' ' })).toBe(
      'Preenche todos os campos, por favor.',
    );
  });
});
