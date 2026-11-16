# Balloon sharpness

## Context

The fill and the pencil lines of a balloon go through the SVG filters `#wash` and `#pencil` in `index.html`. A balloon inflates from `scale: .2` and then bobs without end by animating `rotate`. When Back restores the page from the back-forward cache, `takeoff.js` removes `is-flying`, so the balloon that flew inflates again.

Safari reuses the result of an SVG filter from the balloon's first paint when the balloon grows, so after the inflate the balloon stays blurred until a style change of the filtered elements, such as the fill that changes on hover, makes Safari apply the filters again. After Back from `blog.when.party` or `games.when.party` to a local copy of the page, a style change at the end of the new inflate comes too early: the checks suggest that Safari draws the balloon at full size some time after the `inflate` animation ends. Back from `www.when.party`, which is the same site, was not checked.

The options below give results of checks by eye in Safari 27.2, on a screen with two device pixels per CSS pixel, unless a cell says Chrome. Results after Back are of the balloon that flew, coming back from those two sites unless a cell says a local page of the same origin.

Chrome applies SVG filters at each paint. While `rotate` animates, Chrome rasterizes the balloon once and turns that image, which softens its pencil lines a little.

## Options

`refilter` animates the `fill-opacity` and `stroke-opacity` of the balloon's SVG, which its filtered elements inherit, from .99 to 1.

| Option | Advantages | Drawbacks |
| --- | --- | --- |
| Inflate by `scale` and bob by `rotate`, with nothing more | No extra code | Blurred after the inflate, until a hover |
| `refilter` during the first inflate only | Sharp on load, and bobs smoothly. No change to `takeoff.js` | Blurred after Back |
| `refilter` with every inflate, ending with it | Sharp on load, and bobs smoothly. No change to `takeoff.js` | Blurred after Back |
| `refilter` with every inflate, linear, and for 1 s after it | Sharp on load and after Back in both checks, and bobs smoothly. No change to `takeoff.js` | Relies on how Safari invalidates filter results. Safari applies the filters again in every frame of that second. The second is the only margin checked, not one that Safari states. `ease` was not checked |
| `refilter` without end once the balloon is back | Sharp after Back, and bobs smoothly, with no margin to choose | Safari applies the filters again in every frame while the page stays open. Needs a class that `takeoff.js` sets |
| A script that removes the `filter` attributes when the inflate ends and adds them back in the next frame | Sharp after the first inflate with the `--sway` bob, and after Back from a local page | A script for what styles can do. Blurred after Back. Run 500 ms after the inflate ends: blurred at first, then sharp in one check of two |
| A fade at rest instead of the new inflate after Back | Nothing scales after Back | Blurred until the fade ends. The balloon no longer inflates when it comes back |
| Bob by a registered custom property `--sway`, with `rotate` set to `--tilt` plus `--sway` | Sharp in Chrome. Sharp without the inflate | Blurred after the inflate. Jitters. Repaints the balloon in every frame |
| Inflate by a registered custom property on the main thread instead of `scale` | Safari repaints the balloon at each size | Blurred all the same |
| No inflate | Sharp: nothing for Safari to reuse | The balloon no longer inflates |

## Decision

Animate `refilter` with every inflate, linear, and for 1 s after it, and bob by `rotate`. It is the only option sharp both on load and after Back that keeps the inflate and the smooth bob without a change to `takeoff.js`. Safari applies the filters again in every frame until 1 s past the inflate, not while the page stays open. `refilter` is linear, so that the opacities change as much in its last frames as in its first. The slight softening of a turning balloon in Chrome is the price of the smooth bob. `inflate`, `refilter` and `bob` take their timing from `--inflate` and `--inflate-delay`, because a `refilter` that ends before Safari draws the balloon at full size leaves the filters at the size the balloon had then.

## Consequences

- [styles.css](../../html/styles.css): `--inflate`, `--inflate-delay`, the animations of `.balloon-art` and `.is-flying .balloon-art`, and `@keyframes refilter`.
- [site.md](../site.md): the takeoff rule about `refilter`.
- [page.browser.test.ts](../../tests/page.browser.test.ts): the test of a page restored from the back-forward cache.
