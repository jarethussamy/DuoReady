import React, { useState } from 'react';
import { Dimensions, Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

// BAD: window size is read once, at module load, and never updates
// when the phone folds, unfolds, rotates, or enters Split View.
const { width } = Dimensions.get('window');
const SCREEN_WIDTH = 393;

const items = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'];

export default function App() {
  // BAD: the whole layout decision is a single phone width.
  const isPhone = width == 393;
  const [name, setName] = useState('');
  const [showModal, setShowModal] = useState(false);

  return (
    <View style={styles.root}>
      <Text>{isPhone ? 'Phone layout' : 'Other layout'}</Text>
      <Text>{`Screen constant: ${SCREEN_WIDTH}`}</Text>
      <TextInput value={name} onChangeText={setName} placeholder="Your name" />
      <ScrollView>
        {items.map((item) => (
          <Text key={item}>{item}</Text>
        ))}
      </ScrollView>
      <Modal visible={showModal} onRequestClose={() => setShowModal(false)}>
        <View style={styles.modal}>
          <Text>Fixed-size modal</Text>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16 },
  modal: { width: 375, height: 600, backgroundColor: 'white' },
});
