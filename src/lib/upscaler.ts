import * as ort from 'onnxruntime-web';
import { OnnxModel } from './onnxModel';

export interface UpscaleOptions {
  scale?: number;
  tileSize?: number;
  tileOverlap?: number;
}

export class RealESRGANUpscaler extends OnnxModel {
  constructor(modelPath: string = '/realesr-general-x4v3.onnx') {
    super(modelPath);
  }

  private preprocess(image: ImageData): ort.Tensor {
    const { width, height, data } = image;
    const rgbArray = new Float32Array(width * height * 3);

    for (let i = 0; i < width * height; i++) {
      rgbArray[i] = (data[i * 4] / 255.0) * 2.0 - 1.0;
      rgbArray[i + width * height] = (data[i * 4 + 1] / 255.0) * 2.0 - 1.0;
      rgbArray[i + width * height * 2] = (data[i * 4 + 2] / 255.0) * 2.0 - 1.0;
    }

    return new ort.Tensor('float32', rgbArray, [1, 3, height, width]);
  }

  private postprocess(
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

  async process(image: ImageData, options?: UpscaleOptions): Promise<ImageData> {
      return this.upscaleImage(image, options);
  }

  async upscaleImage(image: ImageData, options?: UpscaleOptions): Promise<ImageData> {
    if (!this.isInitialized || !this.session) {
      throw new Error('Model not initialized. Call initialize() first.');
    }

    const opts: Required<UpscaleOptions> = {
      scale: options?.scale ?? 4,
      tileSize: options?.tileSize ?? 0,
      tileOverlap: options?.tileOverlap ?? 32,
    };

    // Check if tiling is requested
    if (opts.tileSize > 0) {
        return this.upscaleImageTiled(image, opts);
    }

    const inputTensor = this.preprocess(image);

    const feeds: Record<string, ort.Tensor> = {};
    if (this.session.inputNames.length > 0) {
      feeds[this.session.inputNames[0]] = inputTensor;
    } else {
        throw new Error('Model has no recognizable input');
    }

    const results = await this.session.run(feeds);
    const outputTensor = results[this.session.outputNames[0]];

    return this.postprocess(outputTensor, image.width, image.height, opts.scale);
  }

  async upscaleImageTiled(image: ImageData, options: Required<UpscaleOptions>): Promise<ImageData> {
    const { width, height } = image;
    const scaledWidth = width * options.scale;
    const scaledHeight = height * options.scale;

    const canvas = document.createElement('canvas');
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');

    // Helper canvas to extract tiles
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    const sourceCtx = sourceCanvas.getContext('2d');
    if (!sourceCtx) throw new Error('Could not get source 2D context');
    sourceCtx.putImageData(image, 0, 0);

    const tileWidth = Math.min(options.tileSize, width);
    const tileHeight = Math.min(options.tileSize, height);
    const cols = Math.ceil(width / tileWidth);
    const rows = Math.ceil(height / tileHeight);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        let xStart = Math.max(col * tileWidth - options.tileOverlap, 0);
        let yStart = Math.max(row * tileHeight - options.tileOverlap, 0);
        let xEnd = Math.min((col + 1) * tileWidth + options.tileOverlap, width);
        let yEnd = Math.min((row + 1) * tileHeight + options.tileOverlap, height);

        // Clamp to boundaries
        if (col === 0) xStart = 0;
        if (row === 0) yStart = 0;
        if (col === cols - 1) xEnd = width;
        if (row === rows - 1) yEnd = height;

        const w = xEnd - xStart;
        const h = yEnd - yStart;

        const tileData = sourceCtx.getImageData(xStart, yStart, w, h);

        // Process tile (recursive call but with tileSize=0 to avoid infinite loop)
        const upscaledTile = await this.upscaleImage(tileData, { ...options, tileSize: 0 });

        // Draw back to main canvas
        ctx.putImageData(upscaledTile, xStart * options.scale, yStart * options.scale);
      }
    }

    return ctx.getImageData(0, 0, scaledWidth, scaledHeight);
  }
}
