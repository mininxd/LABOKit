import torch
import torch.backends.cudnn as cudnn
from torch import nn as nn
from torch.nn import functional as F
import argparse
import os

# Disable NNPACK which is causing the issue
torch.backends.nnpack.enabled = False

# Define the SRVGGNetCompact class (copied from basicsr/realesrgan)
class SRVGGNetCompact(nn.Module):
    """A compact VGG-style network structure for super-resolution.

    It is a compact network structure, which performs upsampling in the last layer and no convolution is
    conducted on the HR feature space.
    """

    def __init__(self, num_in_ch=3, num_out_ch=3, num_feat=64, num_conv=16, upscale=4, act_type='prelu'):
        super(SRVGGNetCompact, self).__init__()
        self.num_in_ch = num_in_ch
        self.num_out_ch = num_out_ch
        self.num_feat = num_feat
        self.num_conv = num_conv
        self.upscale = upscale
        self.act_type = act_type

        self.body = nn.ModuleList()
        # the first conv
        self.body.append(nn.Conv2d(num_in_ch, num_feat, 3, 1, 1))
        # the first activation
        if act_type == 'relu':
            activation = nn.ReLU(inplace=True)
        elif act_type == 'prelu':
            activation = nn.PReLU(num_parameters=num_feat)
        elif act_type == 'leakyrelu':
            activation = nn.LeakyReLU(negative_slope=0.1, inplace=True)
        elif act_type == 'silu':
            activation = nn.SiLU(inplace=True)
        else:
            activation = nn.PReLU(num_parameters=num_feat)
        self.body.append(activation)

        # the body structure
        for _ in range(num_conv):
            self.body.append(nn.Conv2d(num_feat, num_feat, 3, 1, 1))
            # activation
            if act_type == 'relu':
                activation = nn.ReLU(inplace=True)
            elif act_type == 'prelu':
                activation = nn.PReLU(num_parameters=num_feat)
            elif act_type == 'leakyrelu':
                activation = nn.LeakyReLU(negative_slope=0.1, inplace=True)
            elif act_type == 'silu':
                activation = nn.SiLU(inplace=True)
            else:
                activation = nn.PReLU(num_parameters=num_feat)
            self.body.append(activation)

        # the last conv
        self.body.append(nn.Conv2d(num_feat, num_out_ch * upscale * upscale, 3, 1, 1))
        # upsample
        self.upsampler = nn.PixelShuffle(upscale)

    def forward(self, x):
        out = x
        for i in range(0, len(self.body)):
            out = self.body[i](out)

        out = self.upsampler(out)
        # add the nearest upsampled image, so that the network learns the residual
        base = F.interpolate(x, scale_factor=self.upscale, mode='nearest')
        out += base
        return out

def convert(model_path='realesr-general-x4v3.pth', onnx_path='realesr-general-x4v3.onnx'):
    # Check if model file exists
    if not os.path.exists(model_path):
        print(f"Model file {model_path} not found. Please make sure the file exists.")
        return

    print(f"Initializing model...")
    # Model parameters as seen in main.py
    model = SRVGGNetCompact(num_in_ch=3, num_out_ch=3, num_feat=64, num_conv=32, upscale=4, act_type='prelu')

    print(f"Loading weights from {model_path}...")
    checkpoint = torch.load(model_path, map_location='cpu')
    if 'params' in checkpoint:
        model.load_state_dict(checkpoint['params'])
    else:
        model.load_state_dict(checkpoint)

    model.eval()

    # Set the model to CPU and ensure deterministic behavior for export
    model = model.cpu()

    # Create dummy input
    # Using a small fixed size for export, but declaring dynamic axes
    dummy_input = torch.randn(1, 3, 64, 64).cpu()

    print(f"Exporting to ONNX: {onnx_path}...")
    # Using legacy exporter for better compatibility
    # opset 14 is more recent and supports more operators than opset 11
    torch.onnx.export(
        model,
        dummy_input,
        onnx_path,
        opset_version=14,  # Updated to a more recent opset version
        input_names=['input'],
        output_names=['output'],
        export_params=True,
        do_constant_folding=True,
        training=torch.onnx.TrainingMode.EVAL,
        verbose=False,  # Set to True for debugging if needed
        dynamo=False,  # Use legacy exporter
        dynamic_axes={
            'input': {0: 'batch_size', 2: 'height', 3: 'width'},
            'output': {0: 'batch_size', 2: 'out_height', 3: 'out_width'}
        }
    )

    # Verify the exported ONNX model
    try:
        import onnx
        onnx_model = onnx.load(onnx_path)
        onnx.checker.check_model(onnx_model)
        print("ONNX model exported and verified successfully!")
    except ImportError:
        print("ONNX model exported successfully! (Install onnx package to verify)")
    except Exception as e:
        print(f"Error verifying ONNX model: {e}")

    print("Conversion complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Convert PyTorch model to ONNX')
    parser.add_argument('--input', '-i', type=str, default='realesr-general-x4v3.pth',
                        help='Input PyTorch model path (default: realesr-general-x4v3.pth)')
    parser.add_argument('--output', '-o', type=str, default='realesr-general-x4v3.onnx',
                        help='Output ONNX model path (default: realesr-general-x4v3.onnx)')

    args = parser.parse_args()

    convert(args.input, args.output)
