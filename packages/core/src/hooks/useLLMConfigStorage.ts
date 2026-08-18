import { useCallback, useEffect, useRef, useState } from "react";
import { parseStoredLLMConfig } from "../schema/llm-config.schema";
import type { LocalLLMConfig } from "../types";

export interface StorageBackend {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

const STORAGE_KEY = "wireai_llm_config_v1";

export type UseLLMConfigStorageResult = {
  config: LocalLLMConfig;
  isLoaded: boolean;
  saveConfig: (config: LocalLLMConfig) => Promise<void>;
  clearConfig: () => Promise<void>;
};

export const useLLMConfigStorage = (
  storage: StorageBackend,
  defaultConfig: LocalLLMConfig
): UseLLMConfigStorageResult => {
  const [config, setConfig] = useState<LocalLLMConfig>(defaultConfig);
  const [isLoaded, setIsLoaded] = useState(false);
  const defaultRef = useRef(defaultConfig);

  useEffect(() => {
    storage
      .getItem(STORAGE_KEY)
      .then((raw) => {
        // Validate before adopting. A persisted entry is untrusted input: it is
        // whatever last wrote STORAGE_KEY, and adopting it unchecked lets that
        // writer choose the `baseUrl` this app sends its prompts — and its
        // `apiKey` — to. An entry that is absent, corrupt, or not shaped like a
        // LocalLLMConfig falls back to the default the app itself supplied.
        setConfig(parseStoredLLMConfig(raw, defaultRef.current));
      })
      .catch(() => {
        // storage unavailable — fall through to default
      })
      .finally(() => setIsLoaded(true));
  }, [storage]);

  const saveConfig = useCallback(
    async (newConfig: LocalLLMConfig) => {
      setConfig(newConfig);
      await storage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
    },
    [storage]
  );

  const clearConfig = useCallback(async () => {
    setConfig(defaultRef.current);
    await storage.deleteItem(STORAGE_KEY);
  }, [storage]);

  return { config, isLoaded, saveConfig, clearConfig };
};
