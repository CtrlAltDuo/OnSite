import { listAllRecords, removeRecord } from '../record/recordQueue';
import { deleteStoredTemplate } from '../storage/encryptedStore';

export interface PurgeTarget {
  recordId: string;
  workerId: string;
  syncStatus: 'pending' | 'synced';
}

export interface PurgeResult {
  purgedRecordIds: string[];
  purgedWorkerTemplates: string[];
  skippedPendingCount: number;
}

export async function listPurgeTargets(): Promise<PurgeTarget[]> {
  const all = await listAllRecords();
  return all.map(r => ({
    recordId: r.record.id,
    workerId: r.record.workerId,
    syncStatus: r.record.syncStatus,
  }));
}

export async function purgeSyncedRecords(): Promise<PurgeResult> {
  const all = await listAllRecords();
  const synced = all.filter(r => r.record.syncStatus === 'synced');
  const pending = all.filter(r => r.record.syncStatus === 'pending');

  const purgedRecordIds: string[] = [];
  const purgedWorkerIds = new Set<string>();

  for (const signed of synced) {
    await removeRecord(signed.record.id);
    purgedRecordIds.push(signed.record.id);
    purgedWorkerIds.add(signed.record.workerId);
  }

  const purgedWorkerTemplates: string[] = [];
  for (const workerId of purgedWorkerIds) {
    const workerStillHasPending = pending.some(r => r.record.workerId === workerId);
    if (!workerStillHasPending) {
      await deleteStoredTemplate(workerId);
      purgedWorkerTemplates.push(workerId);
    }
  }

  return {
    purgedRecordIds,
    purgedWorkerTemplates,
    skippedPendingCount: pending.length,
  };
}

export async function purgeWorkerBiometrics(workerId: string): Promise<void> {
  await deleteStoredTemplate(workerId);
}
