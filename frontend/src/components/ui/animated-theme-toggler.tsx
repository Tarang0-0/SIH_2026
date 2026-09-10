"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { flushSync } from "react-dom"

import { Moon, Sun } from "lucide-react"

import { motion, AnimatePresence } from "framer-motion"

import { cn } from "@/lib/utils"

type AnimatedThemeTogglerProps = {
  className?: string
}

type DocumentWithViewTransition = Document & {
  startViewTransition?: (update: () => void) => { ready: Promise<void> }
}

export const AnimatedThemeToggler = ({ className }: AnimatedThemeTogglerProps) => {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [darkMode, setDarkMode] = useState(() =>
    typeof window !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false
  )

  useEffect(() => {
    const syncTheme = () =>
      setDarkMode(document.documentElement.classList.contains("dark"))

    const observer = new MutationObserver(syncTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })
    return () => observer.disconnect()
  }, [])

  const onToggle = useCallback(async () => {
    if (!buttonRef.current) return

    const doc = document as DocumentWithViewTransition

    const applyThemeChange = () => {
      const toggled = !darkMode
      setDarkMode(toggled)
      document.documentElement.classList.toggle("dark", toggled)
      document.documentElement.setAttribute("data-theme", toggled ? "dark" : "light")
      try {
        localStorage.setItem("theme", toggled ? "dark" : "light")
        localStorage.setItem("railpulse-theme", toggled ? "dark" : "light")
      } catch {
        // Handle storage exceptions gracefully
      }
      window.dispatchEvent(new CustomEvent("theme-changed", { detail: { theme: toggled ? "dark" : "light" } }))
    }

    if (!doc.startViewTransition) {
      applyThemeChange()
      return
    }

    try {
      await doc.startViewTransition(() => {
        flushSync(() => {
          applyThemeChange()
        })
      }).ready

      const { left, top, width, height } = buttonRef.current.getBoundingClientRect()
      const centerX = left + width / 2
      const centerY = top + height / 2
      const maxDistance = Math.hypot(
        Math.max(centerX, window.innerWidth - centerX),
        Math.max(centerY, window.innerHeight - centerY)
      )

      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${centerX}px ${centerY}px)`,
            `circle(${maxDistance}px at ${centerX}px ${centerY}px)`,
          ],
        },
        {
          duration: 700,
          easing: "ease-in-out",
          pseudoElement: "::view-transition-new(root)",
        }
      )
    } catch {
      applyThemeChange()
    }
  }, [darkMode])

  return (
    <button
      ref={buttonRef}
      onClick={onToggle}
      aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "relative flex items-center justify-center p-2 rounded-full outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 active:scale-95 transition-transform cursor-pointer",
        className
      )}
      type="button"
    >
      <AnimatePresence mode="wait" initial={false}>
        {darkMode ? (
          <motion.span
            key="sun-icon"
            initial={{ opacity: 0, scale: 0.55, rotate: 25 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.33 }}
            className="flex items-center justify-center text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
          >
            <Sun className="h-5 w-5" />
          </motion.span>
        ) : (
          <motion.span
            key="moon-icon"
            initial={{ opacity: 0, scale: 0.55, rotate: -25 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.33 }}
            className="flex items-center justify-center text-sky-600 dark:text-sky-300 drop-shadow-[0_0_6px_rgba(2,132,199,0.3)]"
          >
            <Moon className="h-5 w-5" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}
