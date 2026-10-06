import { supabase } from '../../lib/supabase';

/**
 * Consultas do clube de benefícios — mesmas do web (goias-delivery-link/src/lib/clube.ts).
 * A RLS já filtra: visitante só enxerga parceiro `ativo` e oferta `ativa`.
 */

export type Categoria = { id: string; nome: string; icone: string };

export type ParceiroResumo = {
  id: string;
  nome_fantasia: string;
  bairro: string | null;
  cidade: string | null;
  logo_url: string | null;
  nota_media: number | null;
  categoria: Categoria | null;
};

export type Parceiro = ParceiroResumo & {
  descricao: string | null;
  endereco: string | null;
  uf: string | null;
  telefone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  horario_funcionamento: string | null;
};

export type Oferta = {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  valor_desconto: number | null;
  preco_de: number | null;
  preco_por: number | null;
  regras?: string | null;
  exclusivo_associados: boolean;
  exclusivo_premium: boolean;
  destaque?: boolean;
  validade_inicio?: string | null;
  validade_fim: string | null;
  parceiro_id: string;
  parceiro?: {
    id: string;
    nome_fantasia: string;
    cidade: string | null;
  } | null;
};

export type StatusResgate = 'gerado' | 'validado' | 'expirado' | 'cancelado';

export type Resgate = {
  id: string;
  codigo: string;
  qr_token: string;
  gerado_em: string;
  validado_em: string | null;
  status: StatusResgate;
  valor_economizado: number | null;
  oferta: { id: string; titulo: string; regras: string | null } | null;
  parceiro: { id: string; nome_fantasia: string } | null;
};

export type ResgateResumo = Pick<
  Resgate,
  'id' | 'codigo' | 'status' | 'gerado_em' | 'validado_em' | 'valor_economizado'
> & {
  oferta: { titulo: string } | null;
  parceiro: { nome_fantasia: string } | null;
};

/** Um resgate vale 15 minutos — depois disso o código não abre mais. */
export const MINUTOS_VALIDADE = 15;

const CAMPOS_OFERTA =
  'id, titulo, descricao, tipo, valor_desconto, preco_de, preco_por, exclusivo_associados, exclusivo_premium, destaque, validade_fim, parceiro_id';

export async function listarCategorias(): Promise<Categoria[]> {
  const { data, error } = await supabase
    .from('categorias')
    .select('id, nome, icone')
    .eq('ativa', true)
    .order('ordem');
  if (error) {
    throw error;
  }
  return data ?? [];
}

export async function listarParceiros(): Promise<ParceiroResumo[]> {
  // TODO(fase-1.1): paginação com "carregar mais" (o web usa lotes de 20).
  const { data, error } = await supabase
    .from('parceiros')
    .select(
      'id, nome_fantasia, bairro, cidade, logo_url, nota_media, categoria:categorias(id, nome, icone)',
    )
    .eq('status', 'ativo')
    .order('nota_media', { ascending: false })
    .limit(100);
  if (error) {
    throw error;
  }
  return (data ?? []) as unknown as ParceiroResumo[];
}

export async function listarOfertasDestaque(): Promise<Oferta[]> {
  const { data, error } = await supabase
    .from('ofertas')
    .select(
      `${CAMPOS_OFERTA}, parceiro:parceiros!inner(id, nome_fantasia, cidade, status)`,
    )
    .eq('destaque', true)
    .eq('status', 'ativa')
    .eq('parceiros.status', 'ativo')
    .limit(6);
  if (error) {
    throw error;
  }
  return (data ?? []) as unknown as Oferta[];
}

export async function buscarParceiro(id: string): Promise<Parceiro | null> {
  const { data, error } = await supabase
    .from('parceiros')
    .select(
      'id, nome_fantasia, descricao, logo_url, endereco, bairro, cidade, uf, telefone, whatsapp, instagram, horario_funcionamento, nota_media, categoria:categorias(id, nome, icone)',
    )
    .eq('id', id)
    .eq('status', 'ativo')
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data as unknown as Parceiro | null;
}

export async function listarOfertasDoParceiro(
  parceiroId: string,
): Promise<Oferta[]> {
  const { data, error } = await supabase
    .from('ofertas')
    .select(CAMPOS_OFERTA)
    .eq('parceiro_id', parceiroId)
    .eq('status', 'ativa')
    .limit(50);
  if (error) {
    throw error;
  }
  return (data ?? []) as unknown as Oferta[];
}

export async function buscarOferta(id: string): Promise<Oferta | null> {
  const { data, error } = await supabase
    .from('ofertas')
    .select(
      `${CAMPOS_OFERTA}, regras, validade_inicio, parceiro:parceiros(id, nome_fantasia, cidade)`,
    )
    .eq('id', id)
    .eq('status', 'ativa')
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data as unknown as Oferta | null;
}

export async function buscarResgate(id: string): Promise<Resgate | null> {
  const { data, error } = await supabase
    .from('resgates')
    .select(
      'id, codigo, qr_token, gerado_em, validado_em, status, valor_economizado, oferta:ofertas(id, titulo, regras), parceiro:parceiros(id, nome_fantasia)',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data as unknown as Resgate | null;
}

export async function listarMeusResgates(
  usuarioId: string,
): Promise<ResgateResumo[]> {
  const { data, error } = await supabase
    .from('resgates')
    .select(
      'id, codigo, status, gerado_em, validado_em, valor_economizado, oferta:ofertas(titulo), parceiro:parceiros(nome_fantasia)',
    )
    .eq('usuario_id', usuarioId)
    .order('gerado_em', { ascending: false })
    .limit(50);
  if (error) {
    throw error;
  }
  return (data ?? []) as unknown as ResgateResumo[];
}

const OFFSET_BRASILIA_MS = 3 * 3600_000;

export function hojeEmBrasilia(agora = Date.now()): string {
  return new Date(agora - OFFSET_BRASILIA_MS).toISOString().slice(0, 10);
}

export function inicioDoMesEmBrasilia(agora = Date.now()): Date {
  const [ano, mes] = hojeEmBrasilia(agora).split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, 1) + OFFSET_BRASILIA_MS);
}

export type ResumoEconomia = { total: number; validadosNoMes: number };

/** Soma do que já foi validado no balcão + quantos resgates no mês (barra de nível). */
export async function buscarEconomia(
  usuarioId: string,
): Promise<ResumoEconomia> {
  const { data, error } = await supabase
    .from('resgates')
    .select('valor_economizado, validado_em')
    .eq('usuario_id', usuarioId)
    .eq('status', 'validado');
  if (error) {
    throw error;
  }
  const inicioMes = inicioDoMesEmBrasilia();
  return (data ?? []).reduce<ResumoEconomia>(
    (acc, r) => ({
      total: acc.total + Number(r.valor_economizado ?? 0),
      validadosNoMes:
        acc.validadosNoMes +
        (r.validado_em && new Date(r.validado_em) >= inicioMes ? 1 : 0),
    }),
    { total: 0, validadosNoMes: 0 },
  );
}

/** Resgate "gerado" que passou dos 15 min conta como vencido na tela. */
export function statusExibido(
  r: { status: StatusResgate; gerado_em: string },
  agora = Date.now(),
): StatusResgate {
  if (r.status !== 'gerado') {
    return r.status;
  }
  const fim = new Date(r.gerado_em).getTime() + MINUTOS_VALIDADE * 60_000;
  return agora > fim ? 'expirado' : 'gerado';
}

export const rotuloStatusResgate: Record<StatusResgate, string> = {
  gerado: 'Aguardando balcão',
  validado: 'Validado',
  expirado: 'Vencido',
  cancelado: 'Cancelado',
};

