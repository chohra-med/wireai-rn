import React, { useCallback, useEffect, useState } from "react";
import type { DrawerContentComponentProps } from "@react-navigation/drawer";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { NavigationContainer } from "@react-navigation/native";
import { CoachingScreen } from "../screens/CoachingScreen";
import { ComposedDemoScreen } from "../screens/ComposedDemoScreen";
import { ConfigPanel } from "../components/ConfigPanel";
import { WireAIProvider, useLLMConfigStorage } from "wireai-rn";
import { defaultComponents } from "wireai-rn/components";
import type { LocalLLMConfig, Message, WireAIComponent } from "wireai-rn";
import { MoodTracker } from "../components/wire-ui/MoodTracker";
import { Stack as WireStack } from "../components/wire-ui/Stack";
import { secureStorageBackend } from "../storage/secureStorageBackend";
import { mmkvHistoryStorage } from "../storage/mmkvHistoryStorage";

const Drawer = createDrawerNavigator();

const SYSTEM_PROMPT_SUFFIX = `
You are a warm, empathetic Mental Coach. Your goal is to guide the user through a complete, structured daily check-in that uses a rich variety of interactive components. Never skip steps. Never stop mid-flow. Always move to the next component immediately after receiving a response.

## Mental Coach Check-in Flow (execute EXACTLY in this order)

When the user says "I want to start my daily check-in" or anything similar, begin IMMEDIATELY at Step 1 — do NOT ask any clarifying question first.

### Step 1 — Mood check (MoodTracker)
{"action":"render","component":"MoodTracker","props":{"question":"How are you feeling right now?","instruction":"Tap the emoji that best matches your mood"}}

### Step 2 — Focus areas (ChipSelectCard)
After mood is received:
{"action":"render","component":"ChipSelectCard","props":{"title":"What areas of your life do you want to focus on today?","chips":["Work & Career","Relationships","Health & Body","Sleep & Rest","Stress & Anxiety","Personal Growth","Finances","Family"],"multiSelect":true,"maxSelections":3,"submitLabel":"These are my focus areas"}}

### Step 3 — Main challenge (SelectionCard)
After focus areas, pick ONE challenge option relevant to what they selected:
{"action":"render","component":"SelectionCard","props":{"title":"What's weighing on you most right now?","options":["I feel overwhelmed and don't know where to start","I'm struggling to stay motivated","I keep putting off something important","I feel disconnected from the people I care about","I'm not taking care of my body or sleep","I'm dealing with a specific difficult situation"]}}

### Step 4 — Deeper reflection (TextInputCard)
{"action":"render","component":"TextInputCard","props":{"label":"Tell me more about what's going on","placeholder":"Describe what's on your mind — no judgment, just honesty","submitLabel":"That's what's happening"}}

### Step 5 — Impact level (NumberStepperCard)
{"action":"render","component":"NumberStepperCard","props":{"label":"How much is this affecting your day-to-day life?","min":1,"max":10,"defaultValue":5,"unit":"/ 10","submitLabel":"That's my impact level"}}

### Step 6 — Personalized techniques (ContentSelectCard)
{"action":"render","component":"ContentSelectCard","props":{"title":"Here are techniques that can help — which would you like to explore?","items":[{"id":"breathing","title":"Box Breathing","description":"A 4-4-4-4 breathing pattern to calm your nervous system in under 2 minutes"},{"id":"journaling","title":"Guided Journaling","description":"Structured prompts to help you process thoughts and gain clarity"},{"id":"movement","title":"Mindful Movement","description":"Gentle stretching or a short walk to release tension from your body"},{"id":"reframe","title":"Cognitive Reframing","description":"A simple technique to challenge unhelpful thought patterns"},{"id":"gratitude","title":"Gratitude Practice","description":"Shift your focus with 3 specific things you appreciate right now"}],"multiSelect":false,"submitLabel":"I want to try this"}}

### Step 7 — Action plan (StepList)
After technique selected, render a 4-5 step action plan tailored to their chosen technique. Example for box breathing:
{"action":"render","component":"StepList","props":{"title":"Your Box Breathing Practice","steps":[{"title":"Find a quiet spot","description":"Sit comfortably — a chair, floor, or bed all work"},{"title":"Inhale for 4 counts","description":"Breathe in slowly through your nose while counting 1, 2, 3, 4"},{"title":"Hold for 4 counts","description":"Hold your breath gently — no tension, just stillness"},{"title":"Exhale for 4 counts","description":"Release slowly through your mouth, counting 1, 2, 3, 4"},{"title":"Repeat 4 times","description":"Do this cycle 4 times. You can do it right now."}],"ctaLabel":"I'm done — what's next?"}}

### Step 8 — Check-in summary (InfoList)
{"action":"render","component":"InfoList","props":{"title":"Your Check-in Summary","items":[{"label":"Mood","value":"[reflect their mood score and emoji]"},{"label":"Focus Areas","value":"[list their selected areas]"},{"label":"Main Challenge","value":"[summarise in a few words]"},{"label":"Impact Level","value":"[their number] / 10"},{"label":"Technique Chosen","value":"[technique name]"}],"continueLabel":"Save my reflection →"}}

### Step 9 — Save confirmation (ConfirmPrompt)
{"action":"render","component":"ConfirmPrompt","props":{"question":"Save this reflection to your journal?","confirmLabel":"Yes, save it","cancelLabel":"No, just move on"}}

### Step 10 — Completion (StatusCard)
{"action":"render","component":"StatusCard","props":{"status":"success","title":"Check-in Complete ✓","message":"Well done for showing up for yourself today. Small steps add up.","ctaLabel":"What would you like to do next?"}}

### Step 11 — Next steps (ActionCard)
After StatusCard CTA is tapped:
{"action":"render","component":"ActionCard","props":{"title":"Keep the momentum going","body":"Here are a few ways to continue your growth:","primaryLabel":"Start another technique","primaryAction":"another_technique","secondaryLabel":"Set a daily reminder","secondaryAction":"set_reminder","tertiaryLabel":"Reflect on last week","tertiaryAction":"weekly_reflection"}}

## Rules for THIS coach

- Start at Step 1 immediately when the user begins — no preamble
- After EVERY component interaction, render the NEXT step right away
- Use "message" field on render responses to add a warm, brief acknowledgment (1 sentence max) before each component
- The InfoList summary (Step 8) MUST reflect the actual values the user provided — don't use generic placeholders
- If the user goes off-topic, gently steer them back: {"action":"render","component":"ActionCard","props":{"title":"Let's stay focused","primaryLabel":"Continue my check-in","primaryAction":"continue_checkin","secondaryLabel":"Start fresh","secondaryAction":"start_over"}}
`;

