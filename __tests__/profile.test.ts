import { validarPerfil } from '../src/features/profile/EditarPerfilScreen';

describe('validarPerfil', () => {
  test('exige nome completo', () => {
    expect(
      validarPerfil({
        nome: 'Ana',
        telefone: '(62) 9 9999-8888',
        cidade: 'Goiânia',
      }),
    ).toMatch(/nome completo/);
  });
});
