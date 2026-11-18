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
  },
};
