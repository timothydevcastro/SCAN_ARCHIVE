# TRDC Design Identity Guide: SCAN_ARCHIVE PRO

The **SCAN_ARCHIVE** identity is rooted in **Brutalist Archival** aesthetics. It is designed to feel like an official, high-clearance senior scanner tool provided by **TRDC**.

## 1. Visual Philosophy
- **High Contrast**: Pure black and white foundations to emphasize data clarity.
- **Clinical Monospace**: Extensive use of monospace fonts to evoke 90s terminal and archival system vibes.
- **Micro-Artifacts**: Subtle scanlines, raster flicker, and target crosshairs that make the "Live View" feel like an active optical feed.

## 2. Color Palette
| Token | HEX | Usage |
|:---|:---|:---|
| **Core_Black** | `#000000` | Borders, Headers, Primary Buttons |
| **Archival_White** | `#FFFFFF` | Backgrounds, Card Surface |
| **Authorized_Green** | `#22C55E` | TRDC Security Badges, Stable Status |
| **Groq_Blue** | `#60A5FA` | Text Intelligence Indicators |
| **Flux_Purple** | `#C084FC` | Imaging Engine Indicators |
| **Simulator_Yellow** | `#EAB308` | Local Fail-Safe Feedback |

## 3. Typography
- **Primary Data**: `Space Mono`, `Courier Prime`, or any standard `monospace`.
- **UI Interaction**: `Inter`, `Roboto`, or modern Sans-Serif for high readability.
- **Weightings**: Heavy (900) for logos/TRDC branding, Medium (500) for classification data.

## 4. Motion & Interactivity
- **Scanline Overlay**: A constant 0.03 opacity pulsing animation simulating a CRT or sensor refresh.
- **Viewport Flicker**: Subtle opacity shifts during "Acquiring" states to heighten the sense of a real-time sensor.
- **Status Pulse**: 2s ease-in-out pulse on the `TRDC_AUTHORIZED` badge to indicate an active encrypted connection.
- **Staggered Data Entry**: Facts slide in with a 100ms delay to simulate sequential data extraction from the TRDC cloud.

## 5. Branding Elements
- **TRDC Inlay**: The black-and-white TRDC badge must be visible in the header at all times.
- **Legal Footers**: Every data sheet includes `TRDC_PROPERTY // DO_NOT_DISTRIBUTE` as a semi-transparent archival watermark.

---
**Standardized by**: TRDC Visual Engineering Dept.
