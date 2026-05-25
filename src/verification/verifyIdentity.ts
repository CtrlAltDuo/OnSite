import { MatchResult, DEFAULT_MATCH_THRESHOLD } from '../onsite/coreTypes';
import { deriveEmbeddingFromCrop } from '../recognition/embeddingModel';
import {
  cosineSimilarityBetweenEmbeddings,
  buildMatchResult,
} from '../recognition/matcher';
import {
  loadEncryptedTemplate,
  listEnrolledWorkerIds,
} from '../storage/encryptedStore';

export async function verifyAgainstEnrolledWorker(
  alignedPixels: number[],
  workerId: string,
  threshold: number = DEFAULT_MATCH_THRESHOLD,
): Promise<MatchResult> {
  const storedEmbedding = await loadEncryptedTemplate(workerId);

  if (!storedEmbedding) {
    return buildMatchResult(0, workerId, threshold);
  }

  const liveEmbedding = await deriveEmbeddingFromCrop(alignedPixels);
  const similarity = cosineSimilarityBetweenEmbeddings(
    liveEmbedding,
    storedEmbedding,
  );

  return buildMatchResult(similarity, workerId, threshold);
}

export async function verifyAgainstAllEnrolled(
  alignedPixels: number[],
  threshold: number = DEFAULT_MATCH_THRESHOLD,
): Promise<MatchResult> {
  const workerIds = await listEnrolledWorkerIds();
  const liveEmbedding = await deriveEmbeddingFromCrop(alignedPixels);

  let bestSimilarity = -1;
  let bestWorkerId: string | null = null;

  for (const wid of workerIds) {
    const storedEmbedding = await loadEncryptedTemplate(wid);
    if (!storedEmbedding) {
      continue;
    }

    const similarity = cosineSimilarityBetweenEmbeddings(
      liveEmbedding,
      storedEmbedding,
    );

    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestWorkerId = wid;
    }
  }

  if (bestWorkerId === null) {
    return buildMatchResult(0, null, threshold);
  }

  return buildMatchResult(bestSimilarity, bestWorkerId, threshold);
}
