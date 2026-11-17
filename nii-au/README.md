# nii.au site

The site at [www.nii.au](https://www.nii.au); `nii.au` [redirects](/infra/docs/specs/3-sites.md) to it. It is "little by little.", a one-page site for a small creative club that offers one creative prompt each week.

The page opens with an illustrated journey through a pencil-and-watercolor coastal village. Scrolling moves a [10-second video](docs/media.md) forward and back, and a slider does the same. Portrait phones get a narrow slice of the frame that pans with the scroll. Browsers that decode AV1 in hardware get smaller AV1 files, and others get H.264.

```mermaid
flowchart TD
  open[Visitor opens the page] --> poster[Poster: the first frame]
  poster --> reduced{Reduced motion?}
  reduced -->|yes| still[Poster stays]
  reduced -->|no| slow{"Slow connection or Save-Data?"}
  slow -->|no| fetch[Video downloads after the page loads]
  slow -->|yes| onscroll[Video downloads on the first scroll]
  fetch --> swap[Video replaces the poster]
  onscroll --> swap
  swap --> scrub[Scroll moves the video]
  open --> worker[Service worker installs]
  worker --> shell[Caches the page, styles and posters]
  swap --> keep[Worker keeps this video]
```

The site can be installed as an app and works [offline](docs/caching.md#offline-use) after a visit that loaded the video. Every deploy gives the changed media, styles and scripts [new names](docs/caching.md#content-hashed-names), so browsers keep those files for a year and still get each change on the next visit.

An nginx container serves the site behind the nginx proxy in [`infra/`](/infra/README.md), which adds TLS and the [security headers](/infra/docs/specs/2-headers.md). A change [goes live](/.github/docs/deploys.md) when it reaches `main`.
