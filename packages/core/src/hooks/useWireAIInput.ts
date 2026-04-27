import { useCallback, useState } from "react";

export const useWireAIInput = (onSubmit: (text: string) => void) => {
  const [inputText, setInputText] = useState("");

  const handleSubmit = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    setInputText("");
    onSubmit(trimmed);
  }, [inputText, onSubmit]);

  return { inputText, setInputText, handleSubmit };
};
