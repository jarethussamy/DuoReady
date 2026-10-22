import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import DuoSplitView from '../../react/DuoSplitView';
import { useDuoLayout } from '../../react/useDuoLayout';

const ITEMS = ['Inbox', 'Drafts', 'Sent', 'Archive', 'Spam', 'Trash'];

function ListPane({ onSelect }: { onSelect: (id: string) => void }) {
  const renderItem = useCallback(
    ({ item }: { item: string }) => (
      <Text style={styles.row} onPress={() => onSelect(item)}>
        {item}
      </Text>
    ),
    [onSelect],
  );
  const keyExtractor = useCallback((item: string) => item, []);
  return <FlatList data={ITEMS} renderItem={renderItem} keyExtractor={keyExtractor} />;
}

const DetailPane = React.memo(function DetailPane({ id }: { id: string | null }) {
  return (
    <View style={styles.detail}>
      <Text>{id ? `Reading: ${id}` : 'Select a message'}</Text>
    </View>
  );
});

export default function App() {
  // Live window size: re-renders on fold, unfold, rotation and Split View.
  const { width } = useWindowDimensions();
  const layout = useDuoLayout();
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  // Drafts are persisted, so a fold change never loses typed input.
  useEffect(() => {
    AsyncStorage.getItem('draft').then((saved) => {
      if (saved) setDraft(saved);
    });
  }, []);
  useEffect(() => {
    AsyncStorage.setItem('draft', draft);
  }, [draft]);

  const header = useMemo(() => `Window width: ${Math.round(width)}`, [width]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root}>
        <Text>{header}</Text>
        <Text>{layout.isWide ? 'Wide: two columns' : 'Compact: one column'}</Text>
        <TextInput value={draft} onChangeText={setDraft} placeholder="Draft (saved as you type)" />
        <DuoSplitView
          list={<ListPane onSelect={setSelected} />}
          detail={<DetailPane id={selected} />}
          selectedId={selected}
          onBack={() => setSelected(null)}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16 },
  row: { padding: 12 },
  detail: { flex: 1, padding: 16 },
});
