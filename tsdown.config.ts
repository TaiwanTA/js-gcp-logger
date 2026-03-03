import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'middleware/hono/index': 'src/middleware/hono/index.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  target: 'node18',
  clean: true,
})
