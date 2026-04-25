# MathWiz Global UI Design System

This document outlines the canonical design rules, color palettes, typography, and component styling guidelines for the MathWiz platform. Any new UI development or refactoring must strictly adhere to these specifications.

## 1. Core Principles
- **Clarity & Focus:** Content should be front and center without unnecessary visual clutter.
- **High Contrast:** Ensure strong visual contrast, especially for critical elements like timers and action buttons.
- **Consistent Radii:** Soft, approachable curves for large containers (`rounded-3xl`) and functional curves for interactive elements (`rounded-xl`).
- **Resolution Target:** Optimized for `1920x1080` displays, but fully responsive.

---

## 2. Color Palette

Our core palette utilizes specific brand colors combined with Tailwind's default `slate` palette for neutral grays.

### Brand Colors
| Role | Color Name | Hex Code | Usage | Tailwind Class Example |
| :--- | :--- | :--- | :--- | :--- |
| **Primary** | Primary Orange | `#F49700` | Main actions, highlights, primary borders | `bg-[#f49700]`, `text-[#f49700]` |
| **Brand Dark** | Dark Navy | `#1A1E2E` | Dark contrast cards, footer, distinct panels | `bg-[#1a1e2e]`, `text-[#1a1e2e]` |
| **App Bg (Dark)** | Deep Background | `#0F121A` | Dark mode base background | `bg-[#0f121a]` |
| **App Bg (Light)**| Light Background | `#FAFAFB` | Light mode base background | `bg-[#fafafb]` |
| **Text (Dark)** | Ink Blue | `#0F1C2C` | Primary text in light mode, primary headings | `text-[#0f1c2c]` |

### Status Colors
- **Filled / Active:** Blue (`#1A1E2E` / Tailwind `blue-500`)
- **Solved / Success:** Orange (`#F49700`) or Yellow (`#FCD34D`)
- **Blank / Inactive:** Slate (`#94A3B8` / Tailwind `slate-400`)

### Neutrals
- Use **Tailwind Slate** for all gray elements: borders (`slate-100`, `slate-200`), muted text (`slate-400`, `slate-500`), and subtle backgrounds (`slate-50`).

---

## 3. Typography

**Font Family:** `Poppins`, sans-serif
*(Imported via Google Fonts in `fonts.css`)*

### Font Weights
- **Normal (400):** General body text, inputs.
- **Medium (500):** Subtitles, labels, secondary buttons.
- **Semi-Bold (600):** Highlights, small headers.
- **Bold (700):** Secondary headings, active states.
- **Black (900):** Primary headings, prominent numbers (e.g., scores, timers), primary call-to-actions.

### Styling Conventions
- **Uppercase Labels:** Small metadata tags (e.g., "DIFFICULTY", "POINTS") should be styled with `uppercase`, `tracking-wider` (or `tracking-[2px]`), and a small font size (`text-[9px]` to `text-[11px]`).
- **Headings:** High contrast, tight leading (`leading-tight`, `tracking-tight`), typically colored `#0F1C2C` in light mode.

---

## 4. Border Radius & Shapes

Strict adherence to border radii is required to maintain the MathWiz brand feel.

| Element | Radius Target | Tailwind Class | Notes |
| :--- | :--- | :--- | :--- |
| **Main Cards / Panels** | 24px - 32px | `rounded-[24px]` or `rounded-[32px]` / `rounded-3xl` | Used for major layout sections (e.g., Problem Area, Sidebar). |
| **Standard Buttons** | 12px - 16px | `rounded-[12px]` or `rounded-[16px]` / `rounded-xl` | Used for call-to-actions, navigation buttons. |
| **Inputs / Options** | 16px | `rounded-[16px]` | Used for multiple choice selection blocks. |
| **Pills / Badges** | Full | `rounded-full` | Used for small status tags, timers. |
| **Small UI Elements** | 8px | `rounded-[8px]` / `rounded-lg` | Used for grid items, small icons. |

---

## 5. UI Components

### 5.1 Main Cards
- **Light Mode:** White background (`bg-white`), subtle border (`border border-slate-100`), and light shadow (`shadow-sm`).
- **Dark Mode / Accent Cards:** Dark Navy background (`bg-[#1a1e2e]`), no border, strong shadow (`shadow-xl`), often paired with absolute positioned blurred accent blobs for visual flair.

### 5.2 Buttons
- **Primary Action (Orange):**
  - Background: `bg-[#f49700]`
  - Hover: `hover:bg-[#e08900]`
  - Text: `text-white font-black uppercase tracking-[2px]`
  - Shadow: `shadow-xl shadow-[#f49700]/30`
- **Secondary Action (Dark):**
  - Background: `bg-[#0f1c2c]`
  - Text: `text-white font-bold`
  - Shadow: `shadow-lg shadow-[#0f1c2c]/20`
- **Ghost/Outline Action:**
  - Border: `border-2 border-slate-200`
  - Text: `text-[#0f1c2c] font-bold`
  - Hover: `hover:bg-slate-50`

### 5.3 Selection Options (Multiple Choice)
- **Inactive State:** `bg-white border-slate-100 hover:border-slate-300 text-slate-500`
- **Active State:** `bg-[#f49700]/5 border-[#f49700] text-[#0f1c2c] font-bold`
- Options should be heavily padded (`p-5`) with a `border-2` ring to signify interactivity.

### 5.4 Dynamic Island Navbar
- All top-level navigation must reuse the standard "Dynamic Island Navbar" component.
- The navbar should float slightly below the top of the viewport and maintain a high `z-index`.

---

## 6. Layout & Spacing

- **Containers:** Max width for primary content should generally be constrained (e.g., `max-w-[800px]` for problem areas) to maintain readability on 1920x1080 screens.
- **Flex/Grid Gaps:** Use consistent gap spacing (`gap-4`, `gap-6`, `gap-8`) for flex and grid layouts.
- **Padding:** Generous padding for main content areas (`p-6 lg:p-10` or `p-8 lg:p-12`).

## 7. Interaction & Motion
- Use `transition-all` or `transition-colors` with default durations for buttons and interactive cards.
- Hover states on grid items should scale up slightly (`hover:scale-105`) to provide tactile feedback.