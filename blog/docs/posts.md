# Writing a post

A post is a folder in `src/posts/` with `index.md` and the post's images. The folder's name, of lowercase letters, digits and hyphens, is the post's address, as `src/posts/posts.11tydata.js` sets: `src/posts/influence-without-authority/` becomes `https://blog.when.party/influence-without-authority/`. Do not rename the folder of a published post with audio: its address is the `guid` of its [podcast episode](podcast.md), which Apple's guide says never changes. A post is not a [document](/docs/glossary.md#document), so the [writing rules](/docs/conventions/writing.md) do not apply to it.

A post keeps the views of its date. When the views change, a new post says so and links to the old one, which stays as it was.

`index.md` starts with front matter:

| Field | Required | Holds |
| --- | --- | --- |
| `title` | yes | the title |
| `description` | yes | one or two sentences, shown under the title, in the post's entry in the list, in search results and in link previews |
| `date` | yes | the day of the post, such as `2026-11-15`, which orders the list, newest first |
| `cover` | no | the file name of the picture beside the title and in the post's entry in the list. Without it, the entry shows an empty frame. |
| `coverAlt` | with `cover` | what the picture shows, for readers who cannot see it |
| `shareImage` | no, only with `cover` | the file name of the picture of the link preview, cut from the cover as below and described by `coverAlt`. Without it, the page names no picture for link previews. |
| `audio` | no | `file`, the name of the MP3 file in the audio folder; `bytes`, its size in bytes; and `seconds`, its length in whole seconds. The podcast feed needs all three. The post page and the list show the length rounded to minutes. Without `audio`, the post has no player and no episode in the feed. |
| `credits` | no | who did what, shown as the line under the text of the post page, such as `Conceived and edited by Nikolai Krivous. Drafted by Claude Opus 5.5.` Without it, the line says `Written with help from AI.` |
| `draft` | no | `true` keeps the post off the site; the local preview shows it |

- An image alone in its paragraph, with blank lines around it, becomes a taped card across the text: `![what it shows](name.webp "caption")`. The caption is optional, the description in square brackets is not.
- With `#side` after the file name, as in `![what it shows](name.webp#side "caption")`, the card is a side card. A side card outside quotes and lists belongs to the block right after it when that block is a paragraph of text, a quote or a list. In windows 1280 px wide and wider such a card stands in the margin to the right of its block, level with its top, and stays in view until the block scrolls past; the text after a block shorter than the card starts below the card. In narrower windows it stands across the text above the block. Other side cards, such as one inside a quote, at the end of the post or before a heading, table, formula or another card, are cards across the text at every width.
- The cover is cropped to a square beside the title and to 16:10 in the list, and the cards in the text to 3:2. Use WebP pictures about 1600 px wide with the subject in the middle, so the crops keep it. Only `.webp`, `.avif`, `.jpg`, `.jpeg`, `.png` and `.svg` files reach the site.
- Cut the picture of the link preview from the middle of the cover at its full width and a height of width × 630 ÷ 1200, rounded, and save it as a JPEG of exactly 1200×630 px, the size that `src/_includes/base.njk` declares, under 200 KB, as [share-image.md](decisions/share-image.md#decision) decides. When the middle cuts off the subject, cut it in an image editor instead. `sips` comes with macOS and prints the width with `sips -g pixelWidth <cover>`; `brew install jpeg-turbo` installs `cjpeg`. For the cover of `influence-without-authority`, 1586 px wide, in the post's folder:

  ```bash
  sips -s format png -c 833 1586 influence-cover.webp --out "$TMPDIR/crop.png"
  sips -z 630 1200 "$TMPDIR/crop.png" --out "$TMPDIR/share.png"
  cjpeg -quality 80 -optimize -progressive -outfile influence-share.jpg "$TMPDIR/share.png"
  ```

  When the JPEG is 200 KB or larger, run `cjpeg` again with a lower `-quality`.
- LinkedIn, Facebook and Telegram keep the link preview of a page once they have fetched it. After a deploy that changes the `title`, the `description` or the picture of the link preview of a published post, ask the user to refresh the preview with their accounts: in LinkedIn's [Post Inspector](https://www.linkedin.com/post-inspector/), which changes only the previews of links shared on LinkedIn after the inspection, in Facebook's [Sharing Debugger](https://developers.facebook.com/tools/debug/) and by sending the link to `@WebpageBot` in Telegram. X, Slack, WhatsApp and iMessage have no such tool.
- Each heading of level 2, `##`, starts a section. A post with more than three gets contents under the description and the audio player.
- A table scrolls sideways when the text column is narrower than it. The alignment of a column, such as `---:`, becomes a class.
- A code block marked `latex` or `math` is a formula, written in the LaTeX that [KaTeX](https://katex.org/docs/supported) reads, and the page shows it on its own line, scrolling sideways when it is wider than the text column. Text between `$` or `$$` signs stays plain text, so write a formula only as a `latex` or `math` block. A block marked `tex` shows LaTeX as code. The build fails when KaTeX cannot read a formula, and on `\pmb` and `\fcolorbox`, whose MathML has a `style` attribute.
- The build fails when a post names an image that its folder does not hold, when a page has an inline style or script, as [site.md](site.md) says, and when the `audio` of a post lacks a `file` named after its folder as below, or whole numbers above 0 in `bytes` and `seconds`.
- The audio file is named after the post's folder and the first 8 hex digits of the file's SHA-256, which `shasum -a 256 <file> | cut -c1-8` prints, such as `influence-without-authority.3f9a1c2e.mp3`. A new version of the audio gets a new name, and new `bytes` and `seconds`. `wc -c < <file>` prints the size, and `ffprobe -v error -show_entries format=duration -of csv=p=0 <file>` prints the length in seconds, which you round to whole seconds; `brew install ffmpeg` installs `ffprobe`. Upload the file to the audio folder, as [audio.md](audio.md) says, before the post reaches `main` without `draft: true` and [deploys](/.github/docs/deploys.md), so that no reader or podcast app asks for it before it is there.
- Run `npm ci` in `blog/` once, then `npm start` shows the blog with drafts at http://localhost:8090 and rebuilds it on every save. The `blog` check of CI builds the blog's image in every pull request that changes `blog/`, a post included, as [checks.md](/.github/docs/checks.md#the-checks) says.
