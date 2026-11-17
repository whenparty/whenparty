# The podcast feed

`src/podcast.njk` builds `https://blog.when.party/podcast.xml`, an RSS 2.0 feed with Apple's `itunes` tags for Apple Podcasts and other podcast apps. Each post with `audio` in its front matter, as [posts.md](posts.md) says, is an episode, newest first. The feed is public, so its owner's address is `whenparty@nii.au`, which `www.when.party` shows too.

The feed follows Apple's [guide to RSS](https://help.apple.com/itc/podcasts_connect/#/itcb54353390) and [content guidelines](https://podcasters.apple.com/support/891-content-and-subscription-guidelines):

- The `guid` of an episode is the address of its post, so it stays when a new version of the audio gets a new file name. Apple's guide says that a `guid` never changes.
- The enclosure of an episode gives the size of its file in bytes. The build cannot measure the audio, which lies outside the repository, so the front matter gives the size and the length, and the build fails without them, as posts.md says. Nothing checks them against the file.
- Rule 1.11 of the content guidelines asks that audio generated with AI be disclosed in the content and metadata of each episode and of the show. The description of the show and the start of the description of each episode say so; the audio itself does not, as [podcast-ai-disclosure.md](decisions/podcast-ai-disclosure.md) decides.
- The cover, `src/podcast-cover.jpg`, is a square RGB JPEG of 3000×3000 px without an alpha channel. Apple accepts 1400 to 3000 px, JPEG or PNG, and wants a new URL when the picture changes, which the `?v=` of [site.md](site.md) gives it.
- Apple asks the server to answer `HEAD` and range requests for the audio and the cover. The blog's nginx answers both, and the proxy passes range answers on, as `2-8` of [2-headers.md](/infra/docs/specs/2-headers.md) says.

Podcast players that run in a browser on another site, such as the web versions of podcast apps, cannot play the audio, because every answer carries `Cross-Origin-Resource-Policy: same-origin`, as `2-1` of [2-headers.md](/infra/docs/specs/2-headers.md) says. The apps of Apple Podcasts on the iPhone, iPad and Mac are not browsers and play it.

Podcast apps download each new episode whole to their followers' devices, so the feed adds audio traffic through Cloudflare. [audio-storage.md](decisions/audio-storage.md#decision) says when that traffic is the reason to move the audio.

## Publishing an episode

A post with `audio` becomes an episode when it reaches `main` without `draft: true` and deploys, after its audio is uploaded, as posts.md says. Apple Podcasts reads the feed again on its own. A new version of the audio replaces the file of the episode, and a changed title or description changes the episode.

## Submitting the show

The user submits the show once, after the feed is deployed, in [Apple Podcasts Connect](https://podcastsconnect.apple.com/) with their Apple Account, as Apple's [Submit a new show](https://podcasters.apple.com/support/897-submit-a-show) says, with the feed address `https://blog.when.party/podcast.xml`. Apple validates the feed and reviews the show before it lists it.

The address of the feed does not change. Apple follows a move only through a 301 redirect from the old address and an `<itunes:new-feed-url>` tag in the new feed, both kept for at least four weeks, as Apple's [Change the RSS feed URL](https://podcasters.apple.com/support/837-change-the-rss-feed-url) says.
