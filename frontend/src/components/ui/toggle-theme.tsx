"use client";

import { useId } from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "@/app/components/ThemeContext";

const SwitchToggleThemeDemo = ({ className }: { className?: string }) => {
  const id = useId();
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  const handleCheckedChange = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light');
  };

  return (
    <div className={cn("group inline-flex items-center gap-2", className)}>
      <span
        id={`${id}-light`}
        className={cn(
          "cursor-pointer text-left text-sm font-medium transition-colors p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800",
          isDark ? "text-slate-400 dark:text-slate-500" : "text-amber-500 dark:text-amber-400 font-bold",
        )}
        aria-controls={id}
        onClick={() => handleCheckedChange(false)}
        title="Switch to light mode"
      >
        <SunIcon className="size-4" aria-hidden="true" />
      </span>

      <Switch
        id={id}
        checked={isDark}
        onCheckedChange={handleCheckedChange}
        aria-labelledby={`${id}-light ${id}-dark`}
        aria-label="Toggle between dark and light mode"
      />

      <span
        id={`${id}-dark`}
        className={cn(
          "cursor-pointer text-right text-sm font-medium transition-colors p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800",
          !isDark ? "text-slate-400 dark:text-slate-500" : "text-sky-500 dark:text-cyan-400 font-bold",
        )}
        aria-controls={id}
        onClick={() => handleCheckedChange(true)}
        title="Switch to dark mode"
      >
        <MoonIcon className="size-4" aria-hidden="true" />
      </span>
    </div>
  );
};

export default SwitchToggleThemeDemo;
export { SwitchToggleThemeDemo };
