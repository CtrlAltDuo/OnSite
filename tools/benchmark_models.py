import onnxruntime as ort
import numpy as np
import time

def benchmark_model(model_path, input_shape, num_runs=100):
    try:
        session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
    except Exception as e:
        print(f"Failed to load {model_path}: {e}")
        return

    input_name = session.get_inputs()[0].name

    # Warmup
    dummy_input = np.random.rand(*input_shape).astype(np.float32)
    for _ in range(10):
        session.run(None, {input_name: dummy_input})

    # Benchmark
    start_time = time.time()
    for _ in range(num_runs):
        session.run(None, {input_name: dummy_input})
    end_time = time.time()

    avg_time = (end_time - start_time) / num_runs * 1000
    print(f"Model: {model_path}")
    print(f"Average CPU inference latency over {num_runs} runs: {avg_time:.2f} ms")
    print("-" * 30)

if __name__ == "__main__":
    sface_path = 'assets/models/sface_int8.onnx'
    minifasnet_path = 'assets/models/minifasnet_int8.onnx'

    try:
        benchmark_model(sface_path, (1, 3, 112, 112))
    except Exception as e:
        print(f"Error benchmarking SFace: {e}")

    try:
        benchmark_model(minifasnet_path, (1, 3, 80, 80))
    except Exception as e:
        print(f"Error benchmarking MiniFASNet: {e}")
