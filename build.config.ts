import { defineBuildConfig } from 'unbuild'
import { version } from './package.json'

export default defineBuildConfig({
  entries: [
    'src/index',
  ],
  declaration: true,
  clean: false,
  rollup: {
    emitCJS: true,
    esbuild: {
      define: {
        __VERSION__: JSON.stringify(version),
      },
      tsconfigRaw: {
        compilerOptions: {
          experimentalDecorators: true,
        },
      },
    },
  },
})
