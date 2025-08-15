import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AuthScreen } from '~/components/auth/AuthScreen';

export default function LoginPage() {
  return (
    <View style={styles.container}>
      <AuthScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});