import type { ReviewFailure } from './types';

export const MIN_REJECTION_NOTE_LENGTH = 5;

export function validateRejectionNote(note: string): string | null {
  if (note.trim().length < MIN_REJECTION_NOTE_LENGTH) {
    return `Escreva o motivo da recusa (mínimo ${MIN_REJECTION_NOTE_LENGTH} letras) para avisar a pessoa.`;
  }
  return null;
}

export function parseReviewError(message: string): ReviewFailure {
  const m = message.toLowerCase();
  if (m.includes('já analisado') || m.includes('não encontrado')) {
    return {
      reason:
        'Esse pedido já foi analisado por outra pessoa. A lista foi atualizada.',
      reload: true,
    };
  }
  if (m.includes('motivo da recusa')) {
    return {
      reason: `Escreva um motivo com pelo menos ${MIN_REJECTION_NOTE_LENGTH} letras.`,
      reload: false,
    };
  }
  if (m.includes('could not find the function')) {
    return {
      reason: 'A aprovação ainda não está ativa no servidor. Avise o suporte.',
      reload: false,
    };
  }
  if (m.includes('sem permissão') || m.includes('autenticação')) {
    return {
      reason: 'Sua conta não tem permissão para esta associação.',
      reload: false,
    };
  }
  return {
    reason: 'Não foi possível concluir. Verifique a conexão e tente novamente.',
    reload: false,
  };
}

export function errorMessage(error: unknown): string {
  return String((error as { message?: string } | null)?.message ?? '');
}
