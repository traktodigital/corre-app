import { cpfValido, mascararCpf, ocultarCpf } from '../src/lib/formato';
import {
  gerarCodigo,
  hojeEmBrasilia,
  inicioDoMesEmBrasilia,
  MINUTOS_VALIDADE,
  motivoDoBanco,
  resumoDesconto,
  statusExibido,
} from '../src/features/clube/api';
import { cacheVencido } from '../src/features/carteira/api';
import { validarFiliacao } from '../src/features/carteira/FiliacaoScreen';
import { validarPerfil } from '../src/features/profile/EditarPerfilScreen';

describe('CPF', () => {
  test('máscara enquanto digita', () => {
    expect(mascararCpf('123')).toBe('123');
    expect(mascararCpf('1234')).toBe('123.4');
    expect(mascararCpf('1234567')).toBe('123.456.7');
    expect(mascararCpf('12345678901999')).toBe('123.456.789-01');
  });

  test('valida dígitos verificadores', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('529.982.247-24')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(cpfValido('123')).toBe(false);
  });

  test('carteirinha mostra só o meio', () => {
    expect(ocultarCpf('52998224725')).toBe('***.982.247-**');
    expect(ocultarCpf(null)).toBe('—');
  });
});

describe('resumoDesconto', () => {
  const base = {
    tipo: 'desconto_fixo',
    valor_desconto: null,
    preco_de: null,
    preco_por: null,
  };

  test('percentual', () => {
    expect(
      resumoDesconto({
        ...base,
        tipo: 'desconto_percentual',
        valor_desconto: 10,
      }),
    ).toBe('10% OFF');
  });

  test('preço de/por tem prioridade', () => {
    expect(resumoDesconto({ ...base, preco_de: 20, preco_por: 15 })).toMatch(
      /^De R\$\s?20,00 por R\$\s?15,00$/,
    );
  });

  test('brinde sem valor', () => {
    expect(resumoDesconto({ ...base, tipo: 'brinde' })).toBe('Brinde');
  });
});

describe('statusExibido', () => {
  const agora = new Date('2026-10-17T12:00:00Z').getTime();

  test('gerado dentro do prazo continua gerado', () => {
    const gerado_em = new Date(agora - 60_000).toISOString();
    expect(statusExibido({ status: 'gerado', gerado_em }, agora)).toBe(
      'gerado',
    );
  });

  test(`gerado há mais de ${MINUTOS_VALIDADE} min aparece vencido`, () => {
    const gerado_em = new Date(
      agora - (MINUTOS_VALIDADE + 1) * 60_000,
    ).toISOString();
    expect(statusExibido({ status: 'gerado', gerado_em }, agora)).toBe(
      'expirado',
    );
  });

  test('validado não muda', () => {
    expect(
      statusExibido({ status: 'validado', gerado_em: '2020-01-01' }, agora),
    ).toBe('validado');
  });
});

describe('motivoDoBanco (recusas do trigger corre_resgates_antes_inserir)', () => {
  test.each([
    ['oferta exclusiva de associado', 'associado'],
    ['oferta exclusiva premium', 'premium'],
    ['limite da oferta atingido', 'máximo'],
    ['oferta ainda nao comecou', 'não começou'],
    ['oferta vencida', 'acabou'],
    ['oferta fora do ar', 'não está mais no ar'],
  ])('%s', (mensagem, trecho) => {
    const r = motivoDoBanco(mensagem);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motivo).toContain(trecho);
  });

  test('rate limit de geração (trigger corre_resgates_antes_inserir)', () => {
    expect(motivoDoBanco('muitos códigos em pouco tempo')).toMatchObject({
      ok: false,
      motivo: expect.stringMatching(/1 minuto/),
    });
  });

  test('exclusiva de associado oferece a filiação', () => {
    expect(motivoDoBanco('oferta exclusiva de associado')).toMatchObject({
      precisaAssociar: true,
    });
  });
});

test('código do resgate no formato CC-XXXX sem caracteres ambíguos', () => {
  for (let i = 0; i < 50; i++) {
    expect(gerarCodigo()).toMatch(/^CC-[A-HJ-NP-Z2-9]{4}$/);
  }
});

describe('validarFiliacao', () => {
  const ok = {
    associacaoId: 'assemag',
    nome: 'Ana Maria',
    cpf: '529.982.247-25',
    telefone: '(62) 9 9999-8888',
    cidade: 'Goiânia',
    aceite: true,
  };

  test('aceita dados válidos', () => {
    expect(validarFiliacao(ok)).toBeNull();
  });

  test('exige CPF válido', () => {
    expect(validarFiliacao({ ...ok, cpf: '111.111.111-11' })).toMatch(/CPF/);
  });

  test('exige aceite do estatuto', () => {
    expect(validarFiliacao({ ...ok, aceite: false })).toMatch(/estatuto/);
  });
});

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

describe('datas em Brasília', () => {
  test('22h de Brasília ainda é o mesmo dia (UTC já virou)', () => {
    expect(hojeEmBrasilia(Date.parse('2026-10-17T01:00:00Z'))).toBe(
      '2026-10-16',
    );
    expect(hojeEmBrasilia(Date.parse('2026-10-17T03:00:00Z'))).toBe(
      '2026-10-17',
    );
  });

  test('início do mês é 00:00 de Brasília (03:00 UTC)', () => {
    expect(
      inicioDoMesEmBrasilia(Date.parse('2026-11-01T02:00:00Z')).toISOString(),
    ).toBe('2026-10-01T03:00:00.000Z');
    expect(
      inicioDoMesEmBrasilia(Date.parse('2026-11-01T03:00:00Z')).toISOString(),
    ).toBe('2026-11-01T03:00:00.000Z');
  });
});

describe('cache da carteirinha', () => {
  const agora = Date.parse('2026-10-17T12:00:00Z');
  const dia = 86_400_000;

  test('vale até 7 dias sem sincronizar', () => {
    expect(
      cacheVencido(
        { sincronizadoEm: new Date(agora - 7 * dia).toISOString() },
        agora,
      ),
    ).toBe(false);
    expect(
      cacheVencido(
        { sincronizadoEm: new Date(agora - 7 * dia - 1).toISOString() },
        agora,
      ),
    ).toBe(true);
  });

  test('data inválida conta como vencido', () => {
    expect(cacheVencido({ sincronizadoEm: 'lixo' }, agora)).toBe(true);
  });
});
