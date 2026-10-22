import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDuoLayout } from './useDuoLayout';

export interface DuoSplitViewProps {
  /** The list / primary pane. Render it with FlatList so rows stay virtualized. */
  list: React.ReactNode;
  /** The detail / secondary pane for the current selection. */
  detail: React.ReactNode;
  /** Currently selected item id, or null. Controlled by the parent if provided. */
  selectedId?: string | null;
  /** Called when the user goes back to the list in compact mode. */
  onBack?: () => void;
  /** Width (pt) at or above which two columns are shown. Default 700. */
  breakpoint?: number;
}

/**
 * DuoSplitView — list/detail that adapts to the fold.
 *
 * Wide (unfolded 7.6-inch display, or a wide Split View window):
 *   list and detail sit side by side, in flex proportions — never
 *   fixed point widths, so any Split View width still works.
 *
 * Compact (folded 5.4-inch outer display, or a narrow Split View window):
 *   a single column — the list, or the detail with a Back control.
 *
 * State continuity: the selection lives in ONE place, above the layout
 * switch, and both panes stay mounted in wide mode. Folding or unfolding
 * therefore never throws away the selection, the list's scroll position
 * (keep it in the list component), or a draft the user is typing — the
 * exact state losses that earn one-star reviews on a foldable.
 */
export function DuoSplitView({ list, detail, selectedId, onBack, breakpoint }: DuoSplitViewProps) {
  // Internal selection is only a fallback; parents should control it so
  // the selection also survives navigation, not just layout changes.
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const selected = selectedId !== undefined ? selectedId : internalSelected;
  const { isWide } = useDuoLayout(breakpoint);

  if (isWide) {
    return (
      <View style={styles.row}>
        <View style={styles.listPane}>{list}</View>
        <View style={styles.detailPane}>{detail}</View>
      </View>
    );
  }

  if (selected) {
    return (
      <View style={styles.stack}>
        <Pressable
          onPress={() => {
            setInternalSelected(null);
            if (onBack) onBack();
          }}
        >
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        {detail}
      </View>
    );
  }

  return <View style={styles.stack}>{list}</View>;
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  listPane: { flex: 1 },
  detailPane: { flex: 2 },
  stack: { flex: 1 },
  back: { padding: 12, fontSize: 16 },
});

export default DuoSplitView;
