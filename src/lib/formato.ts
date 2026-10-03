/** Formatação pt-BR usada nas telas (mesmas regras do web). */

export function formatarReal(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Aceita data pura ("2026-10-17") ou ISO com hora. */
export function formatarData(iso: string | null | undefined) {
  if (!iso) {
    return null;
  }
  const data = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return data.toLocaleDateString('pt-BR');
}

export function formatarDataHora(iso: string | null | undefined) {
  if (!iso) {
    return null;
  }
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function soDigitos(v: string) {
  return v.replace(/\D/g, '');
}

/** "12345678901" -> "123.456.789-01" enquanto digita. */
export function mascararCpf(v: string) {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 3) {
    return d;
  }
  if (d.length <= 6) {
    return `${d.slice(0, 3)}.${d.slice(3)}`;
  }
  if (d.length <= 9) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  }
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Na carteirinha o CPF aparece só pela metade. */
export function ocultarCpf(cpf: string | null | undefined) {
  const d = soDigitos(cpf ?? '');
  if (d.length !== 11) {
    return '—';
  }
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

/** Validação oficial dos dígitos verificadores. */
export function cpfValido(v: string) {
  const d = soDigitos(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) {
    return false;
  }
  const digito = (ate: number) => {
    let soma = 0;
    for (let i = 0; i < ate; i++) {
      soma += Number(d[i]) * (ate + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

export const rotuloVeiculo: Record<string, string> = {
  moto: 'Moto',
  bike: 'Bike',
  carro: 'Carro',
  a_pe: 'A pé',
};
