import * as ort from 'onnxruntime-web';
import { OnnxModel } from './onnxModel';

export class BackgroundRemover extends OnnxModel {
  // u2netp takes 320x320 input
  private static readonly INPUT_SIZE = 320;

  constructor(modelPath: string = '/u2netp.onnx') {
    super(modelPath);
  }

  private preprocess(image: ImageData): ort.Tensor {
    const { width, height } = image;

    // We need to resize to INPUT_SIZE x INPUT_SIZE
    // Using a temporary canvas for resizing
    const canvas = document.createElement('canvas');
    canvas.width = BackgroundRemover.INPUT_SIZE;
    canvas.height = BackgroundRemover.INPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get context');

    // Create a temp canvas for the original image to draw it resized
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    if(!tempCtx) throw new Error("Could not get temp context");
    tempCtx.putImageData(image, 0, 0);

    ctx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, BackgroundRemover.INPUT_SIZE, BackgroundRemover.INPUT_SIZE);

    const resizedData = ctx.getImageData(0, 0, BackgroundRemover.INPUT_SIZE, BackgroundRemover.INPUT_SIZE);
    const float32Data = new Float32Array(3 * BackgroundRemover.INPUT_SIZE * BackgroundRemover.INPUT_SIZE);

    // Normalize: (x - mean) / std
    // u2netp mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];

    for (let i = 0; i < BackgroundRemover.INPUT_SIZE * BackgroundRemover.INPUT_SIZE; i++) {
       const r = resizedData.data[i*4] / 255.0;
       const g = resizedData.data[i*4+1] / 255.0;
       const b = resizedData.data[i*4+2] / 255.0;

       float32Data[i] = (r - mean[0]) / std[0];
       float32Data[i + BackgroundRemover.INPUT_SIZE * BackgroundRemover.INPUT_SIZE] = (g - mean[1]) / std[1];
       float32Data[i + 2 * BackgroundRemover.INPUT_SIZE * BackgroundRemover.INPUT_SIZE] = (b - mean[2]) / std[2];
    }

    return new ort.Tensor('float32', float32Data, [1, 3, BackgroundRemover.INPUT_SIZE, BackgroundRemover.INPUT_SIZE]);
  }

  private postprocess(outputTensor: ort.Tensor, originalImage: ImageData): ImageData {
      // output is 1, 1, 320, 320 probability map
      const pred = outputTensor.data as Float32Array;

      // We need to resize the mask back to original size
      // We can do this by drawing the mask to a canvas and scaling it up
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = BackgroundRemover.INPUT_SIZE;
      maskCanvas.height = BackgroundRemover.INPUT_SIZE;
      const maskCtx = maskCanvas.getContext('2d');
      if(!maskCtx) throw new Error("Could not get mask context");

      const maskImageData = maskCtx.createImageData(BackgroundRemover.INPUT_SIZE, BackgroundRemover.INPUT_SIZE);

      // Find min/max for normalization if needed, but usually it's sigmoid output or raw logits
      // u2net output is usually logits, so we apply sigmoid?
      // Or check if model output is already sigmoid. standard u2net is logits.
      // But let's assume raw values need min-max normalization if they are not 0-1.
      // Actually standard rembg/u2net returns probability 0-1.

      let min = Infinity;
      let max = -Infinity;
      for(let i=0; i<pred.length; i++) {
          if(pred[i] < min) min = pred[i];
          if(pred[i] > max) max = pred[i];
      }

      for (let i = 0; i < pred.length; i++) {
          // Normalize to 0-255
          let val = (pred[i] - min) / (max - min);
          // clamp
          if (val < 0) val = 0;
          if (val > 1) val = 1;

          const alpha = Math.round(val * 255);
          maskImageData.data[i*4] = alpha; // R
          maskImageData.data[i*4+1] = alpha; // G
          maskImageData.data[i*4+2] = alpha; // B
          maskImageData.data[i*4+3] = 255; // Alpha
      }
      maskCtx.putImageData(maskImageData, 0, 0);

      // Now combine with original image
      const resultCanvas = document.createElement('canvas');
      resultCanvas.width = originalImage.width;
      resultCanvas.height = originalImage.height;
      const resultCtx = resultCanvas.getContext('2d');
      if(!resultCtx) throw new Error("Could not get result context");

      // Draw original image
      const tempOrigCanvas = document.createElement('canvas');
      tempOrigCanvas.width = originalImage.width;
      tempOrigCanvas.height = originalImage.height;
      tempOrigCanvas.getContext('2d')?.putImageData(originalImage, 0, 0);

      resultCtx.drawImage(tempOrigCanvas, 0, 0);

      // Draw mask into a separate canvas and resize to original
      const scaledMaskCanvas = document.createElement('canvas');
      scaledMaskCanvas.width = originalImage.width;
      scaledMaskCanvas.height = originalImage.height;
      const scaledMaskCtx = scaledMaskCanvas.getContext('2d');
      if(!scaledMaskCtx) throw new Error("Could not get scaled mask context");

      // Use higher quality smoothing
      scaledMaskCtx.imageSmoothingEnabled = true;
      scaledMaskCtx.imageSmoothingQuality = 'high';
      scaledMaskCtx.drawImage(maskCanvas, 0, 0, originalImage.width, originalImage.height);

      const scaledMaskData = scaledMaskCtx.getImageData(0, 0, originalImage.width, originalImage.height);
      const originalData = resultCtx.getImageData(0, 0, originalImage.width, originalImage.height);

      // Apply mask to alpha channel of original image
      for(let i=0; i < originalData.data.length; i+=4) {
           // We use the red channel of the mask (grayscale) as alpha
           originalData.data[i+3] = scaledMaskData.data[i];
      }

      return originalData;
  }

  async process(image: ImageData): Promise<ImageData> {
    if (!this.isInitialized || !this.session) {
      throw new Error('Model not initialized');
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

    return this.postprocess(outputTensor, image);
  }
}
