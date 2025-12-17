import { createUpscaler, RealESRGANUpscaler } from './lib/libOnnx';

const imageInput = document.getElementById('imageInput') as HTMLInputElement;
const upscaleBtn = document.getElementById('upscaleBtn') as HTMLButtonElement;
const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement;
const scaleFactorSelect = document.getElementById('scaleFactor') as HTMLSelectElement;
const tileSizeSelect = document.getElementById('tileSize') as HTMLSelectElement;
const originalCanvas = document.getElementById('originalCanvas') as HTMLCanvasElement;
const upscaledCanvas = document.getElementById('upscaledCanvas') as HTMLCanvasElement;
const imageContainer = document.getElementById('imageContainer') as HTMLElement;
const progressContainer = document.getElementById('progressContainer') as HTMLElement;
const progressBar = document.getElementById('progressBar') as HTMLProgressElement;
const progressText = document.getElementById('progressText') as HTMLElement;

let upscaler: RealESRGANUpscaler | null = null;
let originalImageData: ImageData | null = null;

async function initUpscaler() {
    try {
        console.log('Initializing Real-ESRGAN upscaler...');
        upscaler = await createUpscaler();
        
        console.log('Model info:', upscaler.getModelInfo());
        
        upscaleBtn.disabled = false;
        console.log('Real-ESRGAN upscaler initialized successfully!');
    } catch (error) {
        console.error('Failed to initialize upscaler:', error);
        alert('Failed to initialize the upscaler. Check console for details.');
    }
}

function loadImageOnCanvas(file: File) {
    const img = new Image();
    img.onload = function() {
        const ctx = originalCanvas.getContext('2d');
        if (!ctx) return;
        originalCanvas.width = img.width;
        originalCanvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        originalImageData = ctx.getImageData(0, 0, img.width, img.height);
        
        imageContainer.style.display = 'flex';
        
        upscaledCanvas.width = 0;
        upscaledCanvas.height = 0;
    };
    img.src = URL.createObjectURL(file);
}

function updateProgress(percent: number) {
    progressBar.value = percent;
    progressText.textContent = `${percent}%`;
}

async function upscaleImage() {
    if (!originalImageData || !upscaler) {
        alert('Please load an image first.');
        return;
    }

    try {
        progressContainer.style.display = 'block';
        updateProgress(0);
        
        const scale = parseInt(scaleFactorSelect.value);
        const tileSize = parseInt(tileSizeSelect.value);
        
        const options = {
            scale: scale,
            tileSize: tileSize || 0
        };

        console.log('Starting upscaling process...');
        updateProgress(10);

        let upscaledImageData: ImageData;
        if (tileSize > 0) {
            upscaledImageData = await upscaler.upscaleImageTiled(originalImageData, options);
        } else {
            upscaledImageData = await upscaler.upscaleImage(originalImageData, options);
        }
        
        updateProgress(90);
        
        const ctx = upscaledCanvas.getContext('2d');
        if (!ctx) return;
        upscaledCanvas.width = upscaledImageData.width;
        upscaledCanvas.height = upscaledImageData.height;
        ctx.putImageData(upscaledImageData, 0, 0);
        
        updateProgress(100);
        console.log('Upscaling completed!');
        
        setTimeout(() => {
            progressContainer.style.display = 'none';
        }, 1000);

    } catch (error) {
        console.error('Error during upscaling:', error);
        alert('Error during upscaling. Check console for details.');
        progressContainer.style.display = 'none';
    }
}

function clearDisplay() {
    originalImageData = null;
    originalCanvas.width = 0;
    originalCanvas.height = 0;
    upscaledCanvas.width = 0;
    upscaledCanvas.height = 0;
    imageContainer.style.display = 'none';
    imageInput.value = '';
}

imageInput.addEventListener('change', function(e) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
        loadImageOnCanvas(target.files[0]);
    }
});

upscaleBtn.addEventListener('click', upscaleImage);

clearBtn.addEventListener('click', clearDisplay);

window.addEventListener('DOMContentLoaded', initUpscaler);