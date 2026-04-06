import type * as React from "react";

declare global {
  interface MathfieldElement extends HTMLElement {
    value: string;
    getValue?: () => string;
    setValue?: (value: string) => void;
    insert?: (value: string) => void;
    executeCommand?: (command: string | [string, ...unknown[]]) => void;
  }
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "math-field": React.DetailedHTMLProps<
        React.HTMLAttributes<MathfieldElement>,
        MathfieldElement
      > & {
        value?: string;
        placeholder?: string;
        disabled?: boolean;
        readonly?: boolean;
        "virtual-keyboard-mode"?: "manual" | "onfocus" | "off";
      };
    }
  }
}

export {};
