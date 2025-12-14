# LABOKit v2.0

<img width="1365" height="416" alt="Banner" src="https://github.com/user-attachments/assets/f4ab1e1b-de1c-4a0f-a648-25b210f0ea4f" />

**LABOKit** is a modular desktop tool for offline image processing Built with Python (PySide6), it aims to provide a fast, simple, and user-friendly batch-processing workflow with a retro "Steins;Gate" divergence meter aesthetic.

> *"El Psy Kongroo."*

## Features

* **User-Friendly & Fast:** Designed for simplicity and speed. Just load your images and click.
* **Batch Background Removal:** Powered by `rembg` (U^2-Net).
* **Batch Upscaling (Hybrid):** Supports both GPU (Vulkan) and CPU (PyTorch) processing.
* **ImageLAB:** Built-in editor for creative effects and glitches.
* **World Line Meter:** Visual decoration displaying divergence numbers.
* **Plugin System:** Extend functionality using `.kit` files.
* **Offline Mode:** All processing is done locally on your machine.

<img width="1134" height="473" alt="Screen1" src="https://github.com/user-attachments/assets/580a586d-b778-41c3-a8e5-8692be7f370b" />
<img width="1132" height="476" alt="Screen2" src="https://github.com/user-attachments/assets/de3e61d1-d1b8-419f-9e70-94a95c63830d" />

## What's New in v2.0
**Release Date:** 16 December 2025

* **New Feature: ImageLAB:** A built-in image editor playground! Add effects like Pattern Overlay, Partial Color, Artifact Glitch, and Randomizer to your images.
* **CPU-Friendly Upscaling:** Added `realesr-general-x4v3` model. This allows upscaling on computers *without* Vulkan GPUs (Low-end PC friendly).
* **ONNX Loader Plugin:** Load your own custom `.onnx` upscaling models. LABOKit now serves as a GUI for your personal models.
* **UI Overhaul:** Significant improvements to the overall user interface for a cleaner look.
* **Auto-Updates:** Get notified when a new version of LABOKit is available. Plus, installed plugins now **update automatically**, eliminating manual redownloads.
* ** Plugin Improvements:**
    * **Dithering FX:** Refreshed UI, improved dithering results, and added more configuration options.
    * **Quick Vector:** Added **Zoom** feature to inspect vector details.
    * **Image Converter:** Fixed Transparency Glitch when converting PNG to JPG.
* **General:** Minor bug fixes and performance improvements.

<img width="1220" height="824" alt="v2_Screen1" src="https://github.com/user-attachments/assets/e81a883e-1717-44b6-b6f0-01d487c2c131" />
<img width="1213" height="816" alt="v2_Screen2" src="https://github.com/user-attachments/assets/d060263c-a7f8-4d3f-9463-fafcdade7ecf" />
<img width="1221" height="827" alt="v2_Screen3" src="https://github.com/user-attachments/assets/1c40365f-c567-4273-8c5a-f1707329bfcb" />

## 📥 Download (Portable Version)

