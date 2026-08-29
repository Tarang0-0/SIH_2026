# RailETA — Design System & UI/UX Specification

**Problem Statement 26028: Dynamic Forecast of ETA for Coaching Trains**  
*Apple Maps Inspired Minimalist Design Architecture with Real-Time Telemetry & Glassmorphic Precision.*

---

## 1. Design Philosophy

RailETA bridges high-precision machine learning telemetry with human-centric passenger clarity. Inspired by **Apple Maps** and modern iOS design principles, the interface prioritizes:

1. **Information Hierarchy & Instant Comprehension**: Passengers immediately find answers to the core question: *"How much MORE time will it take to reach my station?"*
2. **Apple Maps Minimalism & Frosted Glass**: Translucent layered surfaces (`backdrop-filter: blur(24px)`), subtle 1px border glows, refined neutral slates, and vivid railway state accents.
3. **Fluid Micro-Interactions**: Smooth state transitions, glowing status pulses, spring physics, and animated countdown timers.
4. **Dual Theme Architecture**: Seamless switching between **Apple Maps Daylight White** (crystalline, frosted, high contrast) and **Midnight Dark** (deep space navy, luminous neon telemetry).

---

## 2. Color System & Design Tokens

### Daylight Mode (Apple Maps White)
| Token | Hex / RGBA | Usage |
|---|---|---|
| `--bg-canvas` | `#f8fafc` | Main screen canvas background |
| `--surface-glass` | `rgba(255, 255, 255, 0.82)` | Primary frosted cards with `blur(24px)` |
| `--surface-subtle` | `rgba(241, 245, 249, 0.70)` | Secondary panels and table headers |
| `--border-subtle` | `rgba(15, 23, 42, 0.08)` | Refined 1px card separators |
| `--text-primary` | `#0f172a` | High-contrast headings and primary countdown digits |
| `--text-secondary` | `#475569` | Metadata labels, station codes, and timestamps |
| `--text-muted` | `#94a3b8` | Supporting unit indicators and breadcrumbs |

### Midnight Mode (Deep Space Railway)
| Token | Hex / RGBA | Usage |
|---|---|---|
| `--bg-canvas` | `#070d18` | Deep night sky canvas |
| `--surface-glass` | `rgba(13, 19, 31, 0.72)` | Deep glassmorphic panels with `blur(28px)` |
| `--surface-subtle` | `rgba(255, 255, 255, 0.03)` | Inner cards, table rows, and chips |
| `--border-subtle` | `rgba(255, 255, 255, 0.08)` | Specular edge highlights |
| `--text-primary` | `#ffffff` | Primary glowing text and statistics |
| `--text-secondary` | `#94a3b8` | Subtitles and operational labels |
| `--text-muted` | `#64748b` | Dim hints and auxiliary counters |

### Railway Operational Accent Colors
| Accent | Hex | Significance |
|---|---|---|
| **Vibrant Cyan** (`#06b6d4`) | `#06b6d4` | Live route track, active speed telemetry, primary CTAs |
| **Emerald Green** (`#10b981`) | `#10b981` | On-time status, selected target station, delay recovery |
| **Amber Gold** (`#f59e0b`) | `#f59e0b` | Moderate delay alert, caution speed advisory |
| **Rose Red** (`#ef4444`) | `#ef4444` | Major delay alert, track patrol restriction |
| **Indigo Purple** (`#6366f1`) | `#6366f1` | Machine learning TreeExplainer attribution & AI mode |

---

## 3. Typography & Hierarchy

- **Primary Font**: `Geist Sans`, `-apple-system`, `BlinkMacSystemFont`, `SF Pro Display`, `Inter`.
- **Monospace Font**: `Geist Mono`, `SF Mono`, `JetBrains Mono` (for timestamps, train numbers, and GPS coordinates).

### Scale
- **Hero Remaining Time Display**: `font-black text-3xl sm:text-5xl tracking-tight`
- **Card Titles & Station Names**: `font-bold text-lg sm:text-xl`
- **Telemetry Indicators**: `font-mono font-bold text-sm tracking-wider`
- **Body & Captions**: `font-normal text-xs sm:text-sm text-secondary`

---

## 4. Key Component Specifications

### 1. Passenger Dynamic ETA Hero Card
- **Primary Goal**: Instant travel clarity.
- **Components**:
  - Big glowing countdown time badge (`~1 hr 45 min left`).
  - Target Destination dropdown selector with station code pills.
  - Expected Dynamic Arrival timestamp vs Scheduled Timetable timestamp.
  - 80% Residual Confidence window (`±2.5 min`).
  - Remaining distance (km) and current locomotive velocity (km/h).
  - Share Live Journey button (clipboard link copy with toast).

### 2. Immersive 3D Vector Journey Map
- **Engine**: MapLibre GL JS + MapTiler vector cartography.
- **Controls**:
  - Fullscreen toggle button.
  - Camera Follow Train Mode toggle (auto-centers map viewport with smooth bearing orientation).
  - 3D Pitch tilt toggle (45° perspective view).
  - Two-tone route visualization: solid glowing cyan line for completed track, translucent dashed line for remaining track (sliced via `turf.lineSlice`).
  - Interactive station popups with "Track Time to Here" one-click action.

### 3. OpenTopography SRTM DEM Elevation Profile Chart
- **Engine**: Dynamic SVG terrain spline renderer.
- **Telemetry**:
  - Continuous elevation gradient from origin to terminus.
  - Current Train Altitude marker.
  - Highest Elevation Reached badge (e.g. `582m at Bhopal Ghats`).
  - Live track gradient categorization (Level Track, Uphill Tractive Load, Downhill Gravity Assist).

### 4. Smart Travel Companion (Scenic Sights & Overpass API POIs)
- **Engine**: Live OpenStreetMap Overpass API spatial queries.
- **Categories**:
  - **Waterways**: River crossings (Yamuna, Ganga, Narmada, Hooghly).
  - **Mountains & Ghats**: Western Ghats, Thal Ghat, Bhor Ghat, Vindhyas.
  - **Bridges & Tunnels**: Historic railway bridges and rail viaducts.
  - **Monuments & Heritage**: UNESCO landmarks (Taj Mahal, Gwalior Fort, Sanchi Stupa, CSMT).
  - **Multi-Station Weather**: Real-time OpenWeather atmospheric comparison across Current, Next, and Destination stations.

### 5. Universal Flagship Train Search & Favourites Bar
- **Instant Search**: Match by 5-digit train number, train name, or station code.
- **Recent Searches**: Automatically saves past 5 searched trains in `localStorage` for 1-click re-access.
- **Favourite / Bookmarked Trains**: Star/unstar trains with a dedicated drawer for instant tracking.
- **Auto-Refresh Engine**: Configurable 30s live polling timer with animated radial progress ring.

---

## 5. Animation & Motion Guidelines

```css
/* Easing Curves */
--ease-spring: cubic-bezier(0.16, 1, 0.3, 1);
--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);

/* Transition Durations */
--duration-fast: 150ms;
--duration-normal: 250ms;
--duration-smooth: 400ms;
```

- **Pulsing Live Radar**: 2s ease-in-out infinite glow pulse on the active train marker.
- **Card Hover Elevation**: `-2px` translateY with frosted border highlight.
- **Progress Fill**: Smooth CSS width transition using `--ease-spring`.
