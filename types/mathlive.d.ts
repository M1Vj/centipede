import type * as React from "react";

declare global {
  type MathfieldMode = "math" | "text" | "inline-math";
  type MathVirtualKeyboardPolicy = "auto" | "manual" | "sandboxed";
  type MathfieldInsertOptions = {
    mode?: MathfieldMode | "auto";
    silenceNotifications?: boolean;
  };

  interface MathfieldElement extends HTMLElement {
    value: string;
    mode: MathfieldMode;
    defaultMode: MathfieldMode;
    smartMode: boolean;
    mathModeSpace: string;
    mathVirtualKeyboardPolicy: MathVirtualKeyboardPolicy;
    getValue?: (format?: string) => string;
    setValue?: (value?: string, options?: MathfieldInsertOptions) => void;
    insert?: (value: string, options?: MathfieldInsertOptions) => void;
    executeCommand?: (
      command: string | [string, ...unknown[]],
      ...args: unknown[]
    ) => boolean;
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
        "default-mode"?: MathfieldMode;
        "smart-mode"?: "on" | "off";
        "math-mode-space"?: string;
        "math-virtual-keyboard-policy"?: MathVirtualKeyboardPolicy;
      };
    }
  }
}

export {};
