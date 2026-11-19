module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'react-native',
            importNames: ['Alert', 'ActionSheetIOS', 'ToastAndroid'],
            message: 'Use useDialog() de shared/ui (ADR-0009 D8).',
          },
        ],
      },
    ],
    '@typescript-eslint/no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'lucide-react-native',
            allowTypeImports: true,
            message:
              "Importe o ícone direto (lucide-react-native/icons/<nome>): o pacote inteiro coloca os 1.855 ícones no bundle.",
          },
        ],
      },
    ],
  },
};
