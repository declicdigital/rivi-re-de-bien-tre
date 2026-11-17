# Rivière de Bien-Être

Build a single-page, immersive horizontal-scroll website for a massage therapist, inspired by the scroll feel of terminal-industries.com (cinematic, ultra-smooth, scroll-driven storytelling). All visible text is in French.

## Core scroll mechanic (most important)
- The page NEVER moves down visually. Vertical scrolling (mouse wheel, trackpad, keyboard arrows/space, touch swipe on mobile) is converted into a LEFT-TO-RIGHT journey along a river.
- Implementation: use Lenis for smooth scrolling + GSAP ScrollTrigger. A tall scroll container with a sticky/pinned full-viewport stage (100vw x 100vh); scroll progress (0 → 1) drives the horizontal camera position. Native scrollbar can be hidden but native scroll must keep working (accessibility, keyboard).
- It must feel extremely fluid: inertia/easing (Lenis lerp ~0.08), 60fps, transform-only animations (translate3d), no layout thrashing, will-change where useful. Test that there is no jank.
- Subtle parallax layers: far background (sky/hills/trees) moves slower, river in the middle, foreground elements (reeds, stones, leaves) move faster.

## The river
- A realistic blue river flowing horizontally across the full width of the journey, as the main visual element, seen slightly from above (3/4 view).
- The water must visibly FLOW continuously (even when the user doesn't scroll): animated water using a WebGL fragment shader (react-three-fiber / three.js, or a full-screen GLSL shader) with flowing normal-mapped ripples, soft caustics, light reflections/specular highlights, and a gentle current moving left to right. Deep blue / turquoise / clear water tones, calm and spa-like, not cartoonish.
- Natural riverbanks on both sides: soft green grass, smooth stones, a few reeds, maybe some floating leaves drifting with the current.
- Small fish: several little fish swimming in the river (semi-transparent under the water surface, slightly blurred/tinted by depth), with natural wavy swimming motion, some going with the current, some against it, appearing as the user scrolls along.

## Story points along the river (appear as you scroll)
As the camera travels along the river, glowing points (small luminous dots on the water/bank with a soft pulse) appear at intervals. When each point enters the view, a speech-bubble / soft rounded glassmorphism card pops up above it with an elegant fade + scale + slight upward motion, then fades when it leaves.
1. Point 1 bubble: "Madérothérapie"
2. Point 2 bubble: "Kobido"
3. Final point (end of the journey, larger, centered, more prominent): "Enaoël Perriollat — masseuse fascialiste, diplômée en madérothérapie et Kobido"
Leave enough horizontal space between points so the river can be enjoyed between them. After the final point, the river keeps flowing gently (end state).

## Design
- Calm, premium wellness aesthetic: elegant serif for titles (e.g. Cormorant Garamond), clean sans-serif for small text (e.g. Inter).
- Minimal fixed UI overlay: name "Enaoël Perriollat" small at top-left, a thin horizontal progress bar at the bottom showing journey progress, and a discreet "Scroll pour descendre la rivière" hint with an animated arrow at the very start (disappears once scrolling begins).
- Fully responsive: on mobile, vertical swipe drives the horizontal journey the same way; reduce shader quality on low-power devices; respect prefers-reduced-motion (disable heavy animation, keep content readable).
- Performance: cap device pixel ratio at 2 for the WebGL canvas, lazy-load assets, no backend or database needed.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0a04ffa1-f196-4a8d-9a51-e7f7a1dc798f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
