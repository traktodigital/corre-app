import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { alpha, useTheme } from '../theme';
import { Button } from './Button';
import { Card } from './Card';
import { Text } from './Text';

export type DialogButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

export type ShowDialog = (
  title: string,
  message?: string,
  buttons?: DialogButton[],
) => void;

type DialogState = { title: string; message?: string; buttons: DialogButton[] };

const DialogContext = createContext<ShowDialog | null>(null);

function orderButtons(buttons: DialogButton[]): DialogButton[] {
  return [
    ...buttons.filter(b => b.style !== 'cancel'),
    ...buttons.filter(b => b.style === 'cancel'),
  ];
}

function variantFor(button: DialogButton, index: number) {
  if (button.style === 'destructive') {
    return 'destructive';
  }
  if (button.style === 'cancel' || index > 0) {
    return 'outline';
  }
  return 'primary';
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const show = useCallback<ShowDialog>((title, message, buttons) => {
    setDialog({
      title,
      message,
      buttons: orderButtons(buttons?.length ? buttons : [{ text: 'Entendi' }]),
    });
  }, []);

  function press(button: DialogButton) {
    setDialog(null);
    button.onPress?.();
  }

  function dismiss() {
    const cancel = dialog?.buttons.find(b => b.style === 'cancel');
    if (cancel) {
      press(cancel);
    } else {
      setDialog(null);
    }
  }

  return (
    <DialogContext.Provider value={show}>
      {children}
      <Modal
        transparent
        statusBarTranslucent
        animationType="fade"
        visible={dialog !== null}
        onRequestClose={dismiss}
      >
        <View
          style={[
            styles.backdrop,
            { backgroundColor: alpha(colors.background, 0.85) },
          ]}
        >
          {dialog ? (
            <Card padding={24} style={styles.card} accessibilityRole="alert">
              <Text variant="h2">{dialog.title}</Text>
              {dialog.message ? (
                <Text tone="muted">{dialog.message}</Text>
              ) : null}
              <View style={styles.actions}>
                {dialog.buttons.map((button, index) => (
                  <Button
                    key={button.text}
                    title={button.text}
                    size="lg"
                    fullWidth
                    variant={variantFor(button, index)}
                    onPress={() => press(button)}
                  />
                ))}
              </View>
            </Card>
          ) : null}
        </View>
      </Modal>
    </DialogContext.Provider>
  );
}

export function useDialog(): ShowDialog {
  const show = useContext(DialogContext);
  if (!show) {
    throw new Error('useDialog must be used inside DialogProvider');
  }
  return show;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: { gap: 12 },
  actions: { gap: 10, marginTop: 8 },
});
