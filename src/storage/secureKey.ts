import * as Keychain from 'react-native-keychain';
import { Platform } from 'react-native';

const ONSITE_KEY_SERVICE = 'com.onsite.encryption.key';

function generateRandomKeyHex(lengthBytes: number): string {
  const array = new Uint8Array(lengthBytes);
  for (let i = 0; i < lengthBytes; i++) {
    array[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function getOrCreateEncryptionKey(): Promise<string> {
  const existing = await Keychain.getGenericPassword({
    service: ONSITE_KEY_SERVICE,
  });

  if (existing && existing.password) {
    return existing.password;
  }

  const newKey = generateRandomKeyHex(32);

  const accessControlOptions: Keychain.Options = {
    service: ONSITE_KEY_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  };

  if (Platform.OS === 'android') {
    accessControlOptions.securityLevel =
      Keychain.SECURITY_LEVEL.SECURE_HARDWARE;
  }

  await Keychain.setGenericPassword(
    ONSITE_KEY_SERVICE,
    newKey,
    accessControlOptions,
  );

  return newKey;
}

export async function deleteEncryptionKey(): Promise<void> {
  await Keychain.resetGenericPassword({
    service: ONSITE_KEY_SERVICE,
  });
}
