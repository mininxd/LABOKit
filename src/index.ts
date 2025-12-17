
        import { createUpscaler } from './lib/libOnnx.ts';
        
        // DOM elements
        const imageInput = document.getElementById('imageInput');
        const upscaleBtn = document.getElementById('upscaleBtn');
        const clearBtn = document.getElementById('clearBtn');
        const scaleFactorSelect = document.getElementById('scaleFactor');
        const tileSizeSelect = document.getElementById('tileSize');
        const originalCanvas = document.getElementById('originalCanvas');
        const upscaledCanvas = document.getElementById('upscaledCanvas');
        const imageContainer = document.getElementById('imageContainer');
        const progressContainer = document.getElementById('progressContainer');
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        
        let upscaler = null;
        let originalImageData = null;
        
        // Initialize the upscaler
        async function initUpscaler() {
            try {
                console.log('Initializing Real-ESRGAN upscaler...');
                upscaler = await createUpscaler();
                
                // Display model info
                console.log('Model info:', upscaler.getModelInfo());
                
                // Enable the upscale button
                upscaleBtn.disabled = false;
                console.log('Real-ESRGAN upscaler initialized successfully!');
            } catch (error) {
                console.error('Failed to initialize upscaler:', error);
                alert('Failed to initialize the upscaler. Check console for details.');
            }
        }
        
        // Draw image on canvas and store ImageData
        function loadImageOnCanvas(file) {
            const img = new Image();
            img.onload = function() {
                // Draw image on original canvas
                const ctx = originalCanvas.getContext('2d');
                originalCanvas.width = img.width;
                originalCanvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                // Get the image data
                originalImageData = ctx.getImageData(0, 0, img.width, img.height);
                
                // Show the image container
                imageContainer.style.display = 'flex';
                
                // Reset upscaled canvas
                upscaledCanvas.width = 0;
                upscaledCanvas.height = 0;
            };
            img.src = URL.createObjectURL(file);
        }
        
        // Update progress
        function updateProgress(percent) {
            progressBar.value = percent;
            progressText.textContent = `${percent}%`;
        }
        
        // Upscale the image
        async function upscaleImage() {
            if (!originalImageData || !upscaler) {
                alert('Please load an image first.');
                return;
            }
            
            try {
                // Show progress
                progressContainer.style.display = 'block';
                updateProgress(0);
                
                const scale = parseInt(scaleFactorSelect.value);
                const tileSize = parseInt(tileSizeSelect.value);
                
                // Prepare upscaling options
                const options = {
                    scale: scale,
                    tileSize: tileSize || 0 // 0 means no tiling
                };
                
                // Perform upscaling
                console.log('Starting upscaling process...');
                updateProgress(10);
                
                let upscaledImageData;
                if (tileSize > 0) {
                    upscaledImageData = await upscaler.upscaleImageTiled(originalImageData, options);
                } else {
                    upscaledImageData = await upscaler.upscaleImage(originalImageData, options);
                }
                
                updateProgress(90);
                
                // Draw the upscaled image
                const ctx = upscaledCanvas.getContext('2d');
                upscaledCanvas.width = upscaledImageData.width;
                upscaledCanvas.height = upscaledImageData.height;
                ctx.putImageData(upscaledImageData, 0, 0);
                
                updateProgress(100);
                console.log('Upscaling completed!');
                
                // Hide progress after a short delay
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                }, 1000);
                
            } catch (error) {
                console.error('Error during upscaling:', error);
                alert('Error during upscaling. Check console for details.');
                progressContainer.style.display = 'none';
            }
        }
        
        // Clear the display
        function clearDisplay() {
            originalImageData = null;
            originalCanvas.width = 0;
            originalCanvas.height = 0;
            upscaledCanvas.width = 0;
            upscaledCanvas.height = 0;
            imageContainer.style.display = 'none';
            imageInput.value = '';
        }
        
        // Event listeners
        imageInput.addEventListener('change', function(e) {
            if (e.target.files && e.target.files[0]) {
                loadImageOnCanvas(e.target.files[0]);
            }
        });
        
        upscaleBtn.addEventListener('click', upscaleImage);
        
        clearBtn.addEventListener('click', clearDisplay);
        
        // Initialize the upscaler when the page loads
        window.addEventListener('DOMContentLoaded', initUpscaler);