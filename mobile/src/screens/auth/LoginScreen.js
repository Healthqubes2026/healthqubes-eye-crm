import React, { useState } from 'react';
import {
  View, Text, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Button, Input, Colors, T } from '../../components';
import useAuthStore from '../../store/authStore';

export default function LoginScreen() {
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading } = useAuthStore();

  const handleEmailLogin = async () => {
    if (!email || !password) return Alert.alert('Required', 'Enter email and password');
    const res = await login(email.trim().toLowerCase(), password);
    if (!res.success) Alert.alert('Login Failed', res.message);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoWrap}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoEmoji}>👁</Text>
          </View>
          <Text style={[T.h1, { textAlign: 'center', marginTop: 16 }]}>Healthqube Eyes</Text>
          <Text style={[T.small, { textAlign: 'center', marginTop: 4 }]}>FieldForce Mobile</Text>
        </View>

        <View style={styles.formCard}>
          <Input
            label="Email"
            placeholder="you@healthqube.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />
          <Input
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Button
            title="Sign In"
            onPress={handleEmailLogin}
            loading={isLoading}
            size="lg"
            style={{ marginTop: 8 }}
          />
        </View>

        <Text style={[T.small, { textAlign: 'center', color: Colors.textMuted, marginTop: 24 }]}>
          Smart Eye Care FieldForce System
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: Colors.bg },
  scroll:   { flexGrow: 1, padding: 24, paddingTop: 60 },
  logoWrap: { alignItems: 'center', marginBottom: 36 },
  logoIcon: { width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.brand, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.brand, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  logoEmoji:{ fontSize: 32 },
  formCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 20, marginTop: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 },
});
