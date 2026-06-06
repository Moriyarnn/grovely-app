# Logo Specification

## Assets

All assets live in `grovely-frontend/src/assets/` unless noted.

### Source files

| File | Description | Size |
|---|---|---|
| `Logo Transparent Icon.png` | Icon only (trees + calendar), transparent, source of truth | 699x698 |
| `Logo Transparent Icon Gradient.png` | Icon with 5-band pink gradient, transparent | 699x698 |
| `Logo Transparent Icon Flat.png` | Icon with single flat pink, transparent | 699x698 |
| `Logo Transparent.png` | Full logo (icon + text stacked), transparent | 865x983 |

### In-app logos (opaque, bg-baked)

Browser anti-aliasing creates visible edge artifacts when scaling transparent PNGs over colored backgrounds. All in-app logos are fully opaque RGB with the page background color composited in, eliminating transparency entirely.

| File | Used by | Background | Size |
|---|---|---|---|
| `Logo Side Login.png` | LoginView (desktop) | #fdf0f5 | 2126x778 |
| `Logo Stacked Mobile.png` | LoginView (mobile) | #fdf0f5 | 865x983 |
| `Logo Side Hub.png` | HubView (mobile header) | #fafafa | 2126x778 |
| `Logo Side Desktop.png` | DesktopShell (sidebar) | #ffffff | 2126x778 |

### PWA icons (`public/`)

| File | Size |
|---|---|
| `icon-192.png` | 192x192 |
| `icon-512.png` | 512x512 |
| `favicon.ico` | 16x16, 32x32, 48x48 |

### Source hierarchy

`Logo Transparent Icon.png` is the single source of truth. All other assets are derived from it:

- **Logo Transparent.png** = icon + rendered text, stacked vertically
- **Logo Side \*.png** = icon + rendered text, side by side, bg-baked
- **Logo Stacked Mobile.png** = icon + rendered text, stacked, bg-baked
- **icon-\*.png** / **favicon.ico** = icon scaled to PWA sizes, white background

---

## Text rendering

Used across all assets that include the wordmark.

- Content: `Grovely`
- Font: **Coustard Regular** (Google Fonts, OFL license)
  - Available weights: Regular and Black only (not a variable font)
- Stroke width: **2px** (faux bold - Pillow `stroke_width=2`, `stroke_fill` same as `fill`)
- Color: **RGB(102, 72, 44)** / `#66482C`

---

## Layout - Stacked logos

- Icon: pasted pixel-for-pixel from source (699x698, no rescaling)
- Icon: centered horizontally
- Text font size: **195px**
- Text: centered horizontally, 26px gap below icon
- Padding: 40px on all sides
- Transparent variant: 865x983px RGBA
- Opaque variant: same size, composited over background color, saved as RGB

## Layout - Side logos (horizontal)

- Canvas: auto-width x 778px tall
- Icon: pasted pixel-for-pixel from source (699x698, no rescaling)
- Text: vertically centered against the visual weight of the calendar body (+50px offset from geometric center to account for the pins at the top)
- Text font size: **320px**
- Gap between icon and text: 60px
- Padding: 40px on all sides
- Output: 2126x778, composited over background color, saved as RGB

## Layout - PWA icons

- Source: `Logo Transparent Icon.png`
- 74% fill (26% padding), centered on white canvas, saved as RGB
- Downscaled with LANCZOS resampling
- Manifest purpose: `any` (no maskable - avoids circle mask on home screen)

---

## Color reference

| Element | Hex |
|---|---|
| Text / wordmark | #66482C |
| Login page background | #fdf0f5 |
| Hub background | #fafafa |
| Desktop shell background | #ffffff |
