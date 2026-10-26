# Safari on iPhone Duo: the cramped-layout problem, and the Safe-Cover fix

## The problem

Safari 27.1 on the iPhone Duo's **outer display** behaves unlike Safari
on any other iPhone. That display is **382 CSS px wide in portrait** —
shorter and wider than other iPhones — and Safari moves its own
controls, plus the system controls, into a **side column**. Web content
does **not** extend behind those controls; Safari fills the leftover
strip with the page's background color. The result: your content is
squeezed into a noticeably narrower column than 382 px.

Apple documented this themselves in **"WebKit Features for Safari
27.1"** (Jen Simmons, WebKit blog, Oct 23, 2026 —
<https://webkit.org/blog/18486/webkit-features-for-safari-27-1/>), and
MacRumors covered Apple's wish to improve it on Oct 25, 2026
(<https://www.macrumors.com/2026/10/25/apple-wants-to-fix-safari-on-iphone-duo/>).

Apple's candidate mechanism already exists: the viewport meta value
**`viewport-fit=cover`** lets the page extend into the space beside the
controls. The catch, from Apple's own research: many sites that adopt
`viewport-fit=cover` then **fail to inset their content correctly on
all four edges** with `env(safe-area-inset-*)`, leaving text and
controls hidden under the Duo's side column. Apple is investigating a
more foolproof default and has explicitly invited developer feedback
(see "Feedback for Apple" below).

Until Apple changes the default, the developer-side fix for today's
shipping Safari 27.1 is the **Safe-Cover pattern** below. DuoReady
scans for it (the "Safari on Duo (Web)" check group) and ships it as
drop-in code in [`web/duo-safe.css`](../web/duo-safe.css).

## The fix: 3 steps

### 1. Opt into the full area

Your viewport meta must include `viewport-fit=cover`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

Without it, Safari keeps the page out of the side strip entirely and
the layout stays cramped. With it — and only with it — your page can
paint behind the controls.

### 2. Apply the Safe-Cover pattern: backgrounds bleed, content stays inset

Include `web/duo-safe.css` and split every surface into two roles:

- **Backgrounds bleed.** Elements that are pure background (a header
  bar, a hero band, a footer) get the `.duo-bleed` class: no inset
  padding, so their background paints the full width, including behind
  the side controls. The page looks designed, not letterboxed.
- **Critical content is inset on all four edges.** Anything with text,
  links, buttons or form fields gets `.duo-safe`, which pads with
  `max(<your design padding>, env(safe-area-inset-*))` for **top,
  right, bottom and left** — all four, every time:

  ```css
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  ```

  `max()` keeps your normal spacing on devices with no inset and adds
  clearance exactly where the Duo puts controls.

### 3. Never place essential content in the inset zones

The inset zones are for background paint only. No nav links, no
buttons, no body text, no form fields in the strip beside the controls
or under the top/bottom bars — that is precisely the content Apple's
research found hidden. If an element must visually span the strip,
keep its interactive/readable parts inside a `.duo-safe` wrapper.

Two related rules from the same WebKit post:

- **Stay fluid across 382–951 CSS px.** Safari viewports on Duo range
  from 382 px (outer portrait) through 594 (outer landscape), 669
  (inner portrait), 385 each for two side-by-side inner windows, up to
  951 (inner landscape). Fixed-width containers wider than 382 px will
  break somewhere in that range; use fluid widths and `max-width`.
- **Feature-detect, never UA-sniff.** Apple explicitly advises against
  branching on `navigator.userAgent`. The Duo's sizes overlap other
  devices, and the fold state is not in the UA string anyway.

## Testing

1. In **Xcode 27.1**, open the **iPhone Duo Simulator via Device Hub**.
2. Load your site in Safari on the **outer display**: portrait
   **382 × 618**, and landscape **594** wide.
3. Check **all four edges**: scroll to the very top and bottom, open
   your fixed header/footer, drawers and dialogs, and confirm nothing
   readable or tappable sits under the side controls or bars.
4. Fold/unfold and rotate mid-page: the layout should reflow fluidly
   through the 382–951 px range without horizontal scrolling.
5. Optional enhancement pass: the **Device Posture API**
   (`device-posture` media query, `navigator.devicePosture`) and the
   **Viewport Segments API** (`horizontal-viewport-segments` /
   `vertical-viewport-segments`, `env(viewport-segment-*)`) are a
   **developer preview** in Safari 27.1, behind feature flags at
   **Settings > Apps > Safari > Advanced > Feature Flags**. Test with
   the flags ON if you use them — and OFF to prove the Safe-Cover
   fallback stands on its own. (Safari 27.1 also shows PDFs two-up in
   book pose automatically; nothing for you to do there.)

## Honest limits

Only Apple can change Safari's default behavior. This pattern is the
correct developer-side fix for Safari 27.1 **as it ships today** — it
uses the mechanism Apple documents (`viewport-fit=cover` +
`env(safe-area-inset-*)`), applied completely, on all four edges.
DuoReady's Safari checks audit **source code only**: they confirm the
signals are present, not that your page renders beautifully. Final
proof is rendering on the Duo simulator or a real device.

## Feedback for Apple

Apple asked developers what a foolproof default should look like.
DuoReady's suggestion — one you are welcome to echo — is:

> **Split background painting from content layout.** Under
> `viewport-fit=cover`, let element backgrounds paint into the full
> area (including behind the side controls) **by default**, while the
> layout viewport for content stays inset to the unobstructed area
> until an element explicitly opts into bleeding. Developers would get
> Apple's own example for free — a header whose background spans the
> full width while its nav links remain in the unobstructed area — with
> no per-edge inset bookkeeping to get wrong.

This is a suggestion, not an adopted behavior — as of Oct 25, 2026
Apple is still investigating. Per the WebKit post, you can send
feedback via:

- **Feedback Assistant** — <https://feedbackassistant.apple.com>
  (for Safari UI issues)
- **WebKit bug reports** — <https://bugs.webkit.org>
- **Jen Simmons** (Apple) on Bluesky or Mastodon
