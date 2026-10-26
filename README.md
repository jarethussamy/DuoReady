# DuoReady — iPhone Duo Optimizer

A zero-dependency source scanner that audits a **React / React Native**
app for readiness for **iPhone Duo**, Apple's first foldable, on
**iOS 27.1** — plus the React Native helpers to fix what it finds.

> **Name note:** DuoReady is a *working title*. It was web search-clean
> on Oct 21, 2026 for a developer optimizer, but it is **not
> attorney-cleared** — USPTO trademark and Virginia SCC business-name
> checks are required before any public launch under this name.
> (FoldReady is not used: an existing $349/app Duo readiness service
> already operates under that name.)

## Why this exists

- iPhone Duo was announced Sep 9, 2026. Pre-orders opened Oct 16, and
  it is available **Oct 23, 2026**, starting at **$1,999 (256GB)**.
- It has a **5.4-inch outer display** and a **7.6-inch inner display**,
  an **A20 Pro** chip, **12GB RAM**, Touch ID in the side button, IP68,
  and a titanium enclosure.
- iOS 27 shipped Sep 14, 2026. **iOS 27.1 is the Duo version**,
  preinstalled on the device.
- **Xcode 27.1** was released Oct 15, 2026 (build **27A9275**, Swift 6.4,
  the iOS 27.1 SDK, requires macOS Tahoe 26.6+).
- **Only builds compiled with Xcode 27.1 / the iOS 27.1 SDK use the full
  7.6-inch inner display and can earn the "Optimized for iPhone Duo"
  App Store badge.** Older builds still run — letterboxed, with black
  borders.
- App Store Connect has accepted Duo-optimized builds since Oct 5, 2026.
- **From April 2027, Duo screenshots are mandatory** for App Store
  submissions.
- The iPhone Duo Simulator has limits: StandBy and most app extensions
  are unavailable in it.

## Install / usage

No dependencies, nothing to install. You need Node.js 20+.

```sh
# from a checkout of this repo
node src/cli.js scan /path/to/your-app
node src/cli.js scan /path/to/your-app --json
node src/cli.js scan /path/to/your-app --md report.md
node src/cli.js scan /path/to/your-app --fail-below 80   # CI: exit 1 if below / gated

# try the bundled examples
npm run scan:bad     # examples/bad-app  -> 0/100, Not Badge-Ready
npm run scan:good    # examples/good-app -> 100/100
npm run scan:bad-web # examples/bad-web  -> Safari checks fail (cover, no insets)
npm run scan:good-web # examples/good-web -> Safari checks pass (Safe-Cover)

npm test             # the test suite (node:test, no dependencies)
```

The scanner walks `.js/.jsx/.ts/.tsx/.swift` sources plus config files
(`Podfile`, `app.json`, `*.pbxproj`, `Info.plist`, `*.xcconfig`), and —
since v0.2.0 — any `.html`/`.htm`/`.css` web files for the Safari
checks, skipping `node_modules`, `.git`, `Pods`, `.expo`, `dist` and
`build`.

### Sample output (bad-app, abridged)

```
DuoReady scan — bad-app
Files scanned: 5
Duo Readiness Score: 0/100  (0/14 auto-checks pass, 8 manual, 5 not applicable)
Verdict: Not Badge-Ready — letterbox risk

Adaptive Layout
  ✗ FAIL   No one-time Dimensions.get / UIScreen.main.bounds layout reads
           evidence: App.js:6  const { width } = Dimensions.get('window');
           evidence: ios/BadApp/ContentView.swift:6  let screen = UIScreen.main.bounds
```

Every failure prints the `file:line` evidence and a concrete fix.
`--json` gives the same report as machine-readable JSON; `--md` writes
a Markdown report you can attach to a pull request.

## The 27 checks in 8 groups

The score is the **Duo Readiness Score /100**, computed over the
auto-checkable checks only. Checks with no honest source signal are
marked **manual** — they are never auto-passed, and they are excluded
from the score denominator. Checks that do not apply to a project at
all — the Safari group on a project with no web files — are marked
**N/A** and excluded the same way.

