/**
 * Behaviour: once a choice has been submitted, the row the user chose from
 * LOOKS submitted.
 *
 * `ChipSelectCard`, `ContentSelectCard` and `SelectionCard` have always
 * returned early from their `toggle` handlers on `submitted || isStreaming`.
 * These tests cover the other half of that: the row also takes the disabled
 * visual on the same condition, so a card the user can no longer act on does
 * not still look live.
 *
 * The assertions are differential on purpose. They compare the row's resolved
 * style before and after, and only require that a dimming opacity appears —
 * never that it equals a particular number this test also knows. The literal
 * lives in the component's own StyleSheet and nowhere else.
 */
jest.mock("react-native", () => require("./harness/react-native-mock"));

import React from "react";
import type { ReactTestInstance } from "react-test-renderer";
import { ChipSelectCard, ContentSelectCard, SelectionCard } from "../components";
import { flattenStyle, hostTypeOf, mount, press, pressableByLabel } from "./harness/mount";

/** The resolved style of the box a selectable row renders inside its Pressable. */
const rowStyle = (root: ReactTestInstance, label: string): Record<string, unknown> => {
  const boxes = pressableByLabel(root, label).findAll((node) => hostTypeOf(node) === "View");
  const box = boxes[0];
  if (!box) throw new Error(`rowStyle: row ${JSON.stringify(label)} rendered no View`);
  return flattenStyle(box.props.style);
};

const isDimmed = (style: Record<string, unknown>): boolean =>
  typeof style.opacity === "number" && style.opacity < 1;

type Case = {
  name: string;
  element: (onSelect: jest.Mock) => React.ReactElement;
  rowLabel: string;
};

const cases: Case[] = [
  {
    name: "ChipSelectCard",
    rowLabel: "Spring",
    element: (onSelect) =>
      React.createElement(ChipSelectCard.component, {
        messageId: "msg_1",
        title: "Which season?",
        chips: ["Spring", "Summer"],
        onSelect,
      }),
  },
  {
    name: "ContentSelectCard",
    rowLabel: "Paella",
    element: (onSelect) =>
      React.createElement(ContentSelectCard.component, {
        messageId: "msg_1",
        title: "Pick a dish",
        items: [
          { id: "paella", title: "Paella" },
          { id: "risotto", title: "Risotto" },
        ],
        onSelect,
      }),
  },
  {
    name: "SelectionCard",
    rowLabel: "Berlin",
    element: (onSelect) =>
      React.createElement(SelectionCard.component, {
        messageId: "msg_1",
        title: "Where to?",
        options: [
          { value: "berlin", label: "Berlin" },
          { value: "lisbon", label: "Lisbon" },
        ],
        onSelect,
      }),
  },
];

describe("a submitted row takes the disabled visual", () => {
  for (const testCase of cases) {
    describe(testCase.name, () => {
      it("is not dimmed before the choice is submitted", () => {
        const onSelect = jest.fn();
        const { root, unmount } = mount(testCase.element(onSelect));

        press(pressableByLabel(root, testCase.rowLabel));

        expect(isDimmed(rowStyle(root, testCase.rowLabel))).toBe(false);
        unmount();
      });

      it("is dimmed after the choice is submitted", () => {
        const onSelect = jest.fn();
        const { root, unmount } = mount(testCase.element(onSelect));

        press(pressableByLabel(root, testCase.rowLabel));
        const before = rowStyle(root, testCase.rowLabel);
        press(pressableByLabel(root, "Continue"));
        const after = rowStyle(root, testCase.rowLabel);

        // The submit really happened — otherwise "dimmed" would be proving
        // nothing about submission.
        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(isDimmed(before)).toBe(false);
        expect(isDimmed(after)).toBe(true);
        unmount();
      });

      it("stops accepting taps on the row once submitted", () => {
        const onSelect = jest.fn();
        const { root, unmount } = mount(testCase.element(onSelect));

        press(pressableByLabel(root, testCase.rowLabel));
        press(pressableByLabel(root, "Continue"));
        const submitted = rowStyle(root, testCase.rowLabel);

        press(pressableByLabel(root, testCase.rowLabel));

        expect(rowStyle(root, testCase.rowLabel)).toEqual(submitted);
        expect(pressableByLabel(root, testCase.rowLabel).props.disabled).toBe(true);
        unmount();
      });
    });
  }
});
