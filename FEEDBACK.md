# Send this to Apple: fix Safari's cramped layout on iPhone Duo

Apple is actively asking for ideas on this problem. In the WebKit blog post
["WebKit Features for Safari 27.1"](https://webkit.org/blog/18486/webkit-features-for-safari-27-1/)
(October 23, 2026), Jen Simmons explained that Safari 27.1 on the iPhone Duo
outer display reserves a side column for controls and web content cannot
extend behind it — and that the obvious fix, `viewport-fit=cover`, fails in
practice because many sites do not inset all four edges correctly. Apple is
investigating a more foolproof approach and wrote: *"If you have ideas, we'd
love to hear them."*

DuoReady's answer is the **Safe-Cover** pattern — see
[`docs/safari-safe-cover.md`](docs/safari-safe-cover.md) for the full fix and
[`web/duo-safe.css`](web/duo-safe.css) for drop-in code. This file is the
ready-to-send version of the proposal, so anyone who clones DuoReady can
echo it to Apple in about two minutes.

## Where to send it (pick at least one — all three is strongest)

1. **WebKit bug tracker** — [bugs.webkit.org](https://bugs.webkit.org)
   File an enhancement request (product: WebKit). This is public and tracked
   by the engineers who work on Safari.
2. **Feedback Assistant** — [feedbackassistant.apple.com](https://feedbackassistant.apple.com)
   File the same text as a Safari suggestion. If you filed a WebKit bug
   first, include its number here — and add the Feedback Assistant (FB)
   number back on the WebKit bug.
3. **Jen Simmons** — the post invites replies on
   [Bluesky](https://bsky.app) / [Mastodon](https://front-end.social).
   Use the short post below.

## Copy-paste text (Feedback Assistant / WebKit bug)

**Title:**

```
Safari 27.1 on iPhone Duo: split background painting from content layout under viewport-fit=cover
```

**Body:**

```
On iPhone Duo's outer display, Safari 27.1 reserves a side column
for controls and web content cannot extend behind it, so pages are
cramped. viewport-fit=cover can reclaim the space, but your own
research shows many sites fail to inset all four edges, hiding
content under the controls.

Proposal: when viewport-fit=cover is set, paint backgrounds
full-bleed by default (body/header backgrounds extend behind the
controls), while keeping the layout viewport inset for content
unless an element explicitly opts into bleeding. Developers get
the recovered space with zero risk of obscured content.

Working prototype + scanner evidence: DuoReady, an open-source
iPhone Duo readiness scanner, ships this as the "Safe-Cover"
pattern (duo-safe.css) and automatically detects the
cover-without-insets failure mode:
https://github.com/jarethussamy/DuoReady/blob/main/docs/safari-safe-cover.md
```

## Short post (Bluesky / Mastodon)

```
Built the foolproof version of the iPhone Duo Safari cover problem
into an open-source scanner — backgrounds bleed by default, content
stays inset. Prototype + proposal:
https://github.com/jarethussamy/DuoReady/blob/main/docs/safari-safe-cover.md
Happy to share scan data.
```

## Honest note

This is a proposal to Apple, not a behavior Apple has adopted. Only Apple
can change Safari's defaults. Until then, the developer-side fix that works
on today's Safari 27.1 is Safe-Cover itself — `viewport-fit=cover` plus
content inset on all four edges — which is exactly what DuoReady scans for.
