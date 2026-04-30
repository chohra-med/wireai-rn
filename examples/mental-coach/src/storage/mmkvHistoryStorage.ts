import { MMKV } from "react-native-mmkv";

let storage: MMKV | null = null;
let storageFailed = false;

const getStorage = () => {
  if (storageFailed) return null;
  if (!storage) {
    try {
      storage = new MMKV({
        id: "mental-coach-chat-history",
      });
    } catch (e) {
      console.error("MMKV initialization failed:", e);
      storageFailed = true;
      return null;
    }
  }
  return storage;
};

export const mmkvHistoryStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return getStorage()?.getString(key) ?? null;
    } catch (e) {
      console.error("mmkvHistoryStorage.getItem error:", e);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      getStorage()?.set(key, value);
    } catch (e) {
      console.error("mmkvHistoryStorage.setItem error:", e);
    }
  },
  deleteItem: async (key: string): Promise<void> => {
    try {
      getStorage()?.delete(key);
    } catch (e) {
      console.error("mmkvHistoryStorage.deleteItem error:", e);
    }
  },
};
