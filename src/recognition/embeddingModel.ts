import { ALIGNED_FACE_SIZE, EMBEDDING_DIMENSION } from '../onsite/coreTypes';

let session: any = null;

async function loadModelSession(): Promise<any> {
  if (session) {
    return session;
  }

  const { InferenceSession } = require('onnxruntime-react-native');
  const { Platform } = require('react-native');
  const RNFS = require('react-native-fs');

  const modelFileName = 'sface_int8.onnx';
  let modelPath: string;

  if (Platform.OS === 'android') {
    const destPath = `${RNFS.DocumentDirectoryPath}/${modelFileName}`;
    const exists = await RNFS.exists(destPath);
    if (!exists) {
      await RNFS.copyFileAssets(modelFileName, destPath);
    }
    modelPath = destPath;
  } else {
    modelPath = `${RNFS.MainBundlePath}/models/${modelFileName}`;
  }

  session = await InferenceSession.create(modelPath, {
    executionProviders: ['cpu'],
  });

  return session;
}

function normalizePixelsForModel(
  pixels: number[],
): Float32Array {
  const totalPixels = ALIGNED_FACE_SIZE * ALIGNED_FACE_SIZE;
  const channelSize = totalPixels;
  const inputTensor = new Float32Array(3 * totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    inputTensor[i] = pixels[i * 3] / 255.0;
    inputTensor[channelSize + i] = pixels[i * 3 + 1] / 255.0;
    inputTensor[2 * channelSize + i] = pixels[i * 3 + 2] / 255.0;
  }

  return inputTensor;
}

function l2Normalize(embedding: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < embedding.length; i++) {
    norm += embedding[i] * embedding[i];
  }
  norm = Math.sqrt(norm);

  if (norm === 0) {
    return embedding;
  }

  const normalized = new Float32Array(embedding.length);
  for (let i = 0; i < embedding.length; i++) {
    normalized[i] = embedding[i] / norm;
  }

  return normalized;
}

export async function deriveEmbeddingFromCrop(
  alignedPixels: number[],
): Promise<Float32Array> {
  const { Tensor } = require('onnxruntime-react-native');

  const modelSession = await loadModelSession();
  const inputData = normalizePixelsForModel(alignedPixels);

  const inputTensor = new Tensor(
    'float32',
    inputData,
    [1, 3, ALIGNED_FACE_SIZE, ALIGNED_FACE_SIZE],
  );

  const outputNames = modelSession.outputNames;
  const feeds: Record<string, any> = {};
  feeds[modelSession.inputNames[0]] = inputTensor;

  const results = await modelSession.run(feeds);
  const outputData = results[outputNames[0]].data as Float32Array;

  const embedding = new Float32Array(EMBEDDING_DIMENSION);
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    embedding[i] = outputData[i];
  }

  return l2Normalize(embedding);
}

export function releaseModel(): void {
  if (session) {
    session.release();
    session = null;
  }
}