| Group | Auto checks | Manual checks |
| --- | --- | --- |
| SDK & Build | Targets iOS 27.1 SDK / Xcode 27.1 · Modern deployment target (>= 15) · Hermes signal · New Architecture / Fabric signal | — |
| Adaptive Layout | Uses `useWindowDimensions` · No one-time `Dimensions.get` / `UIScreen.main.bounds` · No fixed phone-width comparisons · No fixed container/modal sizes >= 300 | — |
| Fold & Posture | Safe-area handling | Hinge-aware layout (`onHingeChange` / `foldState`) in every pose · Posture transitions tested in Device Hub |
| State Continuity | Form state has a persistence signal, not `useState` only | Scroll position preserved · Playback / uploads / payments continue across folds |
| Split View & Multitasking | Two-column layout signal · Not locked to one orientation | Split View tested (two apps / two windows, saved app pairs) |
| Outer Display | — | Outer-display experience previewed separately · Camera outer-display flows (`CameraCaptureAccessory`) |
| Performance | Lists virtualized (FlatList) · Memoization signals | Profiled with Instruments on the resize path |
| Safari on Duo (Web) | Viewport meta declares `viewport-fit=cover` · Safe-area insets on **all four** edges · No user-agent sniffing for layout · Fluid across 382–951 CSS px | Device Posture / Viewport Segments tested with Safari 27.1 feature flags on and off |

That is 18 auto + 9 manual = **27 checks**. The Safari group's 5 checks
apply **only when the project contains HTML/CSS files**; on app-only
projects they report **N/A** and stay out of the score, so
`examples/bad-app` still scores 0/100 and `examples/good-app` 100/100.

Some auto checks can also come back *manual for a specific project* —
for example, the orientation check when no `app.json` / `Info.plist`
setting exists to judge, or the lists check when a project renders no
lists. The report says so instead of guessing.

### The hard gate

If a project shows **no evidence of targeting the iOS 27.1 SDK /
Xcode 27.1**, the verdict is capped at:

```
Not Badge-Ready — letterbox risk
```

…regardless of score. That mirrors reality: without a 27.1 build, the
app cannot use the full inner display or earn the badge.

**A scan never proves badge eligibility.** It reports source signals
only. Only a real build compiled with Xcode 27.1 and submitted through
App Store Connect proves it.

## Safari on iPhone Duo (web) — new in v0.2.0

