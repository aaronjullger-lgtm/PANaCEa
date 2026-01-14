import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
    { ignores: ['dist', 'node_modules', 'playwright-report', '*.config.js', '*.config.ts'] },
    {
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2022,
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            // React Hooks
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

            // TypeScript - relaxed for gradual adoption
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            '@typescript-eslint/ban-ts-comment': 'off', // Allow @ts-nocheck during migration

            // General
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'prefer-const': 'warn',
        },
    }
);
