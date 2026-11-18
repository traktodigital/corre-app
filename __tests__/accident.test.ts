import {
  maskDate,
  threeBMessage,
  threeBWhatsappUrl,
  validateAccidentDate,
  type AccidentReport,
} from '../src/features/accident/domain';

const sender = {
  name: 'José da Silva',
  cpf: '12345678909',
  phone: '(62) 9 5656-5656',
  email: 'jose@exemplo.com',
};

const full: AccidentReport = {
  date: '24/10/2026',
  working: 'yes',
  fracture: 'unknown',
  apps: ['99', 'iFood'],
  includeCpf: true,
};

describe('3B: mensagem do WhatsApp no formato pedido pela 3B', () => {
  it('leva todas as respostas', () => {
    const text = threeBMessage(full, sender);
    expect(text).toMatch(/^Olá, vim do app Corre!/);
    expect(text).toContain('Nome completo: José da Silva');
    expect(text).toContain('CPF: 123.456.789-09');
    expect(text).toContain('Telefone: 62956565656');
    expect(text).toContain('Email: jose@exemplo.com');
    expect(text).toContain('Data do acidente: 24/10/2026');
    expect(text).toContain('Estava em corrida? Sim');
    expect(text).toContain('Lesões: Não sei');
    expect(text).toContain('Aplicativo: 99, iFood');
  });

  it('CPF só vai se o entregador marcar', () => {
    expect(threeBMessage({ ...full, includeCpf: false }, sender)).not.toContain(
      'CPF',
    );
  });

  it('nada é obrigatório: o que ficou em branco vai como não informado', () => {
    const text = threeBMessage(
      { date: null, working: null, fracture: null, apps: [], includeCpf: true },
      { name: '', cpf: null, phone: null, email: null },
    );
    expect(text).not.toContain('CPF');
    expect(text.match(/não informado/g)).toHaveLength(7);
  });

  it('link do WhatsApp da 3B com o texto codificado', () => {
    expect(threeBWhatsappUrl('a\nb')).toBe(
      'https://wa.me/5562991797653?text=a%0Ab',
    );
  });
});

describe('3B: data do acidente', () => {
  const now = new Date('2026-11-17T15:00:00Z');

  it('máscara dd/mm/aaaa', () => {
    expect(maskDate('24102026')).toBe('24/10/2026');
    expect(maskDate('241')).toBe('24/1');
  });

  it.each([
    ['', null],
    ['24/10/2026', null],
    ['24/10', 'incompleta'],
    ['31/02/2026', 'não existe'],
    ['18/11/2026', 'futuro'],
  ])('%s', (value, fragment) => {
    const result = validateAccidentDate(value, now);
    if (fragment === null) {
      expect(result).toBeNull();
    } else {
      expect(result).toContain(fragment);
    }
  });
});
