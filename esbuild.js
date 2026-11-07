import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

async function build() {
  const context = await esbuild.context({
    entryPoints: {
      extension: './src/extension/extension.ts',
      renderer: './src/workbench-patch/renderer.ts'
    },
    bundle: true,
    outdir: './dist',
    outExtension: { '.js': '.cjs' },
    platform: 'node',
    format: 'cjs',
    external: ['vscode'],
    target: 'node18',
    sourcemap: isWatch,
    minify: !isWatch,
    logLevel: 'info',
    loader: { '.css': 'text' }
  });

  if (isWatch) {
    await context.watch();
    console.log('[Esbuild] Modo watch activado.');
  } else {
    await context.rebuild();
    await context.dispose();
    console.log('[Esbuild] Compilación terminada con éxito.');
  }
}

build().catch(err => {
  console.error('[Esbuild Error]', err);
  process.exit(1);
});