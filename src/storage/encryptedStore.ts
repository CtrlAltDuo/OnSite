import { getOrCreateEncryptionKey } from './secureKey';
import RNFS from 'react-native-fs';

const STORE_DIRECTORY = 'onsite_templates';

function hexToBytes(hex: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substring(i, i + 2), 16));
  }
  return bytes;
}

function bytesToHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

function xorEncryptDecrypt(data: number[], keyBytes: number[]): number[] {
  const result = new Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  return result;
}

function float32ArrayToBytes(arr: Float32Array): number[] {
  const buffer = arr.buffer;
  const view = new Uint8Array(buffer);
  return Array.from(view);
}

function bytesToFloat32Array(bytes: number[]): Float32Array {
  const uint8 = new Uint8Array(bytes);
  return new Float32Array(uint8.buffer);
}

async function ensureStoreDirectory(): Promise<string> {
  const dirPath = `${RNFS.DocumentDirectoryPath}/${STORE_DIRECTORY}`;
  const exists = await RNFS.exists(dirPath);
  if (!exists) {
    await RNFS.mkdir(dirPath);
  }
  return dirPath;
}

function templateFilePath(storeDir: string, workerId: string): string {
  const sanitized = workerId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${storeDir}/${sanitized}.enc`;
}

export async function storeEncryptedTemplate(
  workerId: string,
  embedding: Float32Array,
): Promise<void> {
  const key = await getOrCreateEncryptionKey();
  const keyBytes = hexToBytes(key);
  const dataBytes = float32ArrayToBytes(embedding);
  const encrypted = xorEncryptDecrypt(dataBytes, keyBytes);
  const hexString = bytesToHex(encrypted);

  const storeDir = await ensureStoreDirectory();
  const filePath = templateFilePath(storeDir, workerId);
  await RNFS.writeFile(filePath, hexString, 'utf8');
}

export async function loadEncryptedTemplate(
  workerId: string,
): Promise<Float32Array | null> {
  const storeDir = await ensureStoreDirectory();
  const filePath = templateFilePath(storeDir, workerId);

  const exists = await RNFS.exists(filePath);
  if (!exists) {
    return null;
  }

  const hexString = await RNFS.readFile(filePath, 'utf8');
  const encryptedBytes = hexToBytes(hexString);

  const key = await getOrCreateEncryptionKey();
  const keyBytes = hexToBytes(key);
  const decrypted = xorEncryptDecrypt(encryptedBytes, keyBytes);

  return bytesToFloat32Array(decrypted);
}

export async function hasStoredTemplate(workerId: string): Promise<boolean> {
  const storeDir = await ensureStoreDirectory();
  const filePath = templateFilePath(storeDir, workerId);
  return RNFS.exists(filePath);
}

export async function deleteStoredTemplate(workerId: string): Promise<void> {
  const storeDir = await ensureStoreDirectory();
  const filePath = templateFilePath(storeDir, workerId);
  const exists = await RNFS.exists(filePath);
  if (exists) {
    await RNFS.unlink(filePath);
  }
}

export async function listEnrolledWorkerIds(): Promise<string[]> {
  const storeDir = await ensureStoreDirectory();
  const files = await RNFS.readDir(storeDir);
  return files
    .filter((f: any) => f.name.endsWith('.enc'))
    .map((f: any) => f.name.replace('.enc', ''));
}
