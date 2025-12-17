import * as ort from 'onnxruntime-web';

// Global configuration for ONNX Runtime Web
// The type definition for wasmPaths might be stricter in newer versions, casting to any if needed or matching the interface
ort.env.wasm.wasmPaths = {
  'ort-wasm.wasm': '/ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd.wasm': '/ort-wasm-simd-threaded.wasm',
  'ort-wasm-threaded.wasm': '/ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.wasm': '/ort-wasm-simd-threaded.wasm',
} as any;

ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = true;
ort.env.wasm.proxy = false;

export interface ModelInfo {
  inputNames: string[];
  inputMetadata: any;
  outputNames: string[];
  outputMetadata: any;
}

export abstract class OnnxModel {
  protected session: ort.InferenceSession | null = null;
  protected isInitialized = false;
  protected modelPath: string;

  constructor(modelPath: string) {
    this.modelPath = modelPath;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const executionProviders = await this.getExecutionProviders();

    try {
      this.session = await ort.InferenceSession.create(this.modelPath, {
        executionProviders,
      });
      this.isInitialized = true;
    } catch (error) {
      // Fallback logic if WebGPU fails
      if (executionProviders.includes('webgpu')) {
         try {
            this.session = await ort.InferenceSession.create(this.modelPath, {
                executionProviders: ['wasm', 'cpu'],
            });
            this.isInitialized = true;
         } catch (fallbackError) {
             throw fallbackError;
         }
      } else {
          throw error;
      }
    }
  }

  protected async getExecutionProviders(): Promise<string[]> {
      const isWebGpuAvailable = typeof navigator !== 'undefined' &&
                                'gpu' in navigator &&
                                (navigator as any).gpu?.requestAdapter;

      return isWebGpuAvailable ? ['webgpu', 'wasm', 'cpu'] : ['wasm', 'cpu'];
  }

  getModelInfo(): ModelInfo | null {
    if (!this.session) return null;
    return {
      inputNames: [...this.session.inputNames],
      inputMetadata: this.session.inputMetadata,
      outputNames: [...this.session.outputNames],
      outputMetadata: this.session.outputMetadata,
    };
  }

  abstract process(image: ImageData, options?: any): Promise<ImageData>;
}
