import { listPendingRecords, markRecordSynced } from '../record/recordQueue';
import { uploadRecord, SyncClientConfig } from './syncClient';

export interface SyncFlushResult {
  attempted: number;
  succeeded: number;
  failed: number;
  syncedIds: string[];
}

let flushInProgress = false;

export async function flushPendingRecords(
  config?: SyncClientConfig,
): Promise<SyncFlushResult> {
  if (flushInProgress) {
    return { attempted: 0, succeeded: 0, failed: 0, syncedIds: [] };
  }

  flushInProgress = true;

  const pending = await listPendingRecords();
  const result: SyncFlushResult = {
    attempted: pending.length,
    succeeded: 0,
    failed: 0,
    syncedIds: [],
  };

  for (const signed of pending) {
    try {
      const uploadResult = await uploadRecord(signed, config);
      if (uploadResult.success) {
        await markRecordSynced(signed.record.id);
        result.succeeded++;
        result.syncedIds.push(signed.record.id);
      } else {
        result.failed++;
      }
    } catch {
      result.failed++;
    }
  }

  flushInProgress = false;
  return result;
}

export function isFlushInProgress(): boolean {
  return flushInProgress;
}
