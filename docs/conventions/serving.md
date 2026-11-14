# Serving

These rules apply to the files that this repository serves to browsers from its own images and configs, on the sites and in the games, and to the builds and configs that produce and serve them. The [code rules](/docs/conventions/code.md) apply to these files too.

- When a file that a page loads, such as a style, script, image or font, changes, no HTTP cache on the way, such as Cloudflare's or the browser's, gives the page the old version. So either the page asks for the file under a URL that changes with its content, through a hash of the content in the file's name or in a `?v=` query, or the server sends the file with `Cache-Control: no-cache` or `no-store`.
