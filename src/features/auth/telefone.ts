/** Máscara do web (src/lib/auth.tsx): (DD) D DDDD-DDDD, até 11 dígitos. */
export function mascararTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) {
    return '';
  }
  if (d.length <= 2) {
    return `(${d}`;
  }
  if (d.length <= 3) {
    return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  }
  if (d.length <= 7) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3)}`;
  }
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
}

export function telefoneValido(valor: string): boolean {
  return valor.replace(/\D/g, '').length === 11;
}
