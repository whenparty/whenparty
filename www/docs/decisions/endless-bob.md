# Endless bob

## Context

After they inflate, the balloons bob without end, and visitors who ask for reduced motion see no motion at all. The balloons carry the links Games and Blog. [balloon-sharpness.md](balloon-sharpness.md#decision) decides how they inflate and bob so that Safari draws them sharp; whether Safari keeps them sharp after a bob ends or pauses has not been checked.

WCAG 2.2 success criterion 2.2.2, Pause, Stop, Hide, at level A, asks that motion which starts by itself, lasts more than 5 seconds and is shown beside other content can be paused, stopped or hidden, or ends within 5 seconds. Its techniques for 2.2.2 are such a control and such an end; `prefers-reduced-motion` serves another criterion, 2.3.3, Animation from Interactions.

## Options

| Option | Advantages | Drawbacks |
| --- | --- | --- |
| Bob without end, the previous decision | The balloons stay alive while the page is open. No change, and the sharpness of balloon-sharpness.md holds | The page does not meet 2.2.2 for visitors who have not asked for reduced motion |
| Stop the bob 5 seconds after the inflate starts | Meets 2.2.2 without a control | The balloons sway about once and then stand still. Sharpness in Safari after the bob ends is unchecked, and balloon-sharpness.md would change |
| A control that pauses the bob | Meets 2.2.2, and the balloons move until a visitor pauses them | A new control, script and styles on a page of a few lines of text. Sharpness in Safari after a pause is unchecked |

## Decision

Bob without end. The moving balloons are part of how the page looks, and visitors who find motion hard can ask their device for reduced motion, which stops it. That outweighs meeting 2.2.2 with a stop that leaves the balloons still or with a control on so small a page.

## Consequences

- [styles.css](../../html/styles.css): the `bob` animation of `.balloon-float`.