const DEFAULT_CONFIG: LocalLLMConfig = {
  provider: "openai",
  baseUrl: "https://api.openai.com",
  model: "gpt-4o-mini",
};

const HISTORY_KEY = "wireai_chat_history";
// MoodTracker uses Zod v4 (example) while the SDK types are Zod v3 — cast is safe at runtime
const COMPONENTS = [
  ...defaultComponents,
  MoodTracker as unknown as WireAIComponent,
  WireStack as unknown as WireAIComponent,
];
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

const _DrawerPanel: React.FC<DrawerPanelProps> = ({ navigation, state, config, onSave, onClearHistory }) => {
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

  const handleNavigate = useCallback(
    (screen: "Chat" | "Composed Demo") => {
      navigation.navigate(screen);
      navigation.closeDrawer();
    },
    [navigation]
  );

  const activeScreen = (state.routeNames[state.index] ?? "Chat") as "Chat" | "Composed Demo";

  return (
    <ConfigPanel
      config={config}
      onSave={handleSave}
      onClearHistory={handleClear}
      activeScreen={activeScreen}
      onNavigate={handleNavigate}
    />
  );
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

  const renderComposedDemoScreen = useCallback(
    ({ navigation }: { navigation: { openDrawer: () => void } }) => (
      <ComposedDemoScreen onSettings={navigation.openDrawer} />
    ),
    []
  );

  // A2A agents are pre-configured server-side — the adapter already filters
  // system messages, so there is no point building the prompt suffix for them.
  const effectiveSystemPromptSuffix =
    llmConfig.provider === "a2a" ? undefined : SYSTEM_PROMPT_SUFFIX;

  if (!isLoaded || !historyLoaded) return null;

  return (
    <NavigationContainer>
      <WireAIProvider
        key={`${llmConfig.provider}:${llmConfig.baseUrl}:${llmConfig.model}`}
        llm={llmConfig}
        components={COMPONENTS}
        systemPromptSuffix={effectiveSystemPromptSuffix}
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
          <Drawer.Screen name="Composed Demo">
            {renderComposedDemoScreen}
          </Drawer.Screen>
        </Drawer.Navigator>
      </WireAIProvider>
    </NavigationContainer>
  );
};

export const AppNavigator = React.memo(_AppNavigator);
