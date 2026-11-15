export type Combustivel = 'gasolina' | 'etanol';

export function numeroBr(texto: string): number | null {
  const t = texto.trim().replace(/\s/g, '');
  if (!t) {
    return null;
  }
  const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

export function odometroDe(texto: string): number | null {
  const d = texto.replace(/\D/g, '');
  return d ? Number(d) : null;
}

export function validarInicio(d: {
  apps: string[];
  temFoto: boolean;
  combustivel: Combustivel | null;
  odometro: string;
}): string | null {
  if (d.apps.length === 0) {
    return 'Marca pelo menos um app que você vai rodar.';
  }
  if (!d.temFoto) {
    return 'Falta a foto do painel. É ela que mostra o km e o tanque.';
  }
  if (!d.combustivel) {
    return 'Gasolina ou etanol?';
  }
  const km = odometroDe(d.odometro);
  if (km === null || km > 999_999) {
    return 'Confere o km do odômetro.';
  }
  return null;
}

export function validarAbastecimento(d: {
  litros: string;
  valor: string;
  odometro: string;
  combustivel: Combustivel | null;
  temFotoOdometro: boolean;
  temFotoMarcador: boolean;
}): string | null {
  const valor = numeroBr(d.valor);
  if (valor === null || valor <= 0 || valor > 2000) {
    return 'Confere o valor pago.';
  }
  const litros = numeroBr(d.litros);
  if (litros === null || litros <= 0 || litros > 100) {
    return 'Confere quantos litros.';
  }
  if (!d.combustivel) {
    return 'Gasolina ou etanol?';
  }
  if (odometroDe(d.odometro) === null) {
    return 'Falta o km do odômetro.';
  }
  if (!d.temFotoOdometro || !d.temFotoMarcador) {
    return 'Faltam as fotos do odômetro e do marcador.';
  }
  return null;
}

export function validarEncerramento(d: {
  temFoto: boolean;
  odometroInicio: number | null;
  odometroFim: string;
  valores: { app: string; valor: string }[];
}): string | null {
  if (!d.temFoto) {
    return 'Falta a foto do painel.';
  }
  const fim = odometroDe(d.odometroFim);
  if (fim === null) {
    return 'Falta o km do odômetro.';
  }
  if (d.odometroInicio !== null) {
    if (fim < d.odometroInicio) {
      return `O odômetro não pode ser menor que na abertura (${d.odometroInicio} km).`;
    }

    if (fim - d.odometroInicio > 1500) {
      return 'Mais de 1.500 km num dia? Confere o odômetro.';
    }
  }
  for (const v of d.valores) {
    const n = numeroBr(v.valor);
    if (n === null || n < 0 || n > 5000) {
      return `Quanto o ${v.app} pagou hoje? Se não rodou nele, coloca 0.`;
    }
  }
  return null;
}

export function formatarKm(km: number | null | undefined): string {
  const v = km ?? 0;
  return `${v.toFixed(1).replace('.', ',')} km`;
}

export function duracao(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}min` : `${m}min`;
}
