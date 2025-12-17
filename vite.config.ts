import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  // Configure asset handling to ensure ONNX and WASM files are served correctly
  publicDir: 'public',
  assetsInclude: [/\.wasm$/, /\.onnx$/],
  server: {
    // Custom MIME type configuration for WASM files
    mimeTypes: {
      '.wasm': 'application/wasm',
    },
  },
})