Your app's web pages have a Duo problem of their own. On the outer
display in portrait — **382 CSS px wide**, shorter and wider than other
iPhones — Safari 27.1 moves the browser and system controls into a
**side column**. Web content does not extend behind those controls;
Safari fills the strip with the page's background color, so content is
left cramped in what remains. Apple documented this in
["WebKit Features for Safari 27.1"](https://webkit.org/blog/18486/webkit-features-for-safari-27-1/)
(Jen Simmons, WebKit blog, Oct 23, 2026); MacRumors covered Apple's
wish to fix it on
[Oct 25, 2026](https://www.macrumors.com/2026/10/25/apple-wants-to-fix-safari-on-iphone-duo/).

Apple's candidate mechanism is `viewport-fit=cover` — it lets the page
paint into the side strip. But Apple's own research found that many
sites then **fail to inset content on all four edges** with
`env(safe-area-inset-*)`, leaving content hidden under the controls.

**The fix — DuoReady's "Safe-Cover" pattern** (full guide:
[`docs/safari-safe-cover.md`](docs/safari-safe-cover.md), drop-in code:
[`web/duo-safe.css`](web/duo-safe.css)):

1. Add `viewport-fit=cover` to the viewport meta.
2. **Backgrounds bleed, content stays inset:** background-only
   elements (`.duo-bleed`) paint the full width including behind the
   side controls; everything readable or tappable gets `.duo-safe`,
   which pads all four edges with
   `max(<design padding>, env(safe-area-inset-*))`.
3. Never place essential content in the inset zones, stay fluid across
   the Duo's 382–951 CSS px Safari range, and feature-detect — never
   UA-sniff.

The scan's 5 Safari checks verify exactly this: `viewport-fit=cover`
present, insets on **all four** edges, no user-agent layout branching,
no fixed widths over 382 px, and a manual check for the Device Posture
/ Viewport Segments preview APIs (Safari 27.1 feature flags). Try them
on `examples/bad-web` (cover set, zero insets — Apple's failure mode)
and `examples/good-web` (Safe-Cover applied).

The guide also carries a **"Feedback for Apple"** note: DuoReady's
suggested foolproof default — split background painting from content
layout, so backgrounds bleed by default under `viewport-fit=cover`
while content stays inset until an element opts into bleeding — and
where to send it (Feedback Assistant, bugs.webkit.org, or Jen Simmons
on Bluesky/Mastodon). It is a suggestion to echo, not a behavior Apple
has adopted. Ready-to-send copy lives in [`FEEDBACK.md`](FEEDBACK.md) —
file it in about two minutes and help move the default.

## Fix code: the `react/` folder

- [`react/useDuoLayout.ts`](react/useDuoLayout.ts) — hook on
  `useWindowDimensions()` returning
  `{ width, height, isWide, columns: 1 | 2, isSplitCandidate }`.
  No device-model checks, no single-phone-width checks.
- [`react/DuoSplitView.tsx`](react/DuoSplitView.tsx) — list/detail:
  two columns when wide, single-column stack when compact, selection
  and scroll state held above the layout switch so a fold loses nothing.
- [`react/README.md`](react/README.md) — including the **bridge truth**:
  React sits on the native build, so the native shell must be compiled
  with Xcode 27.1 or none of this reaches the full 7.6 inches.

## Ship steps (after the scan is clean)

1. Install **Xcode 27.1** (macOS Tahoe 26.6+); rebuild the native shell
   against the **iOS 27.1 SDK**.
2. Run every main screen in the **iPhone Duo Simulator via Device Hub**:
   fold, unfold, rotate, tent — remembering StandBy and most app
   extensions are unavailable in the simulator.
3. Preview the **outer display** separately with Xcode canvas
   alternative-display previews.
4. Clear the manual checks above (state continuity and Split View
   especially).
5. Ship a **TestFlight** build to testers.
6. Submit through **App Store Connect** as a Duo-optimized build to
   earn the "Optimized for iPhone Duo" badge.
7. Prepare **Duo screenshots** — mandatory for all submissions from
   **April 2027**.

## CI

`action.yml` is a composite GitHub Action, and
`.github/workflows/duoready-scan.yml` shows both this repo's own
test/scan jobs and a commented snippet for running the scan in your
own app's repo.

## Honest limits

- DuoReady reads source code and reports **signals**, not proof.
- It does **not** compile your app, run Xcode, run the simulator, or
  submit anything to Apple. You still need your own Mac with
  Xcode 27.1 and an Apple Developer account.
- A passing check means "the signal was found", not "this screen is
  beautiful on a foldable". The 8 manual checks exist precisely because
  posture, state continuity and the outer display can only be verified
  by testing.
- Heuristics can misfire on unusual codebases. The evidence lines are
  printed so you can judge each finding yourself.
- The Safari checks audit **source code only**, like everything here;
  final proof is rendering on the Duo simulator (Xcode 27.1 Device Hub)
  or a real device.

## Layout of this repo

```
src/cli.js        the duoready CLI (scan, --json, --md, --fail-below)
src/scanner.js    file walking, detectors, scoring, Markdown report
src/checks.js     the 27 checks / 8 groups, with a fix for each
react/            useDuoLayout + DuoSplitView + notes for your app
web/duo-safe.css  the Safe-Cover pattern for Safari on Duo (drop-in CSS)
docs/             safari-safe-cover.md — the full Safari fix guide
examples/bad-app  a project full of Duo anti-patterns (scores 0/100)
examples/good-app an adapted project (scores 100/100)
examples/bad-web  viewport-fit=cover with no insets (Safari checks fail)
examples/good-web the Safe-Cover pattern applied (Safari checks pass)
test/             node:test suite — run `npm test`
action.yml        composite GitHub Action
```

## License

MIT — see [LICENSE](LICENSE).
