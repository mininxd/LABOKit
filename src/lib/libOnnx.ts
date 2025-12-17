import * as ort from 'onnxruntime-web';

// Configure ONNX Runtime to load WASM files from the public directory
ort.env.wasm.wasmPaths = {
  'ort-wasm.wasm': '/ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd.wasm': '/ort-wasm-simd-threaded.wasm',
  'ort-wasm-threaded.wasm': '/ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.wasm': '/ort-wasm-simd-threaded.wasm',
  'ort-wasm.wasm.map': '/ort-wasm-simd-threaded.wasm.map', // if available
  'ort-wasm-simd.wasm.map': '/ort-wasm-simd-threaded.wasm.map', // if available
  'ort-wasm-threaded.wasm.map': '/ort-wasm-simd-threaded.wasm.map', // if available
  'ort-wasm-simd-threaded.wasm.map': '/ort-wasm-simd-threaded.wasm.map' // if available
};

// Additional WASM backend configuration
ort.env.wasm.numThreads = 1; // Limit threads for compatibility
ort.env.wasm.simd = true;    // Enable SIMD instructions for performance
ort.env.wasm.proxy = false;  // Disable proxy mode in development

export interface UpscaleOptions {
  scale?: number;
  crop?: boolean;
  tileSize?: number;
  tileOverlap?: number;
}

export class RealESRGANUpscaler {
  private modelPath: string;
  private session: ort.InferenceSession | null = null;
  private isInitialized = false;

  constructor(modelPath: string = '/realesr-general-x4v3.onnx') {
    this.modelPath = modelPath;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const isWebGpuAvailable = typeof navigator !== 'undefined' &&
                              'gpu' in navigator &&
                              (navigator as any).gpu?.requestAdapter;

    let executionProviders: string[];

    if (isWebGpuAvailable) {
      executionProviders = ['webgpu', 'wasm', 'cpu'];
    } else {
      executionProviders = ['wasm', 'cpu'];
    }

    try {
      const sessionOptions: ort.InferenceSession.SessionOptions = {
        executionProviders: executionProviders,
      };

      this.session = await ort.InferenceSession.create(this.modelPath, sessionOptions);
      this.isInitialized = true;
    } catch (error) {

      if (executionProviders.includes('webgpu')) {
        try {
          const fallbackSessionOptions: ort.InferenceSession.SessionOptions = {
            executionProviders: ['wasm', 'cpu'],
          };

          this.session = await ort.InferenceSession.create(this.modelPath, fallbackSessionOptions);
          this.isInitialized = true;
        } catch (fallbackError) {
          throw fallbackError;
        }
      } else {
        throw error;
      }
    }
  }

  private preprocessImage(image: ImageData): ort.Tensor {
    const { width, height, data } = image;

    const rgbArray = new Float32Array(width * height * 3);

    for (let i = 0; i < width * height; i++) {
      rgbArray[i] = (data[i * 4] / 255.0) * 2.0 - 1.0;
      rgbArray[i + width * height] = (data[i * 4 + 1] / 255.0) * 2.0 - 1.0;
      rgbArray[i + width * height * 2] = (data[i * 4 + 2] / 255.0) * 2.0 - 1.0;
    }

    const tensor = new ort.Tensor('float32', rgbArray, [1, 3, height, width]);

    return tensor;
  }

  private postprocessOutput(
    outputTensor: ort.Tensor,
    originalWidth: number,
    originalHeight: number,
    scale: number
  ): ImageData {
    const outputArray = outputTensor.data as Float32Array;

    const finalWidth = originalWidth * scale;
    const finalHeight = originalHeight * scale;

    const rgbaArray = new Uint8ClampedArray(finalWidth * finalHeight * 4);

    for (let i = 0; i < finalWidth * finalHeight; i++) {
      rgbaArray[i * 4] = ((outputArray[i] + 1.0) / 2.0) * 255;
      rgbaArray[i * 4 + 1] = ((outputArray[i + finalWidth * finalHeight] + 1.0) / 2.0) * 255;
      rgbaArray[i * 4 + 2] = ((outputArray[i + finalWidth * finalHeight * 2] + 1.0) / 2.0) * 255;
      rgbaArray[i * 4 + 3] = 255;
    }

    return new ImageData(rgbaArray, finalWidth, finalHeight);
  }

  async upscaleImage(image: ImageData, options?: UpscaleOptions): Promise<ImageData> {
    if (!this.isInitialized || !this.session) {
      throw new Error('Model not initialized. Call initialize() first.');
    }

    const opts: Required<UpscaleOptions> = {
      scale: options?.scale ?? 4,
      crop: options?.crop ?? false,
      tileSize: options?.tileSize ?? 0,
      tileOverlap: options?.tileOverlap ?? 32,
    };

    const inputTensor = this.preprocessImage(image);

    const feeds: Record<string, ort.Tensor> = {};
    if (this.session.inputNames.length > 0) {
      feeds[this.session.inputNames[0]] = inputTensor;
    } else {
      throw new Error('Model has no recognizable input');
    }

    const results = await this.session.run(feeds);

    const outputName = this.session.outputNames[0];
    const outputTensor = results[outputName];

    const upscaledImage = this.postprocessOutput(
      outputTensor,
      image.width,
      image.height,
      opts.scale
    );

    return upscaledImage;
  }

  async upscaleImageTiled(image: ImageData, options?: UpscaleOptions): Promise<ImageData> {
    if (!options?.tileSize || options.tileSize <= 0) {
      return await this.upscaleImage(image, options);
    }

    const opts: Required<UpscaleOptions> = {
      scale: options?.scale ?? 4,
      crop: options?.crop ?? false,
      tileSize: options?.tileSize ?? 128,
      tileOverlap: options?.tileOverlap ?? 32,
    };

    const { width, height } = image;
    const scaledWidth = width * opts.scale;
    const scaledHeight = height * opts.scale;

    const canvas = document.createElement('canvas');
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context for tiled upscaling');
    }

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    const sourceCtx = sourceCanvas.getContext('2d');
    if (!sourceCtx) {
        throw new Error('Could not get 2D context for source image');
    }
    sourceCtx.putImageData(image, 0, 0);

    const tileWidth = Math.min(opts.tileSize, width);
    const tileHeight = Math.min(opts.tileSize, height);
    const cols = Math.ceil(width / tileWidth);
    const rows = Math.ceil(height / tileHeight);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        let xStart = Math.max(col * tileWidth - opts.tileOverlap, 0);
        let yStart = Math.max(row * tileHeight - opts.tileOverlap, 0);
        let xEnd = Math.min((col + 1) * tileWidth + opts.tileOverlap, width);
        let yEnd = Math.min((row + 1) * tileHeight + opts.tileOverlap, height);

        if (col === 0) xStart = 0;
        if (row === 0) yStart = 0;
        if (col === cols - 1) xEnd = width;
        if (row === rows - 1) yEnd = height;

        const tileW = xEnd - xStart;
        const tileH = yEnd - yStart;

        const tileImageData = sourceCtx.getImageData(xStart, yStart, tileW, tileH);

        const upscaledTile = await this.upscaleImage(tileImageData, {
            scale: opts.scale,
            crop: opts.crop,
            tileSize: 0,
        });

        ctx.putImageData(
            upscaledTile,
            xStart * opts.scale,
            yStart * opts.scale
        );
      }
    }

    return ctx.getImageData(0, 0, scaledWidth, scaledHeight);
  }

  getModelInfo(): object | null {
    if (!this.session) {
      return null;
    }

    return {
      inputNames: this.session.inputNames,
      inputMetadata: this.session.inputMetadata,
      outputNames: this.session.outputNames,
      outputMetadata: this.session.outputMetadata,
    };
  }
}

export async function createUpscaler(modelPath?: string): Promise<RealESRGANUpscaler> {
  const upscaler = new RealESRGANUpscaler(modelPath);
  await upscaler.initialize();
  return upscaler;
}