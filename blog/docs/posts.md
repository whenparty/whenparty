# Writing a post

A post is a folder in `src/posts/` with `index.md` and the post's images. The folder's name, of lowercase letters, digits and hyphens, is the post's address, as `src/posts/posts.11tydata.js` sets: `src/posts/influence-without-authority/` becomes `https://blog.when.party/influence-without-authority/`. A post is not a [document](/docs/glossary.md#document), so the writing rules do not apply to it.

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
| `draft` | no | `true` keeps the post off the site; the local preview shows it |

- An image alone in its paragraph, with blank lines around it, becomes a taped card across the text: `![what it shows](name.webp "caption")`. With `#side` after the file name, the card stands at the side and the text flows around it: `![what it shows](name.webp#side "caption")`. Put a side card before the paragraph it belongs to. The caption is optional, the description in square brackets is not. On screens narrower than 600 px every card in the text spans it.
- The cover is cropped to a square beside the title and to 16:10 in the list, and the cards in the text to 3:2. Use WebP pictures about 1600 px wide with the subject in the middle, so the crops keep it. Only `.webp`, `.avif`, `.jpg`, `.jpeg`, `.png` and `.svg` files reach the site.
- Each heading of level 2, `##`, starts a section. A post with more than three gets contents under the description and the audio player.
- A table scrolls sideways when the screen is narrower than it. The alignment of a column, such as `---:`, becomes a class.
- The build fails when a post names an image that its folder does not hold, and when a page has an inline style or script, as [site.md](site.md) says.
- The audio file is named after the post's folder and the first 8 hex digits of the file's SHA-256, which `shasum -a 256 <file> | cut -c1-8` prints, such as `influence-without-authority.3f9a1c2e.mp3`. A new version of the audio gets a new name. Upload it to the audio folder, as [audio.md](audio.md) says, before the post reaches `main` without `draft: true`, so that no reader asks for it before it is there.
- Run `npm ci` in `blog/` once, then `npm start` shows the blog with drafts at http://localhost:8090 and rebuilds it on every save. Nothing in CI builds the blog before the deploy, so run `npm run build` before a post reaches `main`.
