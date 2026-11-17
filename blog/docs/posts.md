# Writing a post

A post is a folder in `src/posts/` with `index.md` and the post's images. The folder's name, of lowercase letters, digits and hyphens, is the post's address, as `src/posts/posts.11tydata.js` sets: `src/posts/influence-without-authority/` becomes `https://blog.when.party/influence-without-authority/`. A post is not a [document](/docs/glossary.md#document), so the [writing rules](/docs/conventions/writing.md) do not apply to it.

A post keeps the views of its date. When the views change, a new post says so and links to the old one, which stays as it was.

`index.md` starts with front matter:

| Field | Required | Holds |
| --- | --- | --- |
| `title` | yes | the title |
| `description` | yes | one or two sentences, shown under the title, in the post's entry in the list and in search results |
| `date` | yes | the day of the post, such as `2026-11-15`, which orders the list, newest first |
| `cover` | no | the file name of the picture beside the title and in the post's entry in the list. Without it, the entry shows an empty frame. |
| `coverAlt` | with `cover` | what the picture shows, for readers who cannot see it |
| `audio` | no | `file`, the name of the MP3 file in the audio folder, and `minutes`, its length. Without it, the post has no player. |
| `credits` | no | who did what, shown as the line under the text of the post page, such as `Conceived and edited by Nikolai Krivous. Drafted by Claude Opus 5.5.` Without it, the line says `Written with help from AI.` |
| `draft` | no | `true` keeps the post off the site; the local preview shows it |

- An image alone in its paragraph, with blank lines around it, becomes a taped card across the text: `![what it shows](name.webp "caption")`. With `#side` after the file name, the card stands at the side and the text flows around it: `![what it shows](name.webp#side "caption")`. Put a side card before the paragraph it belongs to. The caption is optional, the description in square brackets is not. On screens narrower than 600 px every card in the text spans it.
- The cover is cropped to a square beside the title and to 16:10 in the list, and the cards in the text to 3:2. Use WebP pictures about 1600 px wide with the subject in the middle, so the crops keep it. Only `.webp`, `.avif`, `.jpg`, `.jpeg`, `.png` and `.svg` files reach the site.
- Each heading of level 2, `##`, starts a section. A post with more than three gets contents under the description and the audio player.
- A table scrolls sideways when the screen is narrower than it. The alignment of a column, such as `---:`, becomes a class.
- A code block marked `latex` or `math` is a formula, written in the LaTeX that [KaTeX](https://katex.org/docs/supported) reads, and the page shows it on its own line, scrolling sideways when it is wider than the screen. Text between `$` or `$$` signs stays plain text, so write a formula only as a `latex` or `math` block. A block marked `tex` shows LaTeX as code. The build fails when KaTeX cannot read a formula, and on `\pmb` and `\fcolorbox`, whose MathML has a `style` attribute.
- The build fails when a post names an image that its folder does not hold, and when a page has an inline style or script, as [site.md](site.md) says.
- The audio file is named after the post's folder and the first 8 hex digits of the file's SHA-256, which `shasum -a 256 <file> | cut -c1-8` prints, such as `influence-without-authority.3f9a1c2e.mp3`. A new version of the audio gets a new name. Upload it to the audio folder, as [audio.md](audio.md) says, before the post reaches `main` without `draft: true` and [deploys](/.github/docs/deploys.md), so that no reader asks for it before it is there.
- Run `npm ci` in `blog/` once, then `npm start` shows the blog with drafts at http://localhost:8090 and rebuilds it on every save. The `blog` check of CI builds the blog's image in every pull request that changes `blog/`, a post included, as [checks.md](/.github/docs/checks.md#the-checks) says.
