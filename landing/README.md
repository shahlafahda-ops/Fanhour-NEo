# Fanhour — Landing Page

A single-file, single-page scrolling site that tells the Fanhour story: regional Saudi Pro League
clubs, their supporters, and the local SMEs around them.

## Running it

`landing/index.html` is fully self-contained — HTML, CSS and JS in one file, zero build step and zero
dependencies. Open it directly in a browser:

```bash
open landing/index.html          # macOS
xdg-open landing/index.html      # Linux
```

Or serve the folder if you prefer a real origin:

```bash
npx http-server landing -p 4173
```

It is independent of the React app in `src/` and does not affect `npm run dev` / `npm run build`.

## Narrative structure

| # | Section | Scroll mechanic |
|---|---------|-----------------|
| — | Hero — the scale of modern football | Parallax stadium bowl, floodlight beams, word-by-word headline |
| 01 | The Regional Disconnect | Pinned split-screen: 5,000 seats vs SAR 3.2B local economy, scroll-driven counters and skyline |
| 02 | The Barrier to Entry | Pinned scene: a SAR 500,000 invoice descends like a wall over a local shop, "OUT OF REACH" stamp lands |
| 03 | Breaking the Walls | Pinned 4-phase scene: camera push-in → cracks draw → stadium shatters into shards → phone rises and its UI staggers in |
| 04 | How the platform works | Fans / SMEs / Clubs cards, sponsorship tier band, animated 60% revenue-share donut |
| 05 | Pilot & Vision | Al-Hazem FC (Ar-Rass, Qassim) then Damac FC (Khamis Mushait, Asir), compliance grid, CTA |

## How the animation works

- **Reveals** — one `IntersectionObserver` drives `[data-reveal]`, `[data-stagger]`, counters, bars and
  the donut. Each fires once, then unobserves.
- **Pinned scenes** — a tall `.scene` wraps a `position: sticky` stage. A single `requestAnimationFrame`
  loop (one scroll listener for the whole page) writes a `--p` progress value (0→1) onto each scene, and
  CSS consumes it inside `calc()`. The break scene additionally gets `--p1` (push-in), `--pc` (cracks),
  `--p2` (shatter) and `--p3` (phone) as overlapping sub-ranges, so the phases cross-fade instead of
  stepping.
- **Parallax** — written as a `--py` custom property so each element keeps its own base transform.
- **Shards** — generated in JS from a seeded PRNG, so the burst is identical on every load.
- **Reduced motion** — `prefers-reduced-motion: reduce` disables reveals, parallax, ambient loops and
  counter tweening; scroll-driven scenes still track the scrollbar directly.

## Customising

- **Colours / type** — all tokens live in `:root` at the top of the `<style>` block
  (`--emerald-lit`, `--gold`, `--ink`, `--font`, …).
- **Scene length** — `.scene--disconnect`, `.scene--barrier`, `.scene--break` heights control how much
  scrolling each pinned scene takes.
- **Photos** — the two `<img>` tags point at Unsplash. Each has an `onerror` handler that removes it, and
  every frame has a CSS-drawn fallback behind it, so a blocked or dead URL degrades to the drawn artwork
  rather than a broken image. Swap the URLs for club/region photography when it is available.
- **Contact** — the CTA links to `hello@fanhour.sa`; change it in the `#cta` section and the footer.

## Notes

Figures such as the SAR 3.2B regional economy, the SAR 500,000 perimeter-board package and the SAR 5,000
entry tier are the narrative figures supplied for the page; verify them against current source material
before using the page publicly.
