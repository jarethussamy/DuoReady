# DuoReady React / React Native helpers

Two small pieces of code in this folder:

- **`useDuoLayout.ts`** — a hook on `useWindowDimensions()` that returns
  `{ width, height, isWide, columns: 1 | 2, isSplitCandidate }`.
- **`DuoSplitView.tsx`** — a list/detail component: two columns when the
  window is wide, a single-column stack when it is compact, with the
  selection held above the layout switch so a fold never loses your place.

Copy them into your app (or import them from a checkout of this repo).
They have no dependencies beyond `react` and `react-native`, which your
app already has.

```tsx
import { useDuoLayout } from './useDuoLayout';
import DuoSplitView from './DuoSplitView';

function InboxScreen() {
  const { isWide, columns } = useDuoLayout();
  return (
    <DuoSplitView
      list={<MessageList />}
      detail={<MessageDetail />}
    />
  );
}
```

## The bridge truth — read this first

React sits **on top of** a native iOS build. These helpers make your
JavaScript layout adaptive, but they cannot, on their own, give your app
the full 7.6-inch inner display of iPhone Duo, and they cannot earn the
"Optimized for iPhone Duo" App Store badge.

That only happens when the **native shell** of your app is compiled with
**Xcode 27.1 (build 27A9275) against the iOS 27.1 SDK** — on a Mac running
macOS Tahoe 26.6 or later. Builds compiled with an older SDK still run on
the Duo, but they letterbox with black borders on the inner display.

So the order of work is:

1. Rebuild the native project with Xcode 27.1 / the iOS 27.1 SDK.
2. Make the React layout adaptive with the helpers here
   (live window dimensions, two columns when wide, state preserved).
3. Test every main screen in the iPhone Duo Simulator through
   Device Hub: fold, unfold, rotate, Split View.
4. Ship a TestFlight build, then submit through App Store Connect
   with Duo screenshots (mandatory for all submissions from April 2027).

## Rules these helpers follow

- **No device-model checks.** Never `if (model === 'iPhone Duo')`.
- **No single-phone-width checks.** Never `width == 393`.
- **No size captured once at launch.** Layout reads the live window.
- **No fixed point widths for panes.** Flex proportions only, so any
  Split View width keeps working.
- **State lives above the layout switch**, so folding mid-task loses
  nothing: not the selection, not scroll position, not a typed draft.

The SwiftUI equivalents, if you are writing native screens too, are
`NavigationSplitView` for list/detail, `ViewThatFits` for components,
and the `horizontalSizeClass` environment value for wide vs. compact.
