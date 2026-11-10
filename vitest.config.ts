import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`. Requires Vite 8, which ships this option.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    // Igual que en main.ts (vía @nestjs/core): los decoradores necesitan los metadatos.
    setupFiles: ['reflect-metadata'],
    root: './',
    include: ['**/*.spec.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      // Código generado, de arranque y módulos declarativos: se cubren en las pruebas e2e.
      exclude: [
        'src/generated/**',
        'src/main.ts',
        'src/seed.ts',
        'src/**/*.module.ts',
        'src/**/*.spec.ts',
      ],
    },
  },
});
