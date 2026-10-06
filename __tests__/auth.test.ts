import {
  mascararTelefone,
  telefoneValido,
} from '../src/features/auth/telefone';
import { avisoNome, validarCadastro } from '../src/features/auth/SignupScreen';

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
    senha: '12345678',
    cidade: 'Goiânia',
  };

  test('aceita dados válidos', () => {
    expect(validarCadastro(ok)).toBeNull();
  });

  test('nome de uma palavra avisa, não bloqueia', () => {
    expect(validarCadastro({ ...ok, nome: 'Ana' })).toBeNull();
    expect(avisoNome('Ana')).not.toBeNull();
    expect(avisoNome('Ana Maria')).toBeNull();
    expect(avisoNome('')).toBeNull();
  });

  test('exige telefone completo', () => {
    expect(validarCadastro({ ...ok, telefone: '(62) 9 9999' })).toMatch(
      /^Telefone incompleto/,
    );
  });

  test('exige senha com 8+ caracteres', () => {
    expect(validarCadastro({ ...ok, senha: '1234567' })).toBe(
      'A senha precisa de pelo menos 8 caracteres.',
    );
  });

  test('exige campos obrigatórios', () => {
    expect(validarCadastro({ ...ok, cidade: ' ' })).toBe(
      'Preenche todos os campos, por favor.',
    );
  });
});
