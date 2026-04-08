import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const browserTarget = (major: number, minor = 0, patch = 0) =>
    (major << 16) | (minor << 8) | patch
const scriptTarget = 'es2020'

const config = defineConfig({
    server: {
        host: '0.0.0.0',
    },
    esbuild: {
        target: scriptTarget,
    },
    css: {
        transformer: 'lightningcss',
        lightningcss: {
            targets: {
                ios_saf: browserTarget(15),
                safari: browserTarget(15),
            },
        },
    },
    build: {
        cssMinify: 'lightningcss',
        target: scriptTarget,
    },
    optimizeDeps: {
        esbuildOptions: {
            target: scriptTarget,
        },
    },
    plugins: [
        devtools(),
        nitro({ rollupConfig: { external: [/^@sentry\//] } }),
        tsconfigPaths({ projects: ['./tsconfig.json'] }),
        tailwindcss(),
        tanstackStart({ spa: { enabled: true } }),
        viteReact(),
    ],
})

export default config
