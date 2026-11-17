# Share image

## Context

LinkedIn, X, Facebook, Slack, Telegram, WhatsApp and iMessage show a link preview for a link to a post, with the picture that `og:image` names. The cover of a post is a WebP picture about 1600 px wide, as [posts.md](../posts.md) says, such as the 1586×992 px, 272 KB cover of `influence-without-authority`. As of November 2026:

- LinkedIn asks for at least 1200×627 px at 1.91:1 and names no format ([help](https://www.linkedin.com/help/linkedin/answer/a521928)).
- Facebook asks for 1200×630 px at 1.91:1 and lists only JPEG, GIF and PNG as the type of `og:image` ([images](https://developers.facebook.com/docs/sharing/webmasters/images/), [tags](https://developers.facebook.com/docs/sharing/webmasters/)).
- For X, a [guide](https://frontendchecklist.io/rules/seo/twitter-cards), not X's own documentation, lists JPEG, PNG, GIF and WebP for its large card at 2:1.
- Apple, for iMessage, asks for a picture at least 900 px wide and names no format ([TN3156](https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages)).
- Slack, Telegram and WhatsApp document no format or size. A 2021 [bug report](https://bugs.telegram.org/c/1021/11) says Telegram did not show a WebP `og:image`, and a [thread on the Kirby forum](https://forum.getkirby.com/t/opengraph-meta-content-not-working-in-whatsapp-link-previews/30454) says WhatsApp drops pictures over about 300 KB.

## Options

- The WebP cover as `og:image`. No extra file or step per post. Facebook and Telegram may show no picture, a cover near 300 KB may lose its picture in WhatsApp, and each platform crops 16:10 its own way.
- A JPEG that the build makes from the cover with `sharp`. No step per post. A new package dependency with native code, and a crop away from the middle needs a front matter field for its offset.
- A JPEG of 1200×630 px that the author cuts from the cover and names in front matter. One more file and one more step per post.

## Decision

A JPEG of 1200×630 px under 200 KB that the author cuts from the cover and names in `shareImage`, well below the 300 KB at which WhatsApp drops pictures. It has the format and shape that LinkedIn and Facebook document and that no platform reports trouble with. Against `sharp`, it keeps a native dependency out of the build at the cost of a step per post, and the author sees the crop and can cut the picture by hand when the middle cuts off the subject.

## Consequences

- [posts.md](../posts.md).
- [base.njk](../../src/_includes/base.njk).
- [picture.sh](../../scripts/picture.sh).
