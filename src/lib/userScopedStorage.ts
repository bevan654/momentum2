import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * AsyncStorage for per-account data. Each value is stored under `<baseKey>:<userId>`, so a
 * second account signing in on the same phone never sees the first account's data.
 */
function scopedKey(baseKey: string, userId: string) {
  return `${baseKey}:${userId}`;
}

/**
 * Reads this account's value. Builds before per-account keys stored everything under the bare
 * `baseKey`; that copy is handed to the first account that reads it after updating (normally its
 * owner) and then removed, so it can't reach any other account.
 */
export async function readUserScoped(baseKey: string, userId: string): Promise<string | null> {
  const key = scopedKey(baseKey, userId);
  const own = await AsyncStorage.getItem(key);
  if (own != null) return own;
  const legacy = await AsyncStorage.getItem(baseKey);
  if (legacy == null) return null;
  await AsyncStorage.setItem(key, legacy);
  await AsyncStorage.removeItem(baseKey);
  return legacy;
}

export async function writeUserScoped(baseKey: string, userId: string, value: string): Promise<void> {
  await AsyncStorage.setItem(scopedKey(baseKey, userId), value);
}
