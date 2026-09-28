import {
  mascararTelefone,
  telefoneValido,
} from '../src/features/auth/telefone';
import { validarCadastro } from '../src/features/auth/SignupScreen';

describe('mascararTelefone (mesma regra do web)', () => {
  test.each([
    ['', ''],
    ['6', '(6'],
    ['62', '(62'],
    ['629', '(62) 9'],
    ['6299999', '(62) 9 9999'],
    ['62999998888', '(62) 9 9999-8888'],
    ['(62) 9 9999-88889999', '(62) 9 9999-8888'],
  ])('%s -> %s', (entrada, saida) => {
    expect(mascararTelefone(entrada)).toBe(saida);
  });

  test('telefoneValido exige 11 dígitos', () => {
    expect(telefoneValido('(62) 9 9999-8888')).toBe(true);
    expect(telefoneValido('(62) 9 9999-888')).toBe(false);
  });
});

describe('validarCadastro', () => {
  const ok = {
    nome: 'Ana Maria',
    email: 'ana@email.com',
    telefone: '(62) 9 9999-8888',
    senha: '123456',
    cidade: 'Goiânia',
  };

  test('aceita dados válidos', () => {
    expect(validarCadastro(ok)).toBeNull();
  });

  test('exige nome completo', () => {
    expect(validarCadastro({ ...ok, nome: 'Ana' })).toBe(
      'Escreve seu nome completo, por favor.',
    );
  });

  test('exige telefone completo', () => {
    expect(validarCadastro({ ...ok, telefone: '(62) 9 9999' })).toMatch(
      /^Telefone incompleto/,
    );
  });

  test('exige senha com 6+ caracteres', () => {
    expect(validarCadastro({ ...ok, senha: '12345' })).toBe(
      'A senha precisa de pelo menos 6 caracteres.',
    );
  });

  test('exige campos obrigatórios', () => {
    expect(validarCadastro({ ...ok, cidade: ' ' })).toBe(
      'Preenche todos os campos, por favor.',
    );
  });
});
