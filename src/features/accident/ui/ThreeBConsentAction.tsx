import { useState } from 'react';
import { useQuery } from '../../../shared/hooks/useQuery';
import { Button, useDialog } from '../../../shared/ui';
import { useSession } from '../../auth';
import {
  fetchThreeBConsent,
  recordThreeBConsent,
} from '../data/accidentRepository';

export function ThreeBConsentAction() {
  const { user } = useSession();
  const dialog = useDialog();
  const userId = user?.id ?? null;
  const consent = useQuery(userId ? `3b-consent:${userId}` : null, () =>
    fetchThreeBConsent(userId!),
  );
  const [revoking, setRevoking] = useState(false);

  if (consent.data !== 'accepted') {
    return null;
  }

  async function revoke() {
    setRevoking(true);
    try {
      await recordThreeBConsent('revoked');
      await consent.reload(true);
      dialog(
        'Pronto',
        'A gente não compartilha mais seus dados com a 3B. O que você já mandou no WhatsApp deles fica com eles.',
      );
    } catch {
      dialog('Não deu agora', 'Confere a internet e tenta de novo.');
    } finally {
      setRevoking(false);
    }
  }

  return (
    <Button
      title="Parar de compartilhar meus dados com a 3B"
      variant="outline"
      fullWidth
      loading={revoking}
      onPress={() =>
        dialog(
          'Parar de compartilhar com a 3B?',
          'A 3B deixa de receber seu nome no relatório mensal do CORRE. Para apagar o que você já mandou no WhatsApp, fale direto com eles.',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Parar de compartilhar',
              style: 'destructive',
              onPress: revoke,
            },
          ],
        )
      }
    />
  );
}
