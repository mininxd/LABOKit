import { RealESRGANUpscaler } from './lib/upscaler';
import { BackgroundRemover } from './lib/backgroundRemover';

// Elements
const imageInput = document.getElementById('imageInput') as HTMLInputElement;
const upscaleBtn = document.getElementById('upscaleBtn') as HTMLButtonElement;
const removeBgBtn = document.getElementById('removeBgBtn') as HTMLButtonElement;
const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement;
const scaleFactorSelect = document.getElementById('scaleFactor') as HTMLSelectElement;
const tileSizeSelect = document.getElementById('tileSize') as HTMLSelectElement;
const originalCanvas = document.getElementById('originalCanvas') as HTMLCanvasElement;
const resultCanvas = document.getElementById('resultCanvas') as HTMLCanvasElement;
const imageContainer = document.getElementById('imageContainer') as HTMLElement;
const progressContainer = document.getElementById('progressContainer') as HTMLElement;
const progressBar = document.getElementById('progressBar') as HTMLProgressElement;
const progressText = document.getElementById('progressText') as HTMLElement;
const statusMessage = document.getElementById('statusMessage') as HTMLElement;

let upscaler: RealESRGANUpscaler | null = null;
let backgroundRemover: BackgroundRemover | null = null;
let originalImageData: ImageData | null = null;

async function initModels() {
    try {
        statusMessage.textContent = 'Initializing models...';

        upscaler = new RealESRGANUpscaler();
        await upscaler.initialize();
        console.log('Upscaler initialized');

        backgroundRemover = new BackgroundRemover();
        await backgroundRemover.initialize();
        console.log('Background Remover initialized');

        upscaleBtn.disabled = false;
        removeBgBtn.disabled = false;
        statusMessage.textContent = 'Models ready!';
    } catch (error) {
        console.error('Failed to initialize models:', error);
        statusMessage.textContent = 'Failed to load models. Check console.';
    }
}

function loadImageOnCanvas(file: File) {
    const img = new Image();
    img.onload = function() {
        const ctx = originalCanvas.getContext('2d');
        if (!ctx) return;

        // Max display size logic could go here if needed, but let's keep it simple
        originalCanvas.width = img.width;
        originalCanvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        originalImageData = ctx.getImageData(0, 0, img.width, img.height);
        
        imageContainer.style.display = 'flex';
        
        // Clear result
        resultCanvas.width = 0;
        resultCanvas.height = 0;
    };
    img.src = URL.createObjectURL(file);
}

function updateProgress(percent: number, text?: string) {
    progressBar.value = percent;
    if (text) progressText.textContent = text;
    else progressText.textContent = `${percent}%`;
}

async function handleUpscale() {
    if (!originalImageData || !upscaler) {
        alert('Please load an image first.');
        return;
    }

    try {
        progressContainer.style.display = 'block';
        updateProgress(10, 'Preprocessing...');
        
        const scale = parseInt(scaleFactorSelect.value);
        const tileSize = parseInt(tileSizeSelect.value);
        
        const options = {
            scale: scale,
            tileSize: tileSize || 0
        };

        console.log('Starting upscaling...');
        updateProgress(20, 'Upscaling (this may take a while)...');

        // Allow UI to update
        await new Promise(r => setTimeout(r, 100));

        const resultImageData = await upscaler.process(originalImageData, options);
        
        updateProgress(90, 'Rendering...');
        
        const ctx = resultCanvas.getContext('2d');
        if (!ctx) return;
        resultCanvas.width = resultImageData.width;
        resultCanvas.height = resultImageData.height;
        ctx.putImageData(resultImageData, 0, 0);
        
        updateProgress(100, 'Done!');
        console.log('Upscaling completed!');
        
        setTimeout(() => {
            progressContainer.style.display = 'none';
        }, 2000);

    } catch (error) {
        console.error('Error during upscaling:', error);
        alert('Error during upscaling. Check console for details.');
        progressContainer.style.display = 'none';
    }
}

async function handleRemoveBackground() {
    if (!originalImageData || !backgroundRemover) {
        alert('Please load an image first.');
        return;
    }

    try {
        progressContainer.style.display = 'block';
        updateProgress(10, 'Preprocessing...');

        console.log('Starting background removal...');
        updateProgress(30, 'Removing background...');

        // Allow UI to update
        await new Promise(r => setTimeout(r, 100));

        const resultImageData = await backgroundRemover.process(originalImageData);

        updateProgress(90, 'Rendering...');

        const ctx = resultCanvas.getContext('2d');
        if (!ctx) return;
        resultCanvas.width = resultImageData.width;
        resultCanvas.height = resultImageData.height;
        ctx.putImageData(resultImageData, 0, 0);

        updateProgress(100, 'Done!');
        console.log('Background removal completed!');

        setTimeout(() => {
            progressContainer.style.display = 'none';
        }, 2000);

    } catch (error) {
        console.error('Error during background removal:', error);
        alert('Error during background removal. Check console for details.');
        progressContainer.style.display = 'none';
    }
}

function clearDisplay() {
    originalImageData = null;
    originalCanvas.width = 0;
    originalCanvas.height = 0;
    resultCanvas.width = 0;
    resultCanvas.height = 0;
    imageContainer.style.display = 'none';
    imageInput.value = '';
    progressContainer.style.display = 'none';
}

imageInput.addEventListener('change', function(e) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
        loadImageOnCanvas(target.files[0]);
    }
});

upscaleBtn.addEventListener('click', handleUpscale);
removeBgBtn.addEventListener('click', handleRemoveBackground);
clearBtn.addEventListener('click', clearDisplay);

window.addEventListener('DOMContentLoaded', initModels);
