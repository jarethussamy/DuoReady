import { useWindowDimensions } from 'react-native';

export interface DuoLayout {
  /** Live window width in points. Changes on fold, unfold, rotation and Split View. */
  width: number;
  /** Live window height in points. */
  height: number;
  /** True when the window is wide enough to show two columns. */
  isWide: boolean;
  /** 2 when wide, 1 when compact. */
  columns: 1 | 2;
  /** True when this window could sensibly sit beside another app / window in Split View. */
  isSplitCandidate: boolean;
}

/**
 * useDuoLayout — the layout hook for iPhone Duo.
 *
 * Built on useWindowDimensions, which SUBSCRIBES to the window size.
 * That matters on a foldable: the window is not fixed at launch.
 * It changes when the user
 *   - unfolds the phone (5.4-inch outer -> 7.6-inch inner display),
 *   - folds it back,
 *   - rotates it, or
 *   - drags your app into Split View next to another app.
 *
 * There are deliberately NO device-model checks and NO single-phone-width
 * checks here. A folded Duo, an unfolded Duo in portrait, and a normal
 * iPhone in Split View can all report similar widths at different moments.
 * Respond to the space you actually have, not the device you think you
 * are on — that is Apple's guidance for the Duo, and it is also what
 * makes this work on every other iPhone.
 *
 * @param breakpoint width (pt) at or above which the layout counts as wide.
 *                   700 is a good default: below any unfolded / Split View
 *                   working width, above any single phone column.
 */
export function useDuoLayout(breakpoint = 700): DuoLayout {
  const { width, height } = useWindowDimensions();
  const isWide = width >= breakpoint;
  return {
    width,
    height,
    isWide,
    columns: isWide ? 2 : 1,
    isSplitCandidate: isWide,
  };
}

export default useDuoLayout;
