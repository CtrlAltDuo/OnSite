# Model Regeneration Guide

## Source Model

The recognition model is **OpenCV SFace** (MobileFaceNet trained with SFace loss).

Download the original model from the OpenCV model zoo:
https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface

Direct download:
```
wget https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx
```

## Quantising to INT8

### Prerequisites

```
pip install onnx onnxruntime opencv-python
```

### Convert

```
python convert_model.py \
  --input face_recognition_sface_2021dec.onnx \
  --output ../assets/models/sface_int8.onnx
```

The output model should be approximately 1-2 MB.

## Model Specifications

| Property | Value |
|---|---|
| Input shape | `[1, 3, 112, 112]` (NCHW, float32, 0-1 normalised) |
| Output shape | `[1, 512]` (float32 embedding) |
| Alignment | 5-point similarity warp to 112×112 |
| Reference landmarks | See `src/recognition/alignFace.ts` |
| Embedding | L2-normalised 512-d vector |
| Comparison | Cosine similarity |
| Default threshold | 0.4 (configurable in `src/onsite/coreTypes.ts`) |

## Placing the Model

After generating or downloading the model, place it at:
```
assets/models/sface_int8.onnx
```

For Android, the model is copied from assets at runtime.
For iOS, the model is included in the main bundle under `models/`.
