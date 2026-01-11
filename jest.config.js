module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    moduleNameMapper: {
        '^obsidian$': '<rootDir>/__mocks__/obsidian.ts',
    },
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: 'tsconfig.json',
        }],
    },
    setupFiles: ['<rootDir>/jest.setup.js'],
};
