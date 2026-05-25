import argparse
import sys
from pathlib import Path


def convert_to_int8(input_path: str, output_path: str) -> None:
    try:
        import onnx
        from onnxruntime.quantization import quantize_dynamic, QuantType
    except ImportError:
        print("Install required packages: pip install onnx onnxruntime")
        sys.exit(1)

    model = onnx.load(input_path)
    onnx.checker.check_model(model)

    quantize_dynamic(
        input_path,
        output_path,
        weight_type=QuantType.QInt8,
    )

    quantized = onnx.load(output_path)
    onnx.checker.check_model(quantized)
    print(f"Quantised model saved to {output_path}")
    print(f"Original size: {Path(input_path).stat().st_size / 1024:.1f} KB")
    print(f"Quantised size: {Path(output_path).stat().st_size / 1024:.1f} KB")


def main():
    parser = argparse.ArgumentParser(
        description="Convert SFace model to INT8 ONNX"
    )
    parser.add_argument("--input", required=True, help="Path to input ONNX model")
    parser.add_argument("--output", required=True, help="Path to output INT8 ONNX model")
    args = parser.parse_args()

    convert_to_int8(args.input, args.output)


if __name__ == "__main__":
    main()
