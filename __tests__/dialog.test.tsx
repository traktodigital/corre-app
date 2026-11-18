import React, { useEffect } from 'react';
import { Modal, Text as RNText } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { ThemeProvider } from '../src/shared/theme';
import {
  Button,
  DialogProvider,
  useDialog,
  type DialogButton,
} from '../src/shared/ui';

function Trigger({ buttons }: { buttons: DialogButton[] }) {
  const dialog = useDialog();
  useEffect(() => {
    dialog('Excluir sua conta?', 'Não dá pra desfazer.', buttons);
  }, [dialog, buttons]);
  return null;
}

async function render(buttons: DialogButton[]) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <ThemeProvider mode="dark">
        <DialogProvider>
          <Trigger buttons={buttons} />
        </DialogProvider>
      </ThemeProvider>,
    );
  });
  return tree;
}

const titles = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.findAllByType(Button).map(b => b.props.title);

test('diálogo próprio: ação principal primeiro, cancelar por último', async () => {
  const onDelete = jest.fn();
  const tree = await render([
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: onDelete },
  ]);
  expect(titles(tree)).toEqual(['Excluir', 'Cancelar']);
  expect(
    tree.root
      .findAllByType(RNText)
      .some(t => t.props.children === 'Não dá pra desfazer.'),
  ).toBe(true);
  await ReactTestRenderer.act(() => {
    tree.root.findAllByType(Button)[0].props.onPress();
  });
  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(tree.root.findByType(Modal).props.visible).toBe(false);
});

test('voltar do Android aciona o botão de cancelar', async () => {
  const onCancel = jest.fn();
  const tree = await render([
    { text: 'Anexar', style: 'cancel', onPress: onCancel },
    { text: 'Encerrar assim' },
  ]);
  await ReactTestRenderer.act(() => {
    tree.root.findByType(Modal).props.onRequestClose();
  });
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(tree.root.findByType(Modal).props.visible).toBe(false);
});
