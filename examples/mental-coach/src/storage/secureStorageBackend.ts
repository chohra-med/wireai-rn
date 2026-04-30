import * as SecureStore from "expo-secure-store";
import type { StorageBackend } from "wireai-rn";

export const secureStorageBackend: StorageBackend = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  deleteItem: (key) => SecureStore.deleteItemAsync(key),
};
