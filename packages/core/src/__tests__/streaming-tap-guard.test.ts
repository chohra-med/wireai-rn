/**
 * Behaviour: while a message is still streaming, a tap on an interactive
 * built-in must not reach the component's handler.
 *
 * Every interactive built-in takes an injected `isStreaming` prop and refuses
 * work while it is true. Two of the ten are mounted here — `ConfirmPrompt`,
 * whose handler is an injected callback, and `ChipSelectCard`, whose handler is
 * internal selection state that only shows up in what it renders.
 *
 * Each guarded case is paired with the same tap performed with `isStreaming`
 * false. Those pairs are positive controls, not extra coverage: without them a
 * broken query or a `press` that never fired would make the guard assertions
 * pass while measuring nothing at all.
 */
jest.mock("react-native", () => require("./harness/react-native-mock"));

import React from "react";
import type { ReactTestInstance } from "react-test-renderer";
import { ChipSelectCard, ConfirmPrompt } from "../components";
import { flattenStyle, hostTypeOf, mount, press, pressableByLabel } from "./harness/mount";

/** The styled box a chip renders inside its Pressable. */
const chipBox = (root: ReactTestInstance, label: string): Record<string, unknown> => {
  const boxes = pressableByLabel(root, label).findAll((node) => hostTypeOf(node) === "View");
  const box = boxes[0];
  if (!box) throw new Error(`chipBox: chip ${JSON.stringify(label)} rendered no View`);
  return flattenStyle(box.props.style);
};

const CHIPS = ["Spring", "Summer", "Autumn"];

describe("isStreaming tap guard", () => {
  describe("ConfirmPrompt", () => {
    it("does not call onConfirm when a tap lands while streaming", () => {
      const onConfirm = jest.fn();
      const { root, unmount } = mount(
        React.createElement(ConfirmPrompt.component, {
          messageId: "msg_1",
          question: "Book the table?",
          onConfirm,
          isStreaming: true,
        })
      );

      press(pressableByLabel(root, "Yes"));

      expect(onConfirm).not.toHaveBeenCalled();
      unmount();
    });

    it("calls onConfirm for the same tap once streaming has finished", () => {
      const onConfirm = jest.fn();
      const { root, unmount } = mount(
        React.createElement(ConfirmPrompt.component, {
          messageId: "msg_1",
          question: "Book the table?",
          onConfirm,
          isStreaming: false,
        })
      );

      press(pressableByLabel(root, "Yes"));

      expect(onConfirm).toHaveBeenCalledTimes(1);
      unmount();
    });

    it("does not call onCancel when a tap lands while streaming", () => {
      const onCancel = jest.fn();
      const { root, unmount } = mount(
        React.createElement(ConfirmPrompt.component, {
          messageId: "msg_1",
          question: "Book the table?",
          onCancel,
          isStreaming: true,
        })
      );

      press(pressableByLabel(root, "No"));

      expect(onCancel).not.toHaveBeenCalled();
      unmount();
    });
  });

  describe("ChipSelectCard", () => {
    it("leaves the chip rendering exactly as it was when a tap lands while streaming", () => {
      const { root, unmount } = mount(
        React.createElement(ChipSelectCard.component, {
          messageId: "msg_1",
          title: "Which season?",
          chips: CHIPS,
          isStreaming: true,
        })
      );

      const before = chipBox(root, "Spring");
      press(pressableByLabel(root, "Spring"));
      const after = chipBox(root, "Spring");

      expect(after).toEqual(before);
      unmount();
    });

    it("changes that same chip's rendering when the tap lands after streaming", () => {
      const { root, unmount } = mount(
        React.createElement(ChipSelectCard.component, {
          messageId: "msg_1",
          title: "Which season?",
          chips: CHIPS,
          isStreaming: false,
        })
      );

      const before = chipBox(root, "Spring");
      press(pressableByLabel(root, "Spring"));
      const after = chipBox(root, "Spring");

      expect(after).not.toEqual(before);
      unmount();
    });

    it("does not call onSelect when the submit button is tapped while streaming", () => {
      const onSelect = jest.fn();
      const { root, unmount } = mount(
        React.createElement(ChipSelectCard.component, {
          messageId: "msg_1",
          title: "Which season?",
          chips: CHIPS,
          onSelect,
          isStreaming: true,
        })
      );

      press(pressableByLabel(root, "Spring"));
      press(pressableByLabel(root, "Continue"));

      expect(onSelect).not.toHaveBeenCalled();
      unmount();
    });
  });
});
