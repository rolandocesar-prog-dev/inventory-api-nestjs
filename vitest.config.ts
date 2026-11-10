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
      // Código generado y de arranque; el arranque se cubre en las pruebas e2e.
      exclude: ['src/generated/**', 'src/main.ts', 'src/**/*.spec.ts'],
    },
  },
});
