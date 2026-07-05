import { useTheme } from "../lib/theme";
import Icon from "./Icon";

export default function ThemeToggle({ className = "", showLabel = false }: { className?: string; showLabel?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <span className={`theme-toggle-wrap ${className}`.trim()}>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        className={`theme-switch ${isDark ? "dark" : ""}`}
        onClick={toggleTheme}
        aria-label={label}
        title={label}
      >
        <span className="theme-switch-knob">
          <Icon name={isDark ? "moon" : "sun"} size={13} />
        </span>
      </button>
      {showLabel && <span>{label}</span>}
    </span>
  );
}
