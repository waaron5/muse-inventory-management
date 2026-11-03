# Interface motion

Researched 2026-10-26 for Add buttons and the account menu.

Amplitude increased on 2026-10-27 at the user's request; timing and easing stay the same.

## Recommendation

Use restrained, immediate feedback with no delay, bounce or looping. The exact distances and scale below are a design judgment for Muse, rather than a universal best animation.

| Interaction | Motion | Duration | Easing |
| --- | --- | --- | --- |
| Main Add button hover or keyboard focus | Scale only the plus from 0.85 to 1.25; return on leave | 150ms | `cubic-bezier(0, 0, 0.38, 0.9)` |
| Account trigger hover or keyboard focus | Move the upper chevron up 3px and lower chevron down 3px; return on leave | 150ms | Same |
| Menu opens | Opacity 0 to 1 | 110ms | Same |
| Menu closes | Opacity 1 to 0 | 70ms | `cubic-bezier(0.2, 0, 1, 0.9)` |

Scaling preserves the plus silhouette. A 45-degree rotation resembles a close icon, while a full turn adds conspicuous movement to a frequent action. This is an inference from the icon's shape and the motion principles below. Keep the button and label stationary so their bounds remain stable.

## Evidence and implementation

- Carbon recommends subtle productive motion for button states and dropdowns. Its tokens include 150ms for small expansion or short movement, 110ms for fades, and 70ms for button/toggle interactions. It defines the entrance and exit curves used above. [Carbon motion](https://www.carbondesignsystem.com/building-blocks/foundations/motion/overview)
- Atlassian places hover and press interactions in the 50–150ms range, recommends understated motion for small controls, and advises faster exits than entrances. [Atlassian motion](https://atlassian.design/foundations/motion)
- Animate transforms and opacity to avoid unnecessary layout or paint work. Do not animate dimensions or spacing, or add `will-change` without a measured need. [Google web.dev animation guide](https://web.dev/articles/animations-guide)
- Use Radix's `data-state="open"` and `data-state="closed"` with CSS keyframes for fades. Radix suspends unmounting until an exit animation completes, so an extra timer or animation dependency is unnecessary. [Radix animation guide](https://www.radix-ui.com/primitives/docs/guides/animation)
- Honor `prefers-reduced-motion`: remove the decorative transforms and menu animations while retaining immediate interaction feedback. [MDN reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)
- Restrict pointer hover motion to devices supporting hover, since touchscreens may emulate hover through an inconvenient long press. Also provide keyboard focus feedback. [MDN hover media feature](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/hover)