function real(v: number) {
  return Number(v).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/** Texto curto do benefício ("10% OFF", "R$ 5,00 OFF", "De R$ 20,00 por R$ 15,00"). */
export function resumoDesconto(
  o: Pick<Oferta, 'tipo' | 'valor_desconto' | 'preco_de' | 'preco_por'>,
): string | null {
  if (o.preco_de != null && o.preco_por != null) {
    return `De ${real(o.preco_de)} por ${real(o.preco_por)}`;
  }
  if (o.valor_desconto == null) {
    return o.tipo === 'brinde' ? 'Brinde' : null;
  }
  if (o.tipo === 'desconto_percentual') {
    return `${Number(o.valor_desconto)}% OFF`;
  }
  if (o.tipo === 'cashback') {
    return `${Number(o.valor_desconto)}% de volta`;
  }
  return `${real(o.valor_desconto)} OFF`;
}

// ─── Resgate ────────────────────────────────────────────────────────────────

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function gerarCodigo() {
  let fim = '';
  for (let i = 0; i < 4; i++) {
    fim += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  }
  return `CC-${fim}`;
}

export type ResultadoResgate =
  | { ok: true; resgateId: string }
  | {
      ok: false;
      motivo: string;
      precisaAssociar?: boolean;
      precisaPremium?: boolean;
    };

/** Traduz a recusa do trigger `corre_resgates_antes_inserir` para a tela. */
export function motivoDoBanco(mensagem: string): ResultadoResgate {
  const m = mensagem.toLowerCase();
  if (m.includes('exclusiva de associado')) {
    return {
      ok: false,
      motivo: 'Essa é exclusiva para associado em dia.',
      precisaAssociar: true,
    };
  }
  if (m.includes('premium')) {
    return {
      ok: false,
      motivo: 'Essa é só para quem tem o plano premium.',
      precisaPremium: true,
    };
  }
  if (m.includes('muitos códigos')) {
    return {
      ok: false,
      motivo: 'Calma! Muitos códigos em pouco tempo. Tenta em 1 minuto.',
    };
  }
  if (m.includes('limite')) {
    return { ok: false, motivo: 'Você já usou essa oferta o máximo de vezes.' };
  }
  if (m.includes('nao comecou')) {
    return { ok: false, motivo: 'Essa oferta ainda não começou.' };
  }
  if (m.includes('vencida')) {
    return { ok: false, motivo: 'O prazo dessa oferta já acabou.' };
  }
  return { ok: false, motivo: 'Essa oferta não está mais no ar.' };
}

/**
 * Gera o resgate da oferta — mesmas regras da server function `criarResgate` do web.
 * Roda com a sessão do próprio usuário (RLS `resgates_insert`: usuario_id = auth.uid()).
 * O registro (parceiro + usuário + data/hora) é a base da auditoria e da taxa de ativação.
 *
 * As checagens abaixo só dão a mensagem certa antes de tentar: quem manda é o
 * trigger `corre_resgates_antes_inserir` (docs/backend/seguranca-fase1.sql),
 * que repete as regras no banco e grava código, parceiro, valor e horário.
 */
export async function criarResgate(
  ofertaId: string,
  usuarioId: string,
): Promise<ResultadoResgate> {
  const { data: oferta, error: erroOferta } = await supabase
    .from('ofertas')
    .select(
      'id, parceiro_id, status, exclusivo_associados, exclusivo_premium, limite_por_usuario, validade_inicio, validade_fim, valor_desconto, preco_de, preco_por, tipo',
    )
    .eq('id', ofertaId)
    .maybeSingle();

  if (erroOferta) {
    throw erroOferta;
  }
  if (!oferta || oferta.status !== 'ativa') {
    return { ok: false, motivo: 'Essa oferta não está mais no ar.' };
  }

  const hoje = hojeEmBrasilia();
  if (oferta.validade_inicio && oferta.validade_inicio > hoje) {
    return { ok: false, motivo: 'Essa oferta ainda não começou.' };
  }
  if (oferta.validade_fim && oferta.validade_fim < hoje) {
    return { ok: false, motivo: 'O prazo dessa oferta já acabou.' };
  }

  // Resgate ainda no prazo: reabre o mesmo código. Vem antes do limite por
  // usuário — senão, com limite 1, quem volta pra oferta perde o próprio QR.
  // O relógio do celular só serve pra essa leitura; a validade de verdade é a
  // do servidor (trigger + validar_resgate).
  const limite = new Date(Date.now() - MINUTOS_VALIDADE * 60_000).toISOString();
  const buscarAberto = async () => {
    const { data } = await supabase
      .from('resgates')
      .select('id')
      .eq('oferta_id', oferta.id)
      .eq('usuario_id', usuarioId)
      .eq('status', 'gerado')
      .gte('gerado_em', limite)
      .limit(1)
      .maybeSingle();
    return data?.id as string | undefined;
  };
  const aberto = await buscarAberto();
  if (aberto) {
    return { ok: true, resgateId: aberto };
  }

  if (oferta.exclusivo_premium) {
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('plano')
      .eq('id', usuarioId)
      .maybeSingle();
    if (usuario?.plano !== 'premium') {
      return {
        ok: false,
        motivo: 'Essa é só para quem tem o plano premium.',
        precisaPremium: true,
      };
    }
  }

  if (oferta.exclusivo_associados) {
    // Inadimplente pode estar na carência: quem decide é o banco.
    const { data: associado } = await supabase
      .from('associados')
      .select('id')
      .eq('usuario_id', usuarioId)
      .in('status', ['ativo', 'inadimplente'])
      .limit(1)
      .maybeSingle();
    if (!associado) {
      return {
        ok: false,
        motivo: 'Essa é exclusiva para associado em dia.',
        precisaAssociar: true,
      };
    }
  }

  if (oferta.limite_por_usuario) {
    const { count } = await supabase
      .from('resgates')
      .select('id', { count: 'exact', head: true })
      .eq('oferta_id', oferta.id)
      .eq('usuario_id', usuarioId)
      // Código que venceu sem uso não gasta a cota: só validado ou ainda no prazo.
      .or(`status.eq.validado,and(status.eq.gerado,gerado_em.gte.${limite})`);
    if ((count ?? 0) >= oferta.limite_por_usuario) {
      return {
        ok: false,
        motivo: 'Você já usou essa oferta o máximo de vezes.',
      };
    }
  }

  // O código definitivo sai do banco (CSPRNG, trigger); o daqui é só fallback
  // enquanto a migration não está aplicada. 23505 = toque duplo (índice único
  // por usuário+oferta em aberto) ou colisão de código: reabre o que existir.
  // valor_economizado quem calcula é o banco.
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const { data: criado, error } = await supabase
      .from('resgates')
      .insert({
        oferta_id: oferta.id,
        parceiro_id: oferta.parceiro_id,
        usuario_id: usuarioId,
        codigo: gerarCodigo(),
      })
      .select('id')
      .single();
    if (!error) {
      return { ok: true, resgateId: criado.id };
    }
    if (error.code === 'P0001') {
      return motivoDoBanco(error.message);
    }
    if (error.code !== '23505') {
      throw error;
    }
    const existente = await buscarAberto();
    if (existente) {
      return { ok: true, resgateId: existente };
    }
  }
  return { ok: false, motivo: 'Não deu pra gerar o código. Tenta de novo.' };
}
