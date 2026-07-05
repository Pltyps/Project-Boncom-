import { useEffect, useRef, useState } from "react";

interface NumericInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  allowNegative?: boolean;
  min?: number;
  "aria-label"?: string;
}

// Matches valid *and* in-progress numeric text (e.g. "12.", "-", "") so
// typing is never blocked mid-keystroke - only truly invalid characters
// (letters, symbols, extra dots) trigger the error state.
function partialPattern(allowNegative: boolean) {
  return allowNegative ? /^-?\d*\.?\d*$/ : /^\d*\.?\d*$/;
}

export default function NumericInput({
  value,
  onChange,
  className,
  placeholder,
  allowNegative = false,
  min,
  ...rest
}: NumericInputProps) {
  const [text, setText] = useState(() => String(value));
  const [error, setError] = useState<string | null>(null);
  const lastValidRef = useRef(value);

  useEffect(() => {
    if (value !== lastValidRef.current) {
      lastValidRef.current = value;
      setText(String(value));
    }
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setText(next);

    // Empty or a bare sign/decimal point is a normal mid-typing state, not
    // an error - just don't propagate a number yet.
    if (next === "" || next === "-" || next === "." || next === "-.") {
      setError(null);
      return;
    }

    if (!partialPattern(allowNegative).test(next)) {
      setError(allowNegative ? "Numbers only, e.g. -12.5" : "Numbers only, e.g. 12.5");
      return;
    }

    const parsed = Number(next);
    if (Number.isNaN(parsed)) {
      setError("Enter a valid number");
      return;
    }
    if (min !== undefined && parsed < min) {
      setError(`Must be ${min} or more`);
      return;
    }

    setError(null);
    lastValidRef.current = parsed;
    onChange(parsed);
  }

  function handleBlur() {
    if (error || text === "" || text === "-" || text === "." || text === "-.") {
      setText(String(lastValidRef.current));
      setError(null);
    }
  }

  return (
    <div className="numeric-input-wrap">
      <input
        type="text"
        inputMode="decimal"
        className={className}
        placeholder={placeholder}
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {error && (
        <span className="numeric-input-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
