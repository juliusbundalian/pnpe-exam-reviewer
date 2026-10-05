const preset = require('jest-expo/jest-preset');
const [transformer, options] = preset.transform['\\.[jt]sx?$'];
module.exports = {
  preset: 'jest-expo',
  watchman: false,
  testMatch: ['<rootDir>/tests/mobile/**/*.test.tsx'],
  transform: {
    ...preset.transform,
    '\\.[jt]sx?$': [
      transformer,
      {
        ...options,
        // RN codegen emits exports after its normal transform. Keep the extra
        // test-only lowering on our TS sources, not React Native dependencies.
        overrides: [
          {
            test: /[/\\](src|tests)[/\\]/,
            exclude: /node_modules/,
            plugins: [
              '@babel/plugin-transform-dynamic-import',
              '@babel/plugin-transform-modules-commonjs',
            ],
          },
        ],
        caller: { ...options.caller, supportsDynamicImport: false },
      },
    ],
  },
};
