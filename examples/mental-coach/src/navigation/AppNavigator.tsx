import React, { useCallback, useEffect, useState } from "react";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { NavigationContainer } from "@react-navigation/native";
import { CoachingScreen } from "../screens/CoachingScreen";
import { ConfigPanel } from "../components/ConfigPanel";
import { WireAIProvider, useLLMConfigStorage } from "wireai-rn";
import type { LocalLLMConfig, Message } from "wireai-rn";
import { defaultComponents } from "../components/wire-ui";
import { secureStorageBackend } from "../storage/secureStorageBackend";
import { mmkvHistoryStorage } from "../storage/mmkvHistoryStorage";

const Drawer = createDrawerNavigator();

const SYSTEM_PROMPT_SUFFIX = `
You are a warm, empathetic Mental Coach.
Your goal is to guide the user through a mindful check-in.
Use interactive components to make the experience structured and supportive.
`;

const DEFAULT_CONFIG: LocalLLMConfig = {
  provider: "openai",
  baseUrl: "https://api.openai.com",
  model: "gpt-4o-mini",
};

const HISTORY_KEY = "wireai_chat_history";

export const AppNavigator: React.FC = () => {
  const { config: llmConfig, isLoaded, saveConfig } = useLLMConfigStorage(
    secureStorageBackend,
    DEFAULT_CONFIG
  );

  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    mmkvHistoryStorage.getItem(HISTORY_KEY).then((raw) => {
      if (raw) {
        try {
          setInitialMessages(JSON.parse(raw) as Message[]);
        } catch {
          // corrupt storage — start fresh
        }
      }
      setHistoryLoaded(true);
    });
  }, []);

  const handleThreadUpdate = useCallback((messages: Message[]) => {
    mmkvHistoryStorage.setItem(HISTORY_KEY, JSON.stringify(messages));
  }, []);

  const handleClearHistory = useCallback(async () => {
    await mmkvHistoryStorage.deleteItem(HISTORY_KEY);
    setInitialMessages([]);
  }, []);

  if (!isLoaded || !historyLoaded) return null;

  return (
    <NavigationContainer>
      <WireAIProvider
        key={`${llmConfig.provider}:${llmConfig.baseUrl}:${llmConfig.model}`}
        llm={llmConfig}
        components={defaultComponents}
        systemPromptSuffix={SYSTEM_PROMPT_SUFFIX}
        initialMessages={initialMessages}
        onThreadUpdate={handleThreadUpdate}
      >
        <Drawer.Navigator
          screenOptions={{
            headerShown: false,
            drawerType: "front",
            drawerStyle: { width: "85%" },
            overlayColor: "rgba(0,0,0,0.5)",
          }}
          drawerContent={(props) => (
            <ConfigPanel
              config={llmConfig}
              onSave={(newConfig) => {
                saveConfig(newConfig);
                props.navigation.closeDrawer();
              }}
              onClearHistory={async () => {
                await handleClearHistory();
                props.navigation.closeDrawer();
              }}
            />
          )}
        >
          <Drawer.Screen name="Chat">
            {(props) => (
              <CoachingScreen
                {...props}
                onSettings={() => props.navigation.openDrawer()}
              />
            )}
          </Drawer.Screen>
        </Drawer.Navigator>
      </WireAIProvider>
    </NavigationContainer>
  );
};
