import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// A plugin to handle ONNX Runtime Web compatibility with Vite
function onnxRuntimeWebPlugin() {
  return {
    name: 'onnx-runtime-web',
    enforce: 'pre' as const,
    load(id: string) {
      if (id.includes('onnxruntime-web')) {
        // Return the module content with Vite-specific code replaced
        if (id.includes('wasm-factory')) {
          // For WASM factory files, avoid Vite's module processing
          return null
        }
      }
      return null
    },
    transform(code: string, id: string) {
      if (id.includes('onnxruntime-web')) {
        // Replace Vite-specific imports that cause issues
        let transformedCode = code
        transformedCode = transformedCode.replace(
          /\bimport\s*{\s*injectQuery\s*}\s*from\s*['"]@vite\/client['"]/g,
          'const injectQuery = () => {}'
        )
        transformedCode = transformedCode.replace(
          /\binjectQuery\b/g,
          '() => {}'
        )
        return {
          code: transformedCode,
          map: null
        }
      }
      return null
    }
  }
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    onnxRuntimeWebPlugin()
  ],
  // Configure asset handling to ensure ONNX and WASM files are served correctly
  publicDir: 'public',
  assetsInclude: [/\.wasm$/, /\.onnx$/, /\.mjs$/], // Include .mjs files for WASM modules
  server: {
    // Custom MIME type configuration for WASM files
    mimeTypes: {
      '.wasm': 'application/wasm',
      '.mjs': 'application/javascript', // Proper MIME type for .mjs files
    },
    // Allow CORS for WASM files
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  build: {
    copyPublicDir: true,
  },
  // Handle the injectQuery compatibility issue specifically
  optimizeDeps: {
    include: ['onnxruntime-web'], // Pre-bundle ONNX Runtime Web to handle imports properly
    exclude: ['.wasm', '.onnx']
  },
  // Handle potential module compatibility issues
  define: {
    global: 'globalThis',
  },
  // Handle esbuild-related issues with ONNX Runtime
  esbuild: {
    logOverride: { 'unsupported-dynamic-import': 'silent' }
  }
})
