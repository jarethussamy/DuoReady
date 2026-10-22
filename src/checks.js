'use strict';

// The 22 DuoReady checks, in the same 7 groups as the DuoReady app.
// kind: 'auto'   -> a source signal can decide pass/fail honestly
//       'manual' -> no reliable source signal exists; a human (or the
//                   iPhone Duo Simulator / Device Hub) must verify it.
//                   Manual checks are NEVER auto-passed and are excluded
//                   from the auto score denominator.
const GROUPS = [
  'SDK & Build',
  'Adaptive Layout',
  'Fold & Posture',
  'State Continuity',
  'Split View & Multitasking',
  'Outer Display',
  'Performance',
];

const CHECKS = [
  { id: 'sdk-ios-27-1', group: 'SDK & Build', kind: 'auto', name: 'Targets iOS 27.1 SDK / Xcode 27.1', fix: 'Rebuild the native shell with Xcode 27.1 (build 27A9275, iOS 27.1 SDK). Only those builds use the full 7.6-inch inner display and can earn the Optimized for iPhone Duo badge.' },
  { id: 'deployment-target', group: 'SDK & Build', kind: 'auto', name: 'Modern iOS deployment target (>= 15) in Podfile / project', fix: 'Raise IPHONEOS_DEPLOYMENT_TARGET / Podfile platform :ios to a modern target so Duo-era APIs are available.' },
  { id: 'hermes-enabled', group: 'SDK & Build', kind: 'auto', name: 'Hermes engine signal present (React Native)', fix: 'Enable Hermes in the Podfile / build config for faster startup on the A20 Pro.' },
  { id: 'new-architecture', group: 'SDK & Build', kind: 'auto', name: 'React Native New Architecture / Fabric signal present', fix: 'Enable the New Architecture (newArchEnabled / fabric_enabled / RCT_NEW_ARCH_ENABLED) so layout changes propagate without bridge stalls during fold/unfold.' },

  { id: 'use-window-dimensions', group: 'Adaptive Layout', kind: 'auto', name: 'Uses useWindowDimensions (live window size)', fix: 'Drive layout from useWindowDimensions() so it re-renders when the window changes on fold, unfold, rotation or Split View.' },
  { id: 'no-one-time-dimensions', group: 'Adaptive Layout', kind: 'auto', name: 'No one-time Dimensions.get / UIScreen.main.bounds layout reads', fix: 'Replace Dimensions.get(...) captured once and UIScreen.main.bounds layout decisions with live window dimensions / trait and size-class logic.' },
  { id: 'no-fixed-screen-width', group: 'Adaptive Layout', kind: 'auto', name: 'No fixed phone-width comparisons (e.g. width == 393, SCREEN_WIDTH)', fix: 'Respond to the space you actually have, not a device width. Use a wide-space breakpoint (e.g. >= 700pt) instead of a single phone width.' },
  { id: 'no-fixed-container-size', group: 'Adaptive Layout', kind: 'auto', name: 'No hardcoded fixed widths/heights (>= 300) on containers or modals', fix: 'Use flex, percentages and max-width instead of fixed point sizes that assume one phone screen.' },

  { id: 'safe-area-handling', group: 'Fold & Posture', kind: 'auto', name: 'Safe-area handling present (SafeAreaView / insets / safeAreaInset)', fix: 'Wrap screens in SafeAreaView / useSafeAreaInsets (or SwiftUI safe-area insets) so controls stay clear of the hinge, crease and display edges in every posture.' },
  { id: 'hinge-aware-layout', group: 'Fold & Posture', kind: 'manual', name: 'Hinge-aware layout (onHingeChange / foldState) behaves in every pose', fix: 'Verify in Device Hub: open, closed, partially folded / tent, portrait and landscape. Source code cannot prove posture behaviour.' },
  { id: 'posture-transition-testing', group: 'Fold & Posture', kind: 'manual', name: 'Posture transitions tested (fold / unfold / rotate mid-task)', fix: 'Fold and unfold on every main screen in the iPhone Duo Simulator via Device Hub and note anything cropped, stretched or awkwardly empty.' },

  { id: 'persisted-form-state', group: 'State Continuity', kind: 'auto', name: 'Form / draft state has a persistence signal, not useState only', fix: 'Persist drafts (AsyncStorage / MMKV / redux-persist / SceneStorage) or keep state above the layout switch so a fold change never loses typed input.' },
  { id: 'scroll-position-preserved', group: 'State Continuity', kind: 'manual', name: 'Scroll position preserved across fold / resize', fix: 'Test long lists in the simulator: fold mid-scroll and confirm the position survives.' },
  { id: 'playback-upload-continuity', group: 'State Continuity', kind: 'manual', name: 'Playback, uploads and payments continue across fold changes', fix: 'Start playback, an upload and a payment flow, then fold/unfold and confirm nothing restarts or is lost.' },

  { id: 'two-column-layout', group: 'Split View & Multitasking', kind: 'auto', name: 'Two-column / split layout signal when wide (DuoSplitView / NavigationSplitView / columns: 2)', fix: 'Show list and detail side by side when wide (unfolded) and a single column when compact. In React Native use useWindowDimensions; in SwiftUI use NavigationSplitView.' },
  { id: 'no-orientation-lock', group: 'Split View & Multitasking', kind: 'auto', name: 'App is not locked to a single orientation', fix: 'Remove a portrait-only orientation lock from app.json / Info.plist so the unfolded and Split View layouts can be used.' },
  { id: 'split-view-testing', group: 'Split View & Multitasking', kind: 'manual', name: 'Split View tested (two apps / two windows, saved app pairs)', fix: 'Test your app beside another app and as two windows of itself on the 7.6-inch display, at several Split View widths.' },

  { id: 'outer-display-preview', group: 'Outer Display', kind: 'manual', name: 'Outer-display (5.4-inch) experience previewed separately', fix: 'Use Xcode canvas alternative-display previews to check what the app shows on the 5.4-inch outer display when closed.' },
  { id: 'camera-outer-display', group: 'Outer Display', kind: 'manual', name: 'Camera flows use the outer display where relevant (CameraCaptureAccessory)', fix: 'If the app uses the camera, check rear-camera selfies / outer-screen previews on device or in Device Hub.' },

  { id: 'virtualized-lists', group: 'Performance', kind: 'auto', name: 'Lists are virtualized (FlatList), not ScrollView + map', fix: 'Render long lists with FlatList (keyExtractor, windowSize) instead of mapping every row into a ScrollView.' },
  { id: 'memoization', group: 'Performance', kind: 'auto', name: 'Memoization signal present (React.memo / useMemo / useCallback)', fix: 'Memoize expensive rows and callbacks so a fold-triggered re-layout does not re-render the whole screen on the A20 Pro.' },
  { id: 'instruments-profiling', group: 'Performance', kind: 'manual', name: 'Profiled with Instruments on the resize path', fix: 'Profile launch and fold/unfold transitions with Instruments and confirm the resize path stays smooth.' },
];

module.exports = { GROUPS, CHECKS };