1.  Go to the **[Releases](https://github.com/wagakano/LABOKit/releases)** page.
2.  Download the `LABOKit_v2.0.exe` (or latest version).
3.  Run `LABOKit.exe` and enjoy! (☆▽☆)

> **⚠️ Hardware Requirement:**
> LABOKit processes everything locally using advanced AI models.
> * **Standard Upscaling (x4plus):** Requires a **Vulkan-compatible GPU**.
> * **CPU Upscaling (General x4v3):** Works on **any computer** (including non-Vulkan/Integrated Graphics).
> * **Performance:** High-end PCs will process images instantly. Low-end PCs may experience longer processing times during upscaling.

## Plugins
LABOKit capabilities can be extended using `.kit` plugins.

### How to Install Plugins (.kit)
1.  Open **LABOKit**.
2.  Go to menu **Config** > **Load Plugin (.kit)...**
3.  Select the plugin file. It will be installed permanently.
*(To uninstall, simply delete the file from the plugins folder via **Config > Open Plugins Folder**).*

## Available Plugin
### 1. Video Upscaler
**File:** **[VideoUpscaler.kit](https://github.com/wagakano/LABOKit/releases)**
**Status:** Released

Upscale video files significantly using the power of **Real-ESRGAN** and **FFmpeg**. This plugin automates the complex process of frame-by-frame AI enhancement.

**Workflow:**
1.  **Extract:** Breaks down the video into individual frames.
2.  **Upscale:** Processes frames in batch using AI models (Scale 2x - 4x).
3.  **Merge:** Recombines frames into a video file while preserving the original audio.

> **⚠️ Note:** This process is resource-intensive (GPU/CPU) and may take a long time depending on the video length and upscaling factor.

<img width="1134" height="467" alt="VideoUpscaler" src="https://github.com/user-attachments/assets/d327ebd1-9a5c-444d-8328-715bfe11f045" />

### 2. ONNX Loader
**Status:** Released

A bridge for advanced users. Allows you to load external `.onnx` Upscaler models into LABOKit's interface, making it easy to test and use custom models found online.

## Advanced Plugins
Also you can get the **Advanced Plugin Bundle** by supporting the development (Donation/Pay What You Want).

### 1. Quick Vector
Turn your raster images (JPG/PNG/BMP) into scalable vector graphics (SVG) instantly. (Batch-able!)
* **Best for:** Logos, icons, signatures, and black & white line art.
* **Features:** Threshold slider, smoothness control, real-time binary preview, Zoom inspection, and batch processing.

<img width="1132" height="560" alt="QuickVector" src="https://github.com/user-attachments/assets/a13e5f55-bd17-40ca-841f-e1c001506a14" />

### 2. Dithering FX
Give your images a stunning retro aesthetic. Apply old-school shading and color palettes inspired by vintage hardware. (Batch-able!)
* **Styles:** GameBoy (Classic/Pocket), Macintosh 1-Bit, Cyberpunk, and Halftone.
* **Algorithms:** Floyd-Steinberg, Bayer Matrix (Ordered), and Noise.
* **STEINS;GATE Special:** Unique "Glitch" animation on the World Line Meter.

* 🍌 If you're from r/steinsgate, you can get this Plugin for free! Just DM me your email (u/Lazy-Time-1807) and I'll send the .kit to you.

![Dithering FX Preview](gif/Dithering_FX_Preview.gif)

### 3. Image Converter
Batch convert WebP/JPG/PNG/ICO/BMP with quality control and transparency handling. (Batch-able!)
* **Formats:** JPG, PNG, WEBP, BMP, ICO.
* **Features:** Auto-flatten transparency, quality sliders for compression, and detailed file info inspector.

<img width="1134" height="475" alt="ImageConverter" src="https://github.com/user-attachments/assets/c974205b-f711-4a89-ae20-9cbd2cfd3dad" />

## 💖 Support & Rewards
**Donate & Get the Plugins**

[![Ko-fi](https://img.shields.io/badge/Ko--fi-F16063?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/s/a367e473fe)
[![Trakteer](https://img.shields.io/badge/Trakteer-C32aa3?style=for-the-badge&logo=trakteer&logoColor=white)](https://trakteer.id/kano-bbif7/showcase/labokit-advanced-plugins-m84J6)

LABOKit is free and open-source. By purchasing this bundle (Pay What You Want), you directly support the maintenance of the app and the creation of future tools. Thank you! ( ´∀｀ )b

*By supporting, you get the `LABOKit_Advanced_Plugins.zip` containing all 3 plugins above.*

## Developer Setup (Source Code)
> **⚠️ Note:** You do NOT need to follow these steps if you just want to use the app. Please download the ready-to-use .exe from the **[Releases](https://github.com/wagakano/LABOKit/releases)** Page.

### Prerequisites
* Python 3.10+
* Windows (Recommended)

### Setup
1.  Clone the repository:
    ```bash
    git clone [https://github.com/wagakano/LABOKit.git](https://github.com/wagakano/LABOKit.git)
    cd LABOKit
    ```

2.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
    *(Note: PyTorch and RealESRGAN modules are required for full feature support)*

3.  **Model Setup**
    * LABOKit will attempt to download necessary models on the first run.
    * For the Upscaler, ensure the `realesrgan_ncnn` folder (containing the executable) and the `models` folder (containing .pth files) are correctly placed in the project directory.

4.  Run the application:
    ```bash
    python main.py
    ```

## How to Use
> A detailed user guide explaining all terms and features is available directly inside the app. Just go to the **Help** menu in the top bar!

## 📄 License & Credits
See [LABOKit_NOTICE.txt](LABOKit_NOTICE.txt) for detailed license information regarding third-party components (rembg, Real-ESRGAN, Qt, etc.).

**LABOKit** is a fan-inspired tool and is not affiliated with the creators of Steins;Gate.