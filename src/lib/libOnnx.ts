import * as ort from 'onnxruntime-web';
export interface UpscaleOptions {
  scale?: number;
  crop?: boolean;
  tileSize?: number;
  tileOverlap?: number;
}

/**
 * A class for performing image upscaling using the Real-ESRGAN model
 */
export class RealESRGANUpscaler {
  private modelPath: string;
  private session: ort.InferenceSession | null = null;
  private isInitialized = false;

  /**
   * Creates a new RealESRGANUpscaler instance
   * @param modelPath Path to the Real-ESRGAN ONNX model file
   */
  constructor(modelPath: string = '/src/onnx/realesr-general-x4v3.onnx') {
    this.modelPath = modelPath;
  }

  /**
   * Initializes the ONNX runtime session with the model
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const isWebGpuAvailable = typeof navigator !== 'undefined' &&
                              'gpu' in navigator &&
                              (navigator.gpu as GPU)?.requestAdapter;

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

  /**
   * Preprocess an image for the Real-ESRGAN model
   * @param image The input image to preprocess
   * @returns Preprocessed tensor ready for inference
   */
  private preprocessImage(image: ImageData): ort.Tensor {
    const { width, height, data } = image;
    
    // Convert RGBA to RGB and normalize to [-1, 1]
    const rgbArray = new Float32Array(width * height * 3);
    
    for (let i = 0; i < width * height; i++) {
      // Convert RGB values from [0, 255] to [-1, 1]
      rgbArray[i] = (data[i * 4] / 255.0) * 2.0 - 1.0; // R channel
      rgbArray[i + width * height] = (data[i * 4 + 1] / 255.0) * 2.0 - 1.0; // G channel
      rgbArray[i + width * height * 2] = (data[i * 4 + 2] / 255.0) * 2.0 - 1.0; // B channel
    }

    // Create a tensor with shape [N, C, H, W] - batch size, channels, height, width
    const tensor = new ort.Tensor('float32', rgbArray, [1, 3, height, width]);
    
    return tensor;
  }

  /**
   * Postprocess the model output to create an upscaled ImageData object
   * @param outputTensor The tensor output from the model
   * @param originalWidth Original width of the input image
   * @param originalHeight Original height of the input image
   * @param scale Upscaling factor
   * @returns Processed ImageData for the upscaled image
   */
  private postprocessOutput(
    outputTensor: ort.Tensor, 
    originalWidth: number, 
    originalHeight: number, 
    scale: number
  ): ImageData {
    const [batch, channels, outHeight, outWidth] = outputTensor.dims;
    const outputArray = outputTensor.data as Float32Array;

    // Calculate dimensions for the final image
    const finalWidth = originalWidth * scale;
    const finalHeight = originalHeight * scale;
    
    // Create the output array for ImageData
    const rgbaArray = new Uint8ClampedArray(finalWidth * finalHeight * 4);

    // Convert normalized values back to [0, 255] range
    for (let i = 0; i < finalWidth * finalHeight; i++) {
      // Convert from [-1, 1] back to [0, 255]
      rgbaArray[i * 4] = ((outputArray[i] + 1.0) / 2.0) * 255; // R
      rgbaArray[i * 4 + 1] = ((outputArray[i + finalWidth * finalHeight] + 1.0) / 2.0) * 255; // G
      rgbaArray[i * 4 + 2] = ((outputArray[i + finalWidth * finalHeight * 2] + 1.0) / 2.0) * 255; // B
      rgbaArray[i * 4 + 3] = 255; // Alpha - fully opaque
    }

    return new ImageData(rgbaArray, finalWidth, finalHeight);
  }

  /**
   * Performs upscaling on an input image
   * @param image Input image as ImageData
   * @param options Upscaling options
   * @returns Upscaled image as ImageData
   */
  async upscaleImage(image: ImageData, options?: UpscaleOptions): Promise<ImageData> {
    if (!this.isInitialized || !this.session) {
      throw new Error('Model not initialized. Call initialize() first.');
    }

    const opts: Required<UpscaleOptions> = {
      scale: options?.scale ?? 4,
      crop: options?.crop ?? false,
      tileSize: options?.tileSize ?? 0, // 0 means no tiling
      tileOverlap: options?.tileOverlap ?? 32,
    };

    // Handle image preprocessing
    const inputTensor = this.preprocessImage(image);

    // Prepare feeds for ONNX inference
    const feeds: Record<string, ort.Tensor> = {};
    if (this.session.inputNames.length > 0) {
      feeds[this.session.inputNames[0]] = inputTensor;
    } else {
      throw new Error('Model has no recognizable input');
    }

    // Perform the inference
    const results = await this.session.run(feeds);

    // Get the output tensor (assuming the first output is the result)
    const outputName = this.session.outputNames[0];
    const outputTensor = results[outputName];

    // Postprocess the output
    const upscaledImage = this.postprocessOutput(
      outputTensor,
      image.width,
      image.height,
      opts.scale
    );

    return upscaledImage;
  }

  /**
   * Performs tiled upscaling on a large image to avoid memory issues
   * @param image Input image as ImageData
   * @param options Upscaling options including tile size
   * @returns Upscaled image as ImageData
   */
  async upscaleImageTiled(image: ImageData, options?: UpscaleOptions): Promise<ImageData> {
    if (!options?.tileSize || options.tileSize <= 0) {
      // If no tile size specified, use regular upscaling
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

    // Create output canvas
    const canvas = document.createElement('canvas');
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context for tiled upscaling');
    }

    // Calculate number of tiles needed
    const tileWidth = Math.min(opts.tileSize, width);
    const tileHeight = Math.min(opts.tileSize, height);
    const cols = Math.ceil(width / tileWidth);
    const rows = Math.ceil(height / tileHeight);

    // Process each tile
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Calculate tile boundaries with overlaps
        let xStart = Math.max(col * tileWidth - opts.tileOverlap, 0);
        let yStart = Math.max(row * tileHeight - opts.tileOverlap, 0);
        let xEnd = Math.min((col + 1) * tileWidth + opts.tileOverlap, width);
        let yEnd = Math.min((row + 1) * tileHeight + opts.tileOverlap, height);

        // Adjust tile position to be centered within overlaps
        if (col === 0) xStart = 0;
        if (row === 0) yStart = 0;
        if (col === cols - 1) xEnd = width;
        if (row === rows - 1) yEnd = height;

        // Extract this tile from the source image
        const tileCanvas = document.createElement('canvas');
        tileCanvas.width = xEnd - xStart;
        tileCanvas.height = yEnd - yStart;
        const tileCtx = tileCanvas.getContext('2d');
        
        if (tileCtx) {
          // Draw the tile region onto the temporary canvas
          tileCtx.putImageData(
            new ImageData(
              new Uint8ClampedArray(
                image.data.slice(
                  (yStart * width + xStart) * 4,
                  (yEnd * width + xEnd) * 4
                )
              ),
              xEnd - xStart,
              yEnd - yStart
            ),
            0,
            0
          );

          // Convert the tile canvas back to ImageData for upscaling
          const tileImageData = tileCtx.getImageData(0, 0, tileCanvas.width, tileCanvas.height);
          
          // Upscale the tile
          const upscaledTile = await this.upscaleImage(tileImageData, {
            scale: opts.scale,
            crop: opts.crop,
            tileSize: 0, // Disable tiling for individual tiles
          });

          // Draw the upscaled tile to the final canvas
          ctx.putImageData(
            upscaledTile,
            xStart * opts.scale,
            yStart * opts.scale
          );
        }
      }
    }

    // Return the final combined image
    return ctx.getImageData(0, 0, scaledWidth, scaledHeight);
  }

  /**
   * Gets information about the loaded model
   * @returns Model metadata
   */
  getModelInfo(): object | null {
    if (!this.session) {
      return null;
    }

    return {
      inputNames: this.session.inputNames,
      inputShapes: this.session.inputShapes,
      inputTypes: this.session.inputTypes,
      outputNames: this.session.outputNames,
      outputShapes: this.session.outputShapes,
      outputTypes: this.session.outputTypes,
      metadata: this.session.metadata
    };
  }
}

/**
 * Convenience function to create and initialize an upscaler
 * @param modelPath Path to the ONNX model file
 * @returns Initialized RealESRGANUpscaler instance
 */
export async function createUpscaler(modelPath?: string): Promise<RealESRGANUpscaler> {
  const upscaler = new RealESRGANUpscaler(modelPath);
  await upscaler.initialize();
  return upscaler;
}