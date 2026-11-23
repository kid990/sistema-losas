import { useEffect, useState } from "react";
import { FaMoon, FaSun } from "react-icons/fa";

type Theme = "light" | "dark";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
  variant?: "icon" | "segmented";
}

const STORAGE_KEY = "sirlod-theme";

function resolveTheme(): Theme {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle({ className = "", showLabel = false, variant = "icon" }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(resolveTheme());
  }, []);

  const applyTheme = (nextTheme: Theme) => {
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    setTheme(nextTheme);
  };

  if (variant === "segmented") {
    return (
      <div className={`theme-switch ${className}`} role="group" aria-label="Tema de la interfaz">
        <button
          type="button"
          className={theme === "light" ? "is-active" : ""}
          onClick={() => applyTheme("light")}
          aria-pressed={theme === "light"}
          aria-label="Tema claro"
          title="Tema claro"
        >
          <FaSun aria-hidden="true" />
        </button>
        <button
          type="button"
          className={theme === "dark" ? "is-active" : ""}
          onClick={() => applyTheme("dark")}
          aria-pressed={theme === "dark"}
          aria-label="Tema oscuro"
          title="Tema oscuro"
        >
          <FaMoon aria-hidden="true" />
        </button>
      </div>
    );
  }

  const nextTheme = theme === "dark" ? "light" : "dark";
  const label = nextTheme === "dark" ? "Activar tema oscuro" : "Activar tema claro";

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={() => applyTheme(nextTheme)}
      aria-label={label}
      title={label}
    >
      {theme === "dark" ? <FaSun aria-hidden="true" /> : <FaMoon aria-hidden="true" />}
      {showLabel && <span>{theme === "dark" ? "Tema claro" : "Tema oscuro"}</span>}
    </button>
  );
}
