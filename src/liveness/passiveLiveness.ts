import { PASSIVE_MODEL_INPUT_SIZE } from './passiveCrop';

const PASSIVE_MODEL_FILENAME = 'minifasnet_int8.onnx';
const PRINT_CLASS_INDEX = 1;
const REPLAY_CLASS_INDEX = 2;

let passiveSession: any = null;

async function loadPassiveSession(): Promise<any> {
  if (passiveSession) {
    return passiveSession;
  }

  const { InferenceSession } = require('onnxruntime-react-native');
  const { Platform } = require('react-native');
  const RNFS = require('react-native-fs');

  let modelPath: string;

  if (Platform.OS === 'android') {
    const destPath = `${RNFS.DocumentDirectoryPath}/${PASSIVE_MODEL_FILENAME}`;
    const exists = await RNFS.exists(destPath);
    if (!exists) {
      await RNFS.copyFileAssets(PASSIVE_MODEL_FILENAME, destPath);
    }
    modelPath = destPath;
  } else {
    modelPath = `${RNFS.MainBundlePath}/models/${PASSIVE_MODEL_FILENAME}`;
  }

  passiveSession = await InferenceSession.create(modelPath, {
    executionProviders: ['cpu'],
  });

  return passiveSession;
}

function buildPassiveInputTensor(cropPixels: number[]): Float32Array {
  const size = PASSIVE_MODEL_INPUT_SIZE;
  const totalPixels = size * size;
  const mean = [0.406, 0.456, 0.485];
  const std = [0.225, 0.224, 0.229];
  const tensor = new Float32Array(3 * totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    tensor[i] = (cropPixels[i * 3] / 255.0 - mean[0]) / std[0];
    tensor[totalPixels + i] = (cropPixels[i * 3 + 1] / 255.0 - mean[1]) / std[1];
    tensor[2 * totalPixels + i] = (cropPixels[i * 3 + 2] / 255.0 - mean[2]) / std[2];
  }

  return tensor;
}

function softmax(logits: Float32Array): Float32Array {
  let maxVal = logits[0];
  for (let i = 1; i < logits.length; i++) {
    if (logits[i] > maxVal) {
      maxVal = logits[i];
    }
  }
  const exps = new Float32Array(logits.length);
  let sumExp = 0;
  for (let i = 0; i < logits.length; i++) {
    exps[i] = Math.exp(logits[i] - maxVal);
    sumExp += exps[i];
  }
  for (let i = 0; i < logits.length; i++) {
    exps[i] /= sumExp;
  }
  return exps;
}

export async function computePassiveLivenessScore(cropPixels: number[]): Promise<number> {
  const { Tensor } = require('onnxruntime-react-native');
  const size = PASSIVE_MODEL_INPUT_SIZE;

  const modelSession = await loadPassiveSession();
  const inputData = buildPassiveInputTensor(cropPixels);

  const inputTensor = new Tensor('float32', inputData, [1, 3, size, size]);

  const feeds: Record<string, any> = {};
  feeds[modelSession.inputNames[0]] = inputTensor;

  const results = await modelSession.run(feeds);
  const outputData = results[modelSession.outputNames[0]].data as Float32Array;
  const probs = softmax(outputData);

  const spoofProb = probs[PRINT_CLASS_INDEX] + probs[REPLAY_CLASS_INDEX];
  return 1.0 - spoofProb;
}

export function releasePassiveModel(): void {
  if (passiveSession) {
    passiveSession.release();
    passiveSession = null;
  }
}
