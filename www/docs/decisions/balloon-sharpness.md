# Balloon sharpness

## Context

The fill and the pencil lines of a balloon go through the SVG filters `#wash` and `#pencil` in `index.html`. A balloon inflates from `scale: .2` and then bobs without end by animating `rotate`.

Safari reuses the result of an SVG filter from the balloon's first paint when the balloon grows, so after the inflate the balloon stays blurred until a style change of the filtered elements, such as the fill that changes on hover, makes Safari apply the filters again. These checks in Safari 27.2, on a screen with two device pixels per CSS pixel, show it:

| Balloon | In Safari |
| --- | --- |
| Without the inflate | Sharp |
| Inflating by a registered custom property on the main thread instead of `scale` | Blurred |
| Bobbing by a registered custom property `--sway`, with `rotate` set to `--tilt` plus `--sway` | Sharp only without the inflate, and jitters |
| Changing an inherited `fill-opacity` and `stroke-opacity` during the inflate | Sharp, and bobs smoothly |

Chrome applies SVG filters at each paint. While `rotate` animates, Chrome rasterizes the balloon once and turns that image, which softens its pencil lines a little. A balloon that bobs by `--sway` is as sharp in Chrome as one at rest.

## Options

| Option | Advantages | Drawbacks |
| --- | --- | --- |
| Inflate by `scale` and bob by `rotate`, with nothing more | No extra code | Blurred in Safari after the inflate, until a hover |
| `refilter`: during the inflate, `fill-opacity` and `stroke-opacity` of the balloon's SVG go from .99 to 1 | Safari applies the filters again in the last frame of the inflate, at full size. No script | Relies on how Safari invalidates filter results. Has to end with the inflate |
| A script that removes and adds the `filter` attributes when the inflate ends | Sharp in Safari | A script for what styles can do. Checked only with the `--sway` bob |
| Bob by `--sway` instead of `rotate` | Sharp in Chrome | Blurred in Safari after the inflate. Jitters in Safari. Repaints the balloon in every frame |
| Inflate by a registered custom property instead of `scale` | Safari repaints the balloon at each size | Blurred in Safari all the same |
| No inflate | Nothing for Safari to reuse | The balloon no longer inflates |

## Decision

Animate `refilter` with the inflate, and bob by `rotate`. It is the only option that keeps the inflate, the balloon sharp and its bob smooth in Safari without a script. The slight softening of a turning balloon in Chrome is the price of the smooth bob. `--inflate` and `--inflate-delay` give `inflate`, `refilter` and the start of `bob` one timing, because a `refilter` that ends before the inflate leaves the filters at the size the balloon had then.

## Consequences

- [styles.css](../../html/styles.css): `--inflate`, `--inflate-delay`, the animation of `.balloon-art` and `@keyframes refilter`.
