"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { KatexPreview } from "@/components/math-editor/katex-preview";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface MathliveFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  preferredInitialMode?: PreferredInitialMode;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  description?: string;
  className?: string;
  previewLabel?: string;
  previewFallbackText?: string;
  showPreviewToggle?: boolean;
}

const SYMBOL_TOOLBAR = [
  { label: "a/b", latex: "\\frac{a}{b}" },
  { label: "sqrt", latex: "\\sqrt{x}" },
  { label: "pi", latex: "\\pi" },
  { label: "theta", latex: "\\theta" },
  { label: "x^2", latex: "x^2" },
  { label: "x_n", latex: "x_n" },
  { label: "<=", latex: "\\le" },
  { label: ">=", latex: "\\ge" },
  { label: "!=", latex: "\\neq" },
  { label: "times", latex: "\\times" },
] as const;

type EditorMode = "math" | "text";
type PreferredInitialMode = EditorMode | "auto";

const MATHLIVE_KEYBOARD_CLASS = "ML__keyboard";
const MATHLIVE_KEYBOARD_SINK_SELECTOR = ".ML__keyboard-sink";
const MATHLIVE_MENU_CONTAINER_CLASS = "ui-menu-container";
const MATHLIVE_MENU_CLASS = "ui-menu";
const MATHLIVE_HOST_SELECTOR = "math-field";
const NON_MATHLIVE_FOCUSABLE_SELECTOR =
  "input,textarea,select,button,[contenteditable=''],[contenteditable='true'],[tabindex]";
const COMPLETE_VIRTUAL_KEYBOARD_LAYOUTS = ["numeric", "symbols", "alphabetic", "greek"] as const;
const LATEX_CONTROL_SEQUENCE_PATTERN = /\\(?:[A-Za-z]+|[^A-Za-z\s])/;

const TEXT_TOKEN_HIGHLIGHT_STYLE = {
  "--text-highlight-background-color": "hsl(var(--primary) / 0.1)",
  "--highlight-text": "hsl(var(--primary) / 0.1)",
} as CSSProperties;

let hasConfiguredCompleteVirtualKeyboard = false;

function getMathfieldHostFromTarget(target: EventTarget | null): MathfieldElement | null {
  if (target instanceof ShadowRoot) {
    return target.host instanceof Element && target.host.matches(MATHLIVE_HOST_SELECTOR)
      ? (target.host as MathfieldElement)
      : null;
  }

  if (!(target instanceof Element)) {
    return null;
  }

  return (target.matches(MATHLIVE_HOST_SELECTOR)
    ? target
    : target.closest(MATHLIVE_HOST_SELECTOR)) as MathfieldElement | null;
}

function isMathfieldHostTarget(target: EventTarget | null): boolean {
  return getMathfieldHostFromTarget(target) !== null;
}

function getFocusableControlFromTarget(target: EventTarget | null): HTMLElement | null {
  const sourceElement =
    target instanceof ShadowRoot ? target.host : target instanceof Element ? target : null;

  if (!(sourceElement instanceof HTMLElement)) {
    return null;
  }

  const candidate = sourceElement.matches(NON_MATHLIVE_FOCUSABLE_SELECTOR)
    ? sourceElement
    : sourceElement.closest(NON_MATHLIVE_FOCUSABLE_SELECTOR);

  if (!(candidate instanceof HTMLElement) || candidate.matches(MATHLIVE_HOST_SELECTOR)) {
    return null;
  }

  if (candidate instanceof HTMLInputElement && candidate.type === "hidden") {
    return null;
  }

  if (
    candidate instanceof HTMLButtonElement ||
    candidate instanceof HTMLInputElement ||
    candidate instanceof HTMLSelectElement ||
    candidate instanceof HTMLTextAreaElement
  ) {
    if (candidate.disabled) {
      return null;
    }
  }

  const contentEditable = candidate.getAttribute("contenteditable");
  if (contentEditable !== null && contentEditable.toLowerCase() !== "false") {
    return candidate;
  }

  if (candidate.tabIndex >= 0) {
    return candidate;
  }

  return null;
}

function isMathfieldContextMenuVisible(field: MathfieldElement): boolean {
  const menuNodes = [
    ...Array.from(field.shadowRoot?.querySelectorAll(`.${MATHLIVE_MENU_CONTAINER_CLASS}`) ?? []),
    ...Array.from(document.querySelectorAll(`.${MATHLIVE_MENU_CONTAINER_CLASS}`)),
  ];

  const menu = menuNodes.find((node) => node instanceof HTMLElement);
  if (!(menu instanceof HTMLElement)) {
    return false;
  }

  const style = window.getComputedStyle(menu);
  const bounds = menu.getBoundingClientRect();

  return style.display !== "none" && style.visibility !== "hidden" && bounds.height > 0;
}

type MathfieldReadFormat = "latex" | "latex-expanded";

function readMathfieldValue(
  field: MathfieldElement,
  format: MathfieldReadFormat = "latex",
): string {
  if (typeof field.getValue === "function") {
    return field.getValue(format);
  }

  return field.value ?? "";
}

function writeMathfieldValue(field: MathfieldElement, nextValue: string) {
  if (typeof field.setValue === "function") {
    field.setValue(nextValue, {
      mode: field.mode,
      silenceNotifications: true,
    });
    return;
  }

  field.value = nextValue;
}

function isMathfieldInteractionTarget(target: EventTarget | null, field: MathfieldElement): boolean {
  if (!(target instanceof Node)) {
    return false;
  }

  if (target === field || field.contains(target) || field.shadowRoot?.contains(target)) {
    return true;
  }

  if (target instanceof ShadowRoot) {
    return target.host === field || isMathfieldHostTarget(target.host);
  }

  if (isMathfieldHostTarget(target)) {
    return true;
  }

  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.classList.contains(MATHLIVE_KEYBOARD_CLASS) ||
    target.closest(`.${MATHLIVE_KEYBOARD_CLASS}`) !== null ||
    target.classList.contains(MATHLIVE_MENU_CONTAINER_CLASS) ||
    target.closest(`.${MATHLIVE_MENU_CONTAINER_CLASS}`) !== null ||
    target.classList.contains(MATHLIVE_MENU_CLASS) ||
    target.closest(`.${MATHLIVE_MENU_CLASS}`) !== null
  );
}

function executeMathfieldCommand(
  field: MathfieldElement,
  command: string | [string, ...unknown[]],
): boolean {
  if (typeof field.executeCommand !== "function") {
    return false;
  }

  try {
    return field.executeCommand(command) === true;
  } catch {
    return false;
  }
}

function normalizeEditorMode(mode: MathfieldMode | undefined): EditorMode {
  return mode === "text" ? "text" : "math";
}

function hasLatexControlSequence(value: string): boolean {
  return LATEX_CONTROL_SEQUENCE_PATTERN.test(value);
}

interface DollarDelimitedSegment {
  inMath: boolean;
  value: string;
}

const PROSE_SEGMENT_PATTERN = /[A-Za-z]{2,}/;

function splitBalancedInlineDollarSegments(value: string): DollarDelimitedSegment[] | null {
  const segments: DollarDelimitedSegment[] = [];
  let buffer = "";
  let inMath = false;
  let sawDelimiter = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const previousCharacter = index > 0 ? value[index - 1] : "";

    if (character === "$" && previousCharacter !== "\\") {
      sawDelimiter = true;
      segments.push({
        inMath,
        value: buffer,
      });
      buffer = "";
      inMath = !inMath;
      continue;
    }

    buffer += character;
  }

  if (!sawDelimiter || inMath) {
    return null;
  }

  segments.push({
    inMath,
    value: buffer,
  });

  return segments;
}

function hasProseTextOutsideMathSegments(segments: DollarDelimitedSegment[]): boolean {
  return segments.some((segment) => !segment.inMath && PROSE_SEGMENT_PATTERN.test(segment.value));
}

function buildMixedLatexPasteContent(segments: DollarDelimitedSegment[]): string {
  return segments.reduce<string>((result, segment) => {
    if (!segment.value) {
      return result;
    }

    if (segment.inMath) {
      const mathValue = segment.value.trim();
      return mathValue ? `${result}${mathValue}` : result;
    }

    return `${result}\\text{${escapeLatexTextForMathModePaste(segment.value)}}`;
  }, "");
}

function escapeLatexTextForMathModePaste(value: string): string {
  return value
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([{}#$%&_])/g, "\\$1")
    .replace(/\^/g, "\\^{}")
    .replace(/~/g, "\\~{}");
}

export function toMathModePasteContent(rawValue: string): string | null {
  const normalizedValue = rawValue.replace(/\r\n?/g, "\n");
  if (!normalizedValue.trim()) {
    return null;
  }

  const balancedDollarSegments = splitBalancedInlineDollarSegments(normalizedValue);
  if (balancedDollarSegments) {
    if (!hasProseTextOutsideMathSegments(balancedDollarSegments)) {
      return null;
    }

    const mixedLatex = buildMixedLatexPasteContent(balancedDollarSegments);
    return mixedLatex || null;
  }

  if (!shouldInsertPastedTextModeContentInMathMode(normalizedValue)) {
    return null;
  }

  return `\\text{${escapeLatexTextForMathModePaste(normalizedValue)}}`;
}

export function shouldInsertPastedTextModeContentInMathMode(rawValue: string): boolean {
  const value = rawValue.replace(/\r\n?/g, "\n").trim();
  if (!value) {
    return false;
  }

  if (!/\s/.test(value)) {
    return false;
  }

  if (hasLatexControlSequence(value)) {
    return false;
  }

  return /[A-Za-z]{2,}/.test(value);
}

export function inferPreferredInitialModeFromValue(rawValue: string): EditorMode {
  const value = rawValue.trim();
  if (!value) {
    return "math";
  }

  const hasLetters = /[A-Za-z]/.test(value);
  const hasWhitespace = /\s/.test(value);

  if (hasLetters && hasWhitespace) {
    return "text";
  }

  return "math";
}

function resolvePreferredInitialMode(
  preferredInitialMode: PreferredInitialMode,
  value: string,
): EditorMode {
  if (preferredInitialMode === "math" || preferredInitialMode === "text") {
    return preferredInitialMode;
  }

  return inferPreferredInitialModeFromValue(value);
}

function blurActiveMathfieldHost(field: MathfieldElement) {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && activeElement.matches(MATHLIVE_HOST_SELECTOR)) {
    activeElement.blur();
    return;
  }

  if (document.activeElement === field) {
    field.blur();
  }
}

function focusMathfieldHost(field: MathfieldElement) {
  const sink = field.shadowRoot?.querySelector(MATHLIVE_KEYBOARD_SINK_SELECTOR);
  if (sink instanceof HTMLElement) {
    sink.focus();
    return;
  }

  field.focus();
}

function focusMathfieldHostWithRecovery(field: MathfieldElement) {
  const ensureFocus = () => {
    if (!field.isConnected || field.matches(":focus-within") || document.activeElement === field) {
      return;
    }

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && !activeElement.matches(MATHLIVE_HOST_SELECTOR)) {
      return;
    }

    focusMathfieldHost(field);
  };

  queueMicrotask(ensureFocus);
  window.setTimeout(ensureFocus, 70);
}

function focusExternalControlWithRecovery(sourceField: MathfieldElement, target: HTMLElement) {
  queueMicrotask(() => {
    target.focus();
  });

  const recoverIfStolen = () => {
    if (!target.isConnected || document.activeElement === target) {
      return;
    }

    if (document.activeElement === sourceField) {
      target.focus();
    }
  };

  window.setTimeout(recoverIfStolen, 80);
  window.setTimeout(recoverIfStolen, 180);
  window.setTimeout(recoverIfStolen, 320);
  window.setTimeout(recoverIfStolen, 520);
  window.setTimeout(recoverIfStolen, 760);
}

function configureCompleteVirtualKeyboardLayouts() {
  if (hasConfiguredCompleteVirtualKeyboard || typeof window === "undefined") {
    return;
  }

  const keyboard = window.mathVirtualKeyboard;
  if (!keyboard) {
    return;
  }

  keyboard.layouts = [...COMPLETE_VIRTUAL_KEYBOARD_LAYOUTS];
  hasConfiguredCompleteVirtualKeyboard = true;
}

function blurAfterPointerUpUnlessTextIsSelected(field: MathfieldElement) {
  const handlePointerUp = () => {
    if (document.activeElement !== field) {
      return;
    }

    const selection = window.getSelection();
    if (selection !== null && !selection.isCollapsed) {
      return;
    }

    blurActiveMathfieldHost(field);
  };

  window.addEventListener("pointerup", handlePointerUp, { capture: true, once: true });
}

function clearStaleFocusedMarkers(field: MathfieldElement) {
  if (field.matches(":focus-within")) {
    return;
  }

  const focusedNodes = field.shadowRoot?.querySelectorAll(".ML__focused") ?? [];
  focusedNodes.forEach((node) => {
    if (node instanceof HTMLElement) {
      node.classList.remove("ML__focused");
    }
  });
}

function clearStaleFocusedMarkersForOtherHosts(activeField: MathfieldElement) {
  const hosts = document.querySelectorAll(MATHLIVE_HOST_SELECTOR);
  hosts.forEach((host) => {
    if (!(host instanceof HTMLElement) || host === activeField) {
      return;
    }

    clearStaleFocusedMarkers(host as MathfieldElement);
  });
}

export function MathliveField({
  id,
  label,
  value,
  onChange,
  preferredInitialMode = "auto",
  placeholder,
  disabled = false,
  required = false,
  description,
  className,
  previewLabel,
  previewFallbackText,
  showPreviewToggle = true,
}: MathliveFieldProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const fieldRef = useRef<MathfieldElement | null>(null);
  const onChangeRef = useRef(onChange);
  const resolvedInitialModeRef = useRef<EditorMode>(
    resolvePreferredInitialMode(preferredInitialMode, value ?? ""),
  );
  const isFocusedRef = useRef(false);
  const pendingExternalValueRef = useRef<string | null>(null);
  const preferredModeRef = useRef<EditorMode>("math");
  const hasUserSelectedModeRef = useRef(false);
  const suppressSinkFocusUntilRef = useRef(0);
  const [isReady, setIsReady] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("math");
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const previewLatex = value ?? "";

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let active = true;

    void import("mathlive")
      .then(async () => {
        if (typeof window !== "undefined") {
          await window.customElements.whenDefined(MATHLIVE_HOST_SELECTOR);
        }

        if (!active) {
          return;
        }

        setIsReady(true);
        setHasLoadError(false);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setIsReady(false);
        setHasLoadError(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const field = fieldRef.current;
    if (!field) {
      return;
    }

    configureCompleteVirtualKeyboardLayouts();

    field.mathModeSpace = "\\:";
    field.mathVirtualKeyboardPolicy = "auto";

    const keyboardSink = field.shadowRoot?.querySelector(MATHLIVE_KEYBOARD_SINK_SELECTOR);
    let restoreKeyboardSinkFocus: (() => void) | null = null;

    if (keyboardSink instanceof HTMLElement) {
      const originalFocus = keyboardSink.focus.bind(keyboardSink);
      const guardedFocus = ((options?: FocusOptions) => {
        const now = Date.now();
        if (now < suppressSinkFocusUntilRef.current && document.activeElement !== field) {
          return;
        }

        originalFocus(options);
      }) as typeof keyboardSink.focus;

      keyboardSink.focus = guardedFocus;
      restoreKeyboardSinkFocus = () => {
        keyboardSink.focus = originalFocus as typeof keyboardSink.focus;
      };
    }

    const handleInput = () => {
      const nextValue = readMathfieldValue(field);
      onChangeRef.current(nextValue);
    };

    const handleModeChange = () => {
      const nextMode = normalizeEditorMode(field.mode);

      if (isFocusedRef.current || document.activeElement === field || field.matches(":focus-within")) {
        hasUserSelectedModeRef.current = true;
      }

      preferredModeRef.current = nextMode;
      field.defaultMode = nextMode;
      setEditorMode(nextMode);
    };

    const handlePaste = (event: Event) => {
      if (disabled) {
        return;
      }

      if (normalizeEditorMode(field.mode) !== "math") {
        return;
      }

      const clipboardText = (event as ClipboardEvent).clipboardData?.getData("text/plain") ?? "";
      const latexText = toMathModePasteContent(clipboardText);
      if (!latexText) {
        return;
      }

      event.preventDefault();

      if (typeof field.insert === "function") {
        field.insert(latexText, {
          mode: "math",
        });
      } else if (typeof field.executeCommand === "function") {
        field.executeCommand(["insert", latexText]);
      } else {
        const nextValue = `${readMathfieldValue(field)}${latexText}`;
        writeMathfieldValue(field, nextValue);
      }

      onChangeRef.current(readMathfieldValue(field));
    };

    const initialMode = resolvedInitialModeRef.current;
    preferredModeRef.current = initialMode;
    field.defaultMode = initialMode;

    if (normalizeEditorMode(field.mode) !== initialMode) {
      const switched = executeMathfieldCommand(field, ["switchMode", initialMode]);
      if (!switched) {
        field.mode = initialMode;
      }
    }

    setEditorMode(normalizeEditorMode(field.mode));

    field.addEventListener("input", handleInput);
    field.addEventListener("change", handleInput);
    field.addEventListener("mode-change", handleModeChange);
    field.addEventListener("paste", handlePaste);

    return () => {
      field.removeEventListener("input", handleInput);
      field.removeEventListener("change", handleInput);
      field.removeEventListener("mode-change", handleModeChange);
      field.removeEventListener("paste", handlePaste);
      restoreKeyboardSinkFocus?.();
    };
  }, [disabled, isReady]);

  useEffect(() => {
    const normalizedValue = value ?? "";
    if (!isReady) {
      pendingExternalValueRef.current = normalizedValue;
      return;
    }

    const field = fieldRef.current;
    if (!field) {
      pendingExternalValueRef.current = normalizedValue;
      return;
    }

    if (isFocusedRef.current || document.activeElement === field) {
      pendingExternalValueRef.current = normalizedValue;
      return;
    }

    if (!hasUserSelectedModeRef.current) {
      preferredModeRef.current = resolvePreferredInitialMode(preferredInitialMode, normalizedValue);
      resolvedInitialModeRef.current = preferredModeRef.current;
    }

    const preferredMode = preferredModeRef.current;
    field.defaultMode = preferredMode;
    if (normalizeEditorMode(field.mode) !== preferredMode) {
      const switched = executeMathfieldCommand(field, ["switchMode", preferredMode]);
      if (!switched) {
        field.mode = preferredMode;
      }
    }

    const currentValue = readMathfieldValue(field);
    if (currentValue !== normalizedValue) {
      writeMathfieldValue(field, normalizedValue);
    }

    pendingExternalValueRef.current = null;
  }, [isReady, preferredInitialMode, value]);

  const closeMathfieldOverlays = useCallback(() => {
    const field = fieldRef.current;
    if (!field) {
      return;
    }

    if (isMathfieldContextMenuVisible(field)) {
      const closedWithCommand = executeMathfieldCommand(field, "toggleContextMenu");
      if (!closedWithCommand) {
        const menus = [
          ...Array.from(field.shadowRoot?.querySelectorAll(`.${MATHLIVE_MENU_CONTAINER_CLASS}`) ?? []),
          ...Array.from(document.querySelectorAll(`.${MATHLIVE_MENU_CONTAINER_CLASS}`)),
        ];

        menus.forEach((menu) => {
          if (!(menu instanceof HTMLElement)) {
            return;
          }

          const popoverMenu = menu as HTMLElement & { hidePopover?: () => void };
          if (typeof popoverMenu.hidePopover === "function") {
            popoverMenu.hidePopover();
          }

          menu.style.display = "none";
          menu.setAttribute("hidden", "true");
        });
      }
    }

    executeMathfieldCommand(field, "hideVirtualKeyboard");
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const field = fieldRef.current;
    if (!field) {
      return;
    }

    const handleBlur = (event: FocusEvent) => {
      isFocusedRef.current = false;

      const scheduleFocusedMarkerCleanup = () => {
        clearStaleFocusedMarkers(field);
      };

      queueMicrotask(() => {
        scheduleFocusedMarkerCleanup();

        const nextTarget = event.relatedTarget ?? document.activeElement;
        const relatedTargetIsMathfieldInteraction =
          nextTarget !== null && isMathfieldInteractionTarget(nextTarget, field);
        if (!relatedTargetIsMathfieldInteraction) {
          closeMathfieldOverlays();
        }

        const pendingValue = pendingExternalValueRef.current;
        if (pendingValue === null) {
          return;
        }

        const latestField = fieldRef.current;
        if (!latestField || document.activeElement === latestField) {
          return;
        }

        const preferredMode = preferredModeRef.current;
        if (normalizeEditorMode(latestField.mode) !== preferredMode) {
          const switched = executeMathfieldCommand(latestField, ["switchMode", preferredMode]);
          if (!switched) {
            latestField.mode = preferredMode;
          }
        }

        const currentValue = readMathfieldValue(latestField);
        if (currentValue !== pendingValue) {
          writeMathfieldValue(latestField, pendingValue);
        }

        pendingExternalValueRef.current = null;
      });

      window.setTimeout(scheduleFocusedMarkerCleanup, 80);
      window.setTimeout(scheduleFocusedMarkerCleanup, 180);
    };

    const handleFocus = () => {
      suppressSinkFocusUntilRef.current = 0;
      isFocusedRef.current = true;
      clearStaleFocusedMarkersForOtherHosts(field);
    };

    const handleFieldPointerDown = () => {
      if (disabled) {
        return;
      }

      suppressSinkFocusUntilRef.current = 0;

      queueMicrotask(() => {
        if (document.activeElement === field || field.matches(":focus-within")) {
          return;
        }

        focusMathfieldHost(field);
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (document.activeElement !== field) {
        return;
      }

      const eventPath = typeof event.composedPath === "function" ? event.composedPath() : [];
      const pathEntries = eventPath.length > 0 ? eventPath : [event.target];
      const isWithinOwnRoot = pathEntries.some(
        (entry) => entry instanceof Node && rootRef.current?.contains(entry),
      );

      if (isWithinOwnRoot) {
        return;
      }

      const targetMathfieldHost =
        pathEntries
          .map((entry) => getMathfieldHostFromTarget(entry))
          .find((host) => host !== null) ?? null;

      if (targetMathfieldHost !== null && targetMathfieldHost !== field) {
        suppressSinkFocusUntilRef.current = Date.now() + 900;
        blurActiveMathfieldHost(field);
        focusMathfieldHostWithRecovery(targetMathfieldHost);
        return;
      }

      if (targetMathfieldHost === null) {
        const peerRoot = pathEntries
          .map((entry) =>
            entry instanceof Element
              ? entry.closest("[data-mathlive-root-for]")
              : null,
          )
          .find((entry) => entry !== null) ?? null;

        if (peerRoot instanceof HTMLElement) {
          const peerId = peerRoot.getAttribute("data-mathlive-root-for");
          const peerField = peerId
            ? (document.getElementById(peerId) as MathfieldElement | null)
            : null;

          if (peerField && peerField !== field) {
            suppressSinkFocusUntilRef.current = Date.now() + 900;
            blurActiveMathfieldHost(field);
            focusMathfieldHostWithRecovery(peerField);
            return;
          }
        }
      }

      const isMathfieldInteraction = pathEntries.some((entry) =>
        isMathfieldInteractionTarget(entry, field),
      );

      if (isMathfieldInteraction) {
        return;
      }

      const focusableControl =
        pathEntries
          .map((entry) => getFocusableControlFromTarget(entry))
          .find((entry) => entry !== null) ?? null;

      if (focusableControl !== null) {
        suppressSinkFocusUntilRef.current = Date.now() + 900;
        blurActiveMathfieldHost(field);
        focusExternalControlWithRecovery(field, focusableControl);
        return;
      }

      blurAfterPointerUpUnlessTextIsSelected(field);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isFocusedRef.current && document.activeElement !== field) {
        return;
      }

      if (event.key !== "Escape") {
        return;
      }

      closeMathfieldOverlays();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    field.addEventListener("pointerdown", handleFieldPointerDown);
    field.addEventListener("focus", handleFocus);
    field.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      field.removeEventListener("pointerdown", handleFieldPointerDown);
      field.removeEventListener("focus", handleFocus);
      field.removeEventListener("blur", handleBlur);
    };
  }, [closeMathfieldOverlays, disabled, isReady]);

  const handleSetMode = useCallback(
    (nextMode: EditorMode) => {
      const field = fieldRef.current;
      if (!field || disabled) {
        return;
      }

      const currentMode = normalizeEditorMode(field.mode);
      if (currentMode === nextMode) {
        return;
      }

      hasUserSelectedModeRef.current = true;

      const switched = executeMathfieldCommand(field, ["switchMode", nextMode]);
      if (!switched) {
        field.mode = nextMode;
      }

      preferredModeRef.current = nextMode;
      field.defaultMode = nextMode;
      setEditorMode(normalizeEditorMode(field.mode));
      field.focus();
    },
    [disabled],
  );

  const handleInsertSymbol = useCallback(
    (latex: string) => {
      const field = fieldRef.current;
      if (!field || disabled) {
        return;
      }

      if (typeof field.insert === "function") {
        field.insert(latex);
      } else if (typeof field.executeCommand === "function") {
        field.executeCommand(["insert", latex]);
      } else {
        const nextValue = `${readMathfieldValue(field)}${latex}`;
        writeMathfieldValue(field, nextValue);
      }

      const nextValue = readMathfieldValue(field);
      onChangeRef.current(nextValue);
      field.focus();
    },
    [disabled],
  );

  const handleEditorSurfacePointerDown = useCallback(() => {
    const field = fieldRef.current;
    if (!field || disabled) {
      return;
    }

    queueMicrotask(() => {
      if (document.activeElement === field || field.matches(":focus-within")) {
        return;
      }

      focusMathfieldHost(field);
    });
  }, [disabled]);

  const handleRootPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const field = fieldRef.current;
      if (!field || disabled) {
        return;
      }

      if (document.activeElement === field || field.matches(":focus-within")) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLButtonElement
      ) {
        return;
      }

      if (target instanceof Element && target.closest("button,input,select,textarea")) {
        return;
      }

      queueMicrotask(() => {
        if (document.activeElement === field || field.matches(":focus-within")) {
          return;
        }

        focusMathfieldHost(field);
      });
    },
    [disabled],
  );

  const handleControlPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();

      const field = fieldRef.current;
      if (!field || disabled) {
        return;
      }

      suppressSinkFocusUntilRef.current = 0;
      queueMicrotask(() => {
        if (document.activeElement === field || field.matches(":focus-within")) {
          return;
        }

        focusMathfieldHost(field);
      });
    },
    [disabled],
  );

  return (
    <div
      ref={rootRef}
      className={cn("grid min-w-0 gap-2", className)}
      data-mathlive-root-for={id}
      onPointerDown={handleRootPointerDown}
    >
      <Label htmlFor={id}>{label}</Label>
      <div
        className="min-w-0 overflow-x-auto rounded-md border border-input bg-background px-3 py-2 shadow-sm"
        onPointerDown={handleEditorSurfacePointerDown}
      >
        <math-field
          id={id}
          ref={(element) => {
            fieldRef.current = (element as MathfieldElement | null) ?? null;
          }}
          className="block min-h-12 w-full text-sm focus:outline-none"
          style={TEXT_TOKEN_HIGHLIGHT_STYLE}
          placeholder={placeholder}
          disabled={disabled}
          aria-disabled={disabled}
          aria-required={required}
          math-virtual-keyboard-policy="auto"
        />
      </div>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      <div className="flex flex-wrap gap-2" role="group" aria-label={`${label} input mode`}>
        <Button
          type="button"
          size="sm"
          variant={editorMode === "math" ? "default" : "outline"}
          onPointerDown={handleControlPointerDown}
          onClick={() => handleSetMode("math")}
          disabled={disabled}
        >
          Math mode
        </Button>
        <Button
          type="button"
          size="sm"
          variant={editorMode === "text" ? "default" : "outline"}
          onPointerDown={handleControlPointerDown}
          onClick={() => handleSetMode("text")}
          disabled={disabled}
        >
          Text mode
        </Button>
        {showPreviewToggle ? (
          <Button
            type="button"
            size="sm"
            variant={isPreviewVisible ? "default" : "outline"}
            onPointerDown={handleControlPointerDown}
            onClick={() => setIsPreviewVisible((previous) => !previous)}
            disabled={disabled}
            aria-pressed={isPreviewVisible}
          >
            {isPreviewVisible ? "Hide preview" : "Show preview"}
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={`${label} symbol shortcuts`}>
        {SYMBOL_TOOLBAR.map((item) => (
          <Button
            key={item.label}
            type="button"
            size="sm"
            variant="outline"
            onPointerDown={handleControlPointerDown}
            onClick={() => handleInsertSymbol(item.latex)}
            disabled={disabled}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {showPreviewToggle && isPreviewVisible ? (
        <KatexPreview
          latex={previewLatex}
          label={previewLabel ?? `${label} preview`}
          fallbackText={previewFallbackText}
        />
      ) : null}
      {!isReady && !hasLoadError ? (
        <p className="text-xs text-muted-foreground">Loading math editor...</p>
      ) : null}
      {hasLoadError ? (
        <p className="text-xs text-destructive">Math editor failed to initialize.</p>
      ) : null}
    </div>
  );
}
