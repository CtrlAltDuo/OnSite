import { storeEncryptedTemplate } from '../storage/encryptedStore';
import { deriveEmbeddingFromCrop } from '../recognition/embeddingModel';

export async function enrolFaceForWorker(
  workerId: string,
  alignedPixels: number[],
): Promise<void> {
  const embedding = await deriveEmbeddingFromCrop(alignedPixels);
  await storeEncryptedTemplate(workerId, embedding);
}
