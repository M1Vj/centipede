"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface MathliveFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  description?: string;
  className?: string;
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

function readMathfieldValue(field: MathfieldElement): string {
  if (typeof field.getValue === "function") {
    return field.getValue();
  }

  return field.value ?? "";
}

function writeMathfieldValue(field: MathfieldElement, nextValue: string) {
  if (typeof field.setValue === "function") {
    field.setValue(nextValue);
    return;
  }

  field.value = nextValue;
}

export function MathliveField({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  required = false,
  description,
  className,
}: MathliveFieldProps) {
  const fieldRef = useRef<MathfieldElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);

  useEffect(() => {
    let active = true;

    void import("mathlive")
      .then(() => {
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
    const field = fieldRef.current;
    if (!field) {
      return;
    }

    const handleInput = () => {
      onChange(readMathfieldValue(field));
    };

    field.addEventListener("input", handleInput);
    field.addEventListener("change", handleInput);

    return () => {
      field.removeEventListener("input", handleInput);
      field.removeEventListener("change", handleInput);
    };
  }, [onChange]);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) {
      return;
    }

    const normalizedValue = value ?? "";
    const currentValue = readMathfieldValue(field);
    if (currentValue === normalizedValue) {
      return;
    }

    writeMathfieldValue(field, normalizedValue);
  }, [value]);

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

      onChange(readMathfieldValue(field));
      field.focus();
    },
    [disabled, onChange],
  );

  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="rounded-md border border-input bg-background px-3 py-2 shadow-sm">
        <math-field
          id={id}
          ref={(element) => {
            fieldRef.current = (element as MathfieldElement | null) ?? null;
          }}
          className="block min-h-12 w-full text-sm focus:outline-none"
          placeholder={placeholder}
          disabled={disabled}
          aria-disabled={disabled}
          aria-required={required}
          virtual-keyboard-mode="onfocus"
        />
      </div>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      <div className="flex flex-wrap gap-2" role="group" aria-label={`${label} symbol shortcuts`}>
        {SYMBOL_TOOLBAR.map((item) => (
          <Button
            key={item.label}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => handleInsertSymbol(item.latex)}
            disabled={disabled}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {!isReady && !hasLoadError ? (
        <p className="text-xs text-muted-foreground">Loading math editor...</p>
      ) : null}
      {hasLoadError ? (
        <p className="text-xs text-destructive">Math editor failed to initialize.</p>
      ) : null}
    </div>
  );
}
