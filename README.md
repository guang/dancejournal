# dancejournal
## Move Library pages (`/library/`, `/bachata/…`)

Generated, don't hand-edit. They mirror the app's Discover (topic cards, subtopic rows, a page per move) and are
built from what dj-library has **published** to Firestore:

```bash
cd scripts/library && npm install      # once (firebase-admin, qrcode)
node export.js                          # read-only: published topics + moves → .cache/library.json
node build.js                           # rewrites library/, bachata/, sitemap.xml, robots.txt
```

- Run it after publishing a topic in dj-library (or a takedown) and commit the result.
- A topic gets a page only once it has a **Start here** row. Web titles and intros live in `scripts/library/topics.json` (`reviewed:false` = draft).
- `scripts/library/config.json` → `INDEX_LIBRARY` stays `false` (every library page `noindex`) until the licensing check is done.
  Move pages stay `noindex` until a move has a reviewed one-line description.
