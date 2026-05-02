import React, { useCallback, useEffect, useState } from "react";
import type { DrawerContentComponentProps } from "@react-navigation/drawer";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { NavigationContainer } from "@react-navigation/native";
import { CoachingScreen } from "../screens/CoachingScreen";
import { ConfigPanel } from "../components/ConfigPanel";
import { WireAIProvider, useLLMConfigStorage } from "wireai-rn";
import { defaultComponents } from "wireai-rn/components";
import type { LocalLLMConfig, Message, WireAIComponent } from "wireai-rn";
import { MoodTracker } from "../components/wire-ui/MoodTracker";
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
// MoodTracker uses Zod v4 (example) while the SDK types are Zod v3 — cast is safe at runtime
const COMPONENTS = [...defaultComponents, MoodTracker as unknown as WireAIComponent];
const DRAWER_SCREEN_OPTIONS = {
  headerShown: false,
  drawerType: "front",
  drawerStyle: { width: "85%" as const },
  overlayColor: "rgba(0,0,0,0.5)",
} as const;

// ─── Drawer panel ─────────────────────────────────────────────────────────────

type DrawerPanelProps = DrawerContentComponentProps & {
  config: LocalLLMConfig;
  onSave: (c: LocalLLMConfig) => void;
  onClearHistory: () => Promise<void>;
};

const _DrawerPanel: React.FC<DrawerPanelProps> = ({ navigation, config, onSave, onClearHistory }) => {
  const handleSave = useCallback(
    (newConfig: LocalLLMConfig) => {
      onSave(newConfig);
      navigation.closeDrawer();
    },
    [onSave, navigation]
  );

  const handleClear = useCallback(async () => {
    await onClearHistory();
    navigation.closeDrawer();
  }, [onClearHistory, navigation]);

  return <ConfigPanel config={config} onSave={handleSave} onClearHistory={handleClear} />;
};
const DrawerPanel = React.memo(_DrawerPanel);

// ─── Navigator ────────────────────────────────────────────────────────────────

const _AppNavigator: React.FC = () => {
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

  const renderDrawer = useCallback(
    (props: DrawerContentComponentProps) => (
      <DrawerPanel
        {...props}
        config={llmConfig}
        onSave={saveConfig}
        onClearHistory={handleClearHistory}
      />
    ),
    [llmConfig, saveConfig, handleClearHistory]
  );

  const renderChatScreen = useCallback(
    ({ navigation }: { navigation: { openDrawer: () => void } }) => (
      <CoachingScreen onSettings={navigation.openDrawer} />
    ),
    []
  );

  if (!isLoaded || !historyLoaded) return null;

  return (
    <NavigationContainer>
      <WireAIProvider
        key={`${llmConfig.provider}:${llmConfig.baseUrl}:${llmConfig.model}`}
        llm={llmConfig}
        components={COMPONENTS}
        systemPromptSuffix={SYSTEM_PROMPT_SUFFIX}
        initialMessages={initialMessages}
        onThreadUpdate={handleThreadUpdate}
      >
        <Drawer.Navigator
          id="root"
          screenOptions={DRAWER_SCREEN_OPTIONS}
          drawerContent={renderDrawer}
        >
          <Drawer.Screen name="Chat">
            {renderChatScreen}
          </Drawer.Screen>
        </Drawer.Navigator>
      </WireAIProvider>
    </NavigationContainer>
  );
};

export const AppNavigator = React.memo(_AppNavigator);
