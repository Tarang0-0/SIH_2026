# RailETA — Design System & Visual Contract

**Document ID:** `docs/DESIGN_SYSTEM.md`  
**Problem Statement:** Smart India Hackathon 2026 — PS 26028  
**Design Standard:** Google Stitch + Linear/Apple Transport Aesthetic + React Bits Polish  
**Date:** 2026-08-28  

---

## 1. Color Tokens & Semantic System

The RailETA design system uses a dark, high-contrast palette optimized for clarity and reduced eye strain:

```css
:root {
  /* Surfaces & Backgrounds */
  --bg-primary: #070d18;       /* Deep space navy background */
  --bg-surface: #0b1220;       /* Card and sidebar background */
  --bg-surface-elevated: #131b2b; /* Modals, dropdowns, active panels */

  /* Text & Foreground */
  --text-primary: #ffffff;     /* Pure white for headers & large times */
  --text-secondary: #94a3b8;   /* Cool slate for subtitles & metadata */
  --text-muted: #64748b;       /* Dark slate for secondary hints */

  /* Semantic Status Accents */
  --accent-cyan: #06b6d4;      /* Brand accent, active selections, next station */
  --status-on-time: #10b981;   /* Emerald for on-time running & recovery */
  --status-delayed: #f59e0b;   /* Amber for moderate delays (+1 to +15m) */
  --status-severe: #ef4444;    /* Crimson for severe delays (>15m) */
  --status-neutral: #64748b;   /* Slate for completed/passed stops */

  /* Borders & Glows */
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-strong: rgba(255, 255, 255, 0.15);
  --border-focus: rgba(6, 182, 212, 0.6);
}
```

---

## 2. Typography Scale

- **Display Numbers (ETA / Large Clock):** `font-mono`, `text-4xl` to `text-5xl`, `font-extrabold`, high contrast (`#67e8f9` / `#6ee7b7`).
- **Section Headers:** `font-sans`, `text-lg` to `text-2xl`, `font-extrabold`, `tracking-tight`, `#ffffff`.
- **Card Subheaders / Labels:** `font-mono`, `text-[10px]` to `text-xs`, `uppercase`, `tracking-wider`, `#94a3b8`.
- **Body & Plain Language Text:** `font-sans`, `text-xs` to `text-sm`, `font-normal`, `#cbd5e1`.
- **Station Codes & Technical Metrics:** `font-mono`, `text-xs`, `font-bold`, `#38bdf8`.

---

## 3. Button Hierarchy

| Tier | Visual Treatment | Use Case | Example |
|:---|:---|:---|:---|
| **Primary** | Solid cyan or emerald background, bold text, shadow glow. | Primary action per screen/card. | `Search Train`, `Apply Disruption` |
| **Secondary** | Dark surface with subtle border (`border-white/15`), hover brightness. | Mode switching, filtering, secondary tools. | `Passenger Mode`, `Operations Mode` |
| **Tertiary** | Ghost button, text only with icon, underline on hover. | Expand details, clear search, dismiss. | `Why did ETA change?`, `Clear` |
| **Destructive** | Crimson tint with amber/red border, explicit confirmation modal. | Resetting simulation state. | `Reset Replay State` |

---

## 4. Status Badges & Glow Dots

- **On-Time Badge:**
  `bg-emerald-500/15 border-emerald-500/40 text-emerald-300` + animated pulsing green dot.
- **Delay Badge:**
  `bg-amber-500/15 border-amber-500/40 text-amber-300` + solid amber dot.
- **Severe Delay Badge:**
  `bg-rose-500/15 border-rose-500/40 text-rose-300` + solid red dot.
- **Data Provenance Badges:**
  - `LIVE DATA`: Emerald dot + green pill.
  - `DEMO REPLAY (SIMULATED)`: Cyan dot + slate pill.
  - `⚠ STALE`: Amber warning icon + yellow pill.

---

## 5. Microinteractions & Feedback Rules

1. **Live ETA Updates:** When a WebSocket message recalculates an arrival time, a subtle toast notification appears at the bottom-right for 4 seconds (`ETA updated: 18:41 → 18:48`).
2. **Search Autocomplete:** Debounced at 200ms with smooth fade-in dropdown; keyboard navigation highlighted with cyan glow.
3. **Reduced Motion:** All pulse, ping, and spin animations respect `@media (prefers-reduced-motion: reduce)`.
