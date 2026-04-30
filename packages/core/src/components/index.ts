import type { z } from "zod";
import type { WireAIComponent } from "../types";
import { ActionCard } from "./ActionCard";
import { ChipSelectCard } from "./ChipSelectCard";
import { ConfirmPrompt } from "./ConfirmPrompt";
import { ContentSelectCard } from "./ContentSelectCard";
import { InfoList } from "./InfoList";
import { MessageBubble } from "./MessageBubble";
import { NumberStepperCard } from "./NumberStepperCard";
import { SelectionCard } from "./SelectionCard";
import { StatusCard } from "./StatusCard";
import { StepList } from "./StepList";
import { TextInputCard } from "./TextInputCard";

type AnyWireAIComponent = WireAIComponent<z.ZodObject<z.ZodRawShape>>;

// biome-ignore lint/suspicious/noExplicitAny: components use typed-schema props; cast is safe
const cast = (c: unknown) => c as AnyWireAIComponent;

export const defaultComponents: AnyWireAIComponent[] = [
  cast(ActionCard),
  cast(ChipSelectCard),
  cast(ConfirmPrompt),
  cast(ContentSelectCard),
  cast(InfoList),
  cast(MessageBubble),
  cast(NumberStepperCard),
  cast(SelectionCard),
  cast(StatusCard),
  cast(StepList),
  cast(TextInputCard),
];

export {
  ActionCard,
  ChipSelectCard,
  ConfirmPrompt,
  ContentSelectCard,
  InfoList,
  MessageBubble,
  NumberStepperCard,
  SelectionCard,
  StatusCard,
  StepList,
  TextInputCard,
};
