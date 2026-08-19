module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      // Inline options, merged by ts-jest over the tsconfig.json it resolves
      // from this directory — the same file the previous `tsconfig: 'tsconfig.json'`
      // named, with one override.
      //
      // That tsconfig sets `jsx: "react-native"`, which PRESERVES JSX so Metro
      // can compile it in the host app. Node cannot parse preserved JSX, so any
      // test that mounts a component (see src/__tests__/harness/) died on the
      // first `<View>` in a .tsx source file. `jsx: "react"` emits
      // React.createElement instead. It changes nothing for the .ts test files
      // that were already passing, because there is no JSX in them to emit.
      tsconfig: { jsx: 'react' },
    }],
  },
  globals: {
    __DEV__: true,
  },
};
