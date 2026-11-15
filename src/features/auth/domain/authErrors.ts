export type AuthServiceError = { code?: string; message: string };

export function signInErrorMessage(error: AuthServiceError): string {
  return error.message.toLowerCase().includes('invalid')
    ? 'E-mail ou senha errados. Confere aí.'
    : 'Não deu pra entrar agora. Tenta de novo.';
}

export function signUpErrorMessage(error: AuthServiceError): string {
  const message = error.message.toLowerCase();
  if (error.code === 'user_already_exists' || message.includes('registered')) {
    return 'Esse e-mail já tem conta. Tenta entrar.';
  }
  if (error.code === 'weak_password') {
    return 'Senha fraca. Use letras e números, com pelo menos 8 caracteres.';
  }
  if (error.code === 'email_address_invalid') {
    return 'Esse e-mail não parece válido. Confere aí.';
  }
  if (
    error.code === 'over_email_send_rate_limit' ||
    message.includes('rate limit')
  ) {
    return 'Muitos cadastros agora. Espera uns minutos e tenta de novo.';
  }
  return 'Não deu pra criar a conta agora. Tenta de novo.';
}

export function passwordResetEmailError(email: string): string | null {
  return email.trim()
    ? null
    : 'Escreve seu e-mail primeiro que a gente manda o link.';
}

export const PASSWORD_RESET_FAILED =
  'Não rolou enviar o link agora. Tenta em instantes.';
