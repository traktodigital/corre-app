import { validateProfile } from '../src/features/profile/domain/validation';

describe('validateProfile', () => {
  test('exige nome completo', () => {
    expect(
      validateProfile({
        name: 'Ana',
        phone: '(62) 9 9999-8888',
        city: 'Goiânia',
      }),
    ).toMatch(/nome completo/);
  });
});
