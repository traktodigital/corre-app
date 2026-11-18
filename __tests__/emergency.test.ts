import {
  emergencyMessage,
  mapsLink,
  smsUrl,
  validateContact,
  whatsappUrl,
} from '../src/features/emergency/domain';

const at = new Date('2026-11-17T21:05:00Z');

describe('emergência: mensagem pro contato', () => {
  it('leva nome, hora de Brasília e o link da localização', () => {
    const text = emergencyMessage('Diogo', { lat: -16.68, lng: -49.25 }, at);
    expect(text).toContain('Aqui é Diogo.');
    expect(text).toContain('às 18:05');
    expect(text).toContain('https://maps.google.com/?q=-16.680000,-49.250000');
    expect(text).toContain('192 (SAMU)');
  });

  it('sem localização avisa e não inventa link', () => {
    const text = emergencyMessage('', null, at);
    expect(text).toContain('Não consegui pegar minha localização.');
    expect(text).not.toContain('maps.google.com');
    expect(text).not.toContain('Aqui é');
  });
});

describe('emergência: links que abrem no próprio celular', () => {
  it('WhatsApp com DDI 55 e texto codificado', () => {
    expect(whatsappUrl('(62) 9 9999-0000', 'oi & tchau')).toBe(
      'https://wa.me/5562999990000?text=oi%20%26%20tchau',
    );
  });

  it('SMS usa ? no Android e & no iOS', () => {
    expect(smsUrl('62999990000', 'a', 'android')).toBe(
      'sms:+5562999990000?body=a',
    );
    expect(smsUrl('62999990000', 'a', 'ios')).toBe('sms:+5562999990000&body=a');
  });

  it('link do mapa com 6 casas', () => {
    expect(mapsLink({ lat: -16.6799999, lng: -49.25 })).toBe(
      'https://maps.google.com/?q=-16.680000,-49.250000',
    );
  });
});

describe('emergência: contato', () => {
  it.each([
    [{ name: '', phone: '62999990000' }, 'nome'],
    [{ name: 'Mãe', phone: '9999' }, 'DDD'],
    [{ name: 'Mãe', phone: '629999900001' }, 'DDD'],
  ])('recusa %j', (contact, fragment) => {
    expect(validateContact(contact)).toContain(fragment);
  });

  it('aceita fixo (10) e celular (11) com máscara', () => {
    expect(
      validateContact({ name: 'Mãe', phone: '(62) 3333-4444' }),
    ).toBeNull();
    expect(
      validateContact({ name: 'Mãe', phone: '(62) 9 9999-0000' }),
    ).toBeNull();
  });
});
