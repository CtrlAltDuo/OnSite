import { DEFAULT_MATCH_THRESHOLD, MatchResult } from '../onsite/coreTypes';

export function cosineSimilarityBetweenEmbeddings(
  embeddingA: Float32Array,
  embeddingB: Float32Array,
): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < embeddingA.length; i++) {
    dotProduct += embeddingA[i] * embeddingB[i];
    normA += embeddingA[i] * embeddingA[i];
    normB += embeddingB[i] * embeddingB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);

  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

export function isMatchAboveThreshold(
  similarity: number,
  threshold: number = DEFAULT_MATCH_THRESHOLD,
): boolean {
  return similarity >= threshold;
}

export function buildMatchResult(
  similarity: number,
  workerId: string | null,
  threshold: number = DEFAULT_MATCH_THRESHOLD,
): MatchResult {
  return {
    matched: isMatchAboveThreshold(similarity, threshold),
    similarity,
    threshold,
    workerId,
  };
}
