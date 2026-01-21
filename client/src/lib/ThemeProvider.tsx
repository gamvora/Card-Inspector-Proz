import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system" | "nighty" | "forest" | "sunset";

type ThemeContextType = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark" | "nighty" | "forest" | "sunset";
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as Theme) || "dark";
    }
    return "dark";
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark" | "nighty" | "forest" | "sunset">("dark");

  useEffect(() => {
    const root = window.document.documentElement;
    
    root.classList.remove("light", "dark", "nighty", "forest", "sunset");

    let resolved: "light" | "dark" | "nighty" | "forest" | "sunset";
    
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      resolved = systemTheme;
    } else {
      resolved = theme;
    }

    root.classList.add(resolved);
    
    const darkThemes = ["dark", "nighty", "forest"];
    if (darkThemes.includes(resolved)) {
      root.classList.add("dark");
    }
    
    setResolvedTheme(resolved);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = (e: MediaQueryListEvent) => {
        const root = window.document.documentElement;
        root.classList.remove("light", "dark");
        const newTheme = e.matches ? "dark" : "light";
        root.classList.add(newTheme);
        setResolvedTheme(newTheme);
      };
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
