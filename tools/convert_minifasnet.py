"""
Regenerate minifasnet_int8.onnx for the OnSite passive liveness module.

Requirements:
    pip install torch torchvision onnx onnxruntime

The Silent-Face-Anti-Spoofing project (Apache-2.0) weights are required.
Clone https://github.com/minivision-ai/Silent-Face-Anti-Spoofing and place
the MiniFASNetV1SE checkpoint at:
    ./Silent-Face-Anti-Spoofing/resources/anti_spoof_models/2.7_80x80_MiniFASNetV1SE.pth
"""

import sys
import os
import struct
import torch
import torch.nn as nn
import onnx
from onnxruntime.quantization import quantize_dynamic, QuantType

SILENT_FACE_ROOT = os.path.join(os.path.dirname(__file__), "Silent-Face-Anti-Spoofing")
CHECKPOINT = os.path.join(
    SILENT_FACE_ROOT,
    "resources",
    "anti_spoof_models",
    "2.7_80x80_MiniFASNetV1SE.pth",
)
EXPORT_ONNX = os.path.join(os.path.dirname(__file__), "minifasnet_fp32.onnx")
OUTPUT_INT8 = os.path.join(
    os.path.dirname(__file__),
    "..",
    "assets",
    "models",
    "minifasnet_int8.onnx",
)

INPUT_SIZE = 80
NUM_CLASSES = 3


def load_minifasnet(checkpoint_path: str) -> nn.Module:
    sys.path.insert(0, SILENT_FACE_ROOT)
    from src.model_lib.MiniFASNet import MiniFASNetV1SE

    model = MiniFASNetV1SE(conv6_kernel=(5, 5), num_classes=NUM_CLASSES)
    state = torch.load(checkpoint_path, map_location="cpu")
    state_dict = state.get("state_dict", state)
    clean = {k.replace("module.", ""): v for k, v in state_dict.items()}
    model.load_state_dict(clean)
    model.eval()
    return model


def export_to_onnx(model: nn.Module, onnx_path: str) -> None:
    dummy = torch.zeros(1, 3, INPUT_SIZE, INPUT_SIZE)
    torch.onnx.export(
        model,
        dummy,
        onnx_path,
        input_names=["input"],
        output_names=["logits"],
        dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=17,
    )


def quantize_int8(fp32_path: str, int8_path: str) -> None:
    os.makedirs(os.path.dirname(int8_path), exist_ok=True)
    quantize_dynamic(
        model_input=fp32_path,
        model_output=int8_path,
        weight_type=QuantType.QUInt8,
    )


def verify_output(int8_path: str) -> None:
    import onnxruntime as ort
    import numpy as np

    sess = ort.InferenceSession(int8_path, providers=["CPUExecutionProvider"])
    dummy = np.zeros((1, 3, INPUT_SIZE, INPUT_SIZE), dtype=np.float32)
    out = sess.run(None, {"input": dummy})
    assert out[0].shape == (1, NUM_CLASSES), f"Unexpected output shape: {out[0].shape}"
    size_kb = os.path.getsize(int8_path) / 1024
    print(f"Output shape: {out[0].shape}")
    print(f"Model size: {size_kb:.1f} KB")
    assert size_kb < 2048, f"Model too large: {size_kb:.1f} KB (target ~1700 KB)"


if __name__ == "__main__":
    if not os.path.exists(CHECKPOINT):
        print(f"Checkpoint not found at: {CHECKPOINT}")
        print("Clone https://github.com/minivision-ai/Silent-Face-Anti-Spoofing")
        print("and place the checkpoint at the path above.")
        sys.exit(1)

    print("Loading MiniFASNetV1SE…")
    model = load_minifasnet(CHECKPOINT)

    print("Exporting to ONNX fp32…")
    export_to_onnx(model, EXPORT_ONNX)

    print("Quantising to int8…")
    quantize_int8(EXPORT_ONNX, OUTPUT_INT8)

    print("Verifying…")
    verify_output(OUTPUT_INT8)

    os.remove(EXPORT_ONNX)
    print(f"Done. Model written to: {OUTPUT_INT8}")
