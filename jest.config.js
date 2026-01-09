/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  // 1. Use the ESM preset provided by ts-jest
  preset: 'ts-jest/presets/default-esm', 
  testEnvironment: 'node',
  
  // 2. Tell Jest which extensions to treat as ESM
  extensionsToTreatAsEsm: ['.ts'], 
  
  // 3. Map imports to handle the ".js" extension requirement in ESM
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  transform: {
    // 4. Configure ts-jest to use ESM internally
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
};