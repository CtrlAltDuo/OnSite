import RNFS from 'react-native-fs';
import { getOrCreateEncryptionKey } from '../storage/secureKey';
import { SignedRecord } from './recordSigner';

const QUEUE_DIRECTORY = 'onsite_records';
const QUEUE_FILE = 'record_queue.enc';

function xorString(data: string, key: string): string {
  const keyBytes = Array.from(key).map(c => c.charCodeAt(0));
  return Array.from(data)
    .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ keyBytes[i % keyBytes.length]))
    .join('');
}

async function ensureQueueDirectory(): Promise<string> {
  const dirPath = `${RNFS.DocumentDirectoryPath}/${QUEUE_DIRECTORY}`;
  const exists = await RNFS.exists(dirPath);
  if (!exists) {
    await RNFS.mkdir(dirPath);
  }
  return dirPath;
}

async function queueFilePath(): Promise<string> {
  const dir = await ensureQueueDirectory();
  return `${dir}/${QUEUE_FILE}`;
}

async function readQueue(): Promise<SignedRecord[]> {
  const path = await queueFilePath();
  const exists = await RNFS.exists(path);
  if (!exists) {
    return [];
  }

  try {
    const encrypted = await RNFS.readFile(path, 'utf8');
    const key = await getOrCreateEncryptionKey();
    const decrypted = xorString(encrypted, key);
    return JSON.parse(decrypted) as SignedRecord[];
  } catch {
    return [];
  }
}

async function writeQueue(records: SignedRecord[]): Promise<void> {
  const path = await queueFilePath();
  const key = await getOrCreateEncryptionKey();
  const json = JSON.stringify(records);
  const encrypted = xorString(json, key);
  await RNFS.writeFile(path, encrypted, 'utf8');
}

export async function enqueueRecord(signed: SignedRecord): Promise<void> {
  const existing = await readQueue();
  const updated = [...existing, { ...signed, record: { ...signed.record, syncStatus: 'pending' as const } }];
  await writeQueue(updated);
}

export async function listPendingRecords(): Promise<SignedRecord[]> {
  const all = await readQueue();
  return all.filter(r => r.record.syncStatus === 'pending');
}

export async function listAllRecords(): Promise<SignedRecord[]> {
  return readQueue();
}

export async function markRecordSynced(recordId: string): Promise<void> {
  const all = await readQueue();
  const updated = all.map(r =>
    r.record.id === recordId
      ? { ...r, record: { ...r.record, syncStatus: 'synced' as const } }
      : r,
  );
  await writeQueue(updated);
}

export async function removeRecord(recordId: string): Promise<void> {
  const all = await readQueue();
  const filtered = all.filter(r => r.record.id !== recordId);
  await writeQueue(filtered);
}

export async function clearSyncedRecords(): Promise<void> {
  const all = await readQueue();
  const pending = all.filter(r => r.record.syncStatus === 'pending');
  await writeQueue(pending);
}
