# EpsVect

## EpsVect — Wherever you glance, the interface leans in.

EpsVect is a novel HCI experiment that rethinks how humans navigate digital interfaces. Instead of requiring precise cursor movements and deliberate clicks to switch between panels, tabs, or views, EpsVect continuously reads the subtle direction of your wrist — predicting intent within the first few pixels of motion — and tilts, scales, and highlights the UI toward where you're already going. The interface comes to you, rather than the other way around.

### The problem

Switching between UI elements today demands exact targeting (Fitts's law), long drags, and visual search. On dense dashboards and multi-pane layouts this is slow, tiring, and cognitively heavy.

### The idea

A nudge of the wrist carries intent. A 3px movement already tells you which way the user wants to go — if you listen carefully enough. EpsVect combines an adaptive One Euro Filter (for sub-pixel jitter removal) with a tuned Kalman Filter (for velocity-based direction prediction) to decode intent in under 50ms, then animates the UI to guide the gesture home. The cursor doesn't cross the screen alone — the interface bends toward the destination.

### What this means for UX

- Switch tabs, panes, and tools with tiny flicks rather than full drags
- The UI tilts and glows in your predicted direction, confirming intent before you commit
- Sub-pixel precision on noisy input (trackpads, high-DPI mice, touchpads)
- Zero-click micro-navigation — direction becomes the input
- Every parameter (filter smoothing, prediction horizon, UI response curve) is exposed for designers, not just engineers

This repository is both a research prototype and a production-ready library: a high-frequency signal pipeline, a rendering layer, and a debug toolkit (freeze inspection, sliding-window quality metrics, history recorder, JSON/CSV export) for designing and tuning intent-aware interfaces.
