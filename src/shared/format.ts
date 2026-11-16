export function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) {
    return null;
  }
  const date = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return date.toLocaleDateString('pt-BR');
}

export function formatDateTime(iso: string | null | undefined) {
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

export function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

export function maskCpf(value: string) {
  const d = onlyDigits(value).slice(0, 11);
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

export function hideCpf(cpf: string | null | undefined) {
  if (cpf?.includes('*')) {
    return cpf;
  }
  const d = onlyDigits(cpf ?? '');
  if (d.length !== 11) {
    return '—';
  }
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

export function isValidCpf(value: string) {
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) {
    return false;
  }
  const checkDigit = (upTo: number) => {
    let sum = 0;
    for (let i = 0; i < upTo; i++) {
      sum += Number(d[i]) * (upTo + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return checkDigit(9) === Number(d[9]) && checkDigit(10) === Number(d[10]);
}

export const vehicleLabel: Record<string, string> = {
  moto: 'Moto',
  bike: 'Bike',
  carro: 'Carro',
  a_pe: 'A pé',
};
