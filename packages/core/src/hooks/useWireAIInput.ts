import { useCallback, useRef, useState } from "react";
import type { TextInput } from "react-native";

export const useWireAIInput = (onSubmit: (text: string) => void) => {
  const inputRef = useRef<TextInput>(null);
  const [inputText, setInputText] = useState("");

  const handleSubmit = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    inputRef.current?.clear();
    setInputText("");
    onSubmit(trimmed);
  }, [inputText, onSubmit]);

  return { inputRef, inputText, setInputText, handleSubmit };
};
