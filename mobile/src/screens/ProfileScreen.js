import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useAuthStore from '../../store/authStore';
import { pendingCount } from '../../store/offlineDB';
import { syncAll } from '../../utils/syncService';
import { Avatar, Card, Button, Colors, T, Divider, Badge } from '../../components';

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
  : '—';

const Row = ({ icon, label, value, onPress, rightEl }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1}
    style={styles.row}>
    <Text style={styles.rowIcon}>{icon}</Text>
    <View style={{ flex: 1 }}>
      <Text style={T.small}>{label}</Text>
      {value ? <Text style={[T.body, { fontWeight: '500', marginTop: 1 }]}>{value}</Text> : null}
    </View>
    {rightEl || (onPress ? <Text style={styles.chevron}>›</Text> : null)}
  </TouchableOpacity>
);

export default function ProfileScreen({ navigation }) {
  const { employee, logout, refreshProfile } = useAuthStore();
  const [pending, setPending]       = useState(0);
  const [syncing, setSyncing]       = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(true);

  useEffect(() => {
    loadPending();
    refreshProfile();
  }, []);

  const loadPending = async () => {
    const cnt = await pendingCount();
    setPending(cnt);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncAll();
      await loadPending();
      Alert.alert('✅ Sync Complete', 'All offline data has been synced');
    } catch (_) {
      Alert.alert('Sync Failed', 'Check your internet connection and try again');
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const role = employee?.role?.replace(/_/g, ' ');

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>

        {/* Profile header */}
        <Card style={styles.profileCard}>
          <View style={styles.profileTop}>
            <Avatar name={employee?.name || ''} size={64} />
            <View style={styles.profileInfo}>
              <Text style={T.h2}>{employee?.name}</Text>
              <Text style={[T.small, { marginTop: 2 }]}>{employee?.email}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Badge
                  label={role || 'field agent'}
                  variant={employee?.role === 'admin' ? 'red' : employee?.role === 'manager' ? 'blue' : 'teal'}
                />
                {employee?.zone && <Badge label={employee.zone} variant="gray" />}
              </View>
            </View>
          </View>

          <Divider />

          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={T.label}>Phone</Text>
              <Text style={[T.body, { fontWeight: '600', marginTop: 2 }]}>{employee?.phone || '—'}</Text>
            </View>
            <View style={{ width: 1, backgroundColor: Colors.border }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={T.label}>Last Login</Text>
              <Text style={[T.body, { fontWeight: '600', marginTop: 2 }]}>
                {employee?.last_login ? fmtDate(employee.last_login) : 'Now'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Offline sync status */}
        {pending > 0 && (
          <Card style={[styles.syncCard]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={[T.body, { fontWeight: '600', color: Colors.amber }]}>
                  ⏳ {pending} record{pending > 1 ? 's' : ''} pending sync
                </Text>
                <Text style={T.small}>Saved offline — will sync automatically</Text>
              </View>
              <Button
                title="Sync Now"
                onPress={handleSync}
                loading={syncing}
                size="sm"
                variant="secondary"
              />
            </View>
          </Card>
        )}

        {pending === 0 && (
          <Card style={[styles.syncCard, { borderLeftColor: Colors.green }]}>
            <Text style={[T.small, { color: Colors.green }]}>✅ All data synced</Text>
          </Card>
        )}

        {/* Settings */}
        <Text style={[T.label, { marginTop: 20, marginBottom: 8 }]}>Settings</Text>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Row
            icon="🔔"
            label="Push Notifications"
            rightEl={
              <Switch
                value={notifEnabled}
                onValueChange={setNotifEnabled}
                trackColor={{ false: Colors.border, true: Colors.brand }}
                thumbColor="#fff"
              />
            }
          />
          <Divider style={{ margin: 0 }} />
          <Row
            icon="📍"
            label="Location Tracking"
            value="Active · every 3 minutes"
            rightEl={<Badge label="On" variant="green" />}
          />
          <Divider style={{ margin: 0 }} />
          <Row
            icon="📶"
            label="Offline Mode"
            value="SQLite queue active"
            rightEl={<Badge label="Ready" variant="teal" />}
          />
        </Card>

        {/* Account */}
        <Text style={[T.label, { marginTop: 20, marginBottom: 8 }]}>Account</Text>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Row icon="👤" label="Employee ID" value={`#${employee?.id || '—'} · ${employee?.uuid?.slice(0, 8) || '—'}`} />
          <Divider style={{ margin: 0 }} />
          <Row
            icon="🔄"
            label="Sync offline records"
            onPress={handleSync}
          />
          <Divider style={{ margin: 0 }} />
          <Row
            icon="📊"
            label="My Reports"
            onPress={() => navigation.navigate('Reports')}
          />
        </Card>

        {/* App info */}
        <Text style={[T.label, { marginTop: 20, marginBottom: 8 }]}>About</Text>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Row icon="🏥" label="App" value="Healthqube Eyes · v1.0.0" />
          <Divider style={{ margin: 0 }} />
          <Row icon="🖥" label="Backend" value={require('../../config').default.API_URL} />
        </Card>

        {/* Logout */}
        <Button
          title="Logout"
          onPress={handleLogout}
          variant="danger"
          size="lg"
          style={{ marginTop: 24, marginBottom: 16 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.bg },
  profileCard: { marginBottom: 12 },
  profileTop:  { flexDirection: 'row', gap: 16, marginBottom: 16, alignItems: 'flex-start' },
  profileInfo: { flex: 1 },
  syncCard:    { marginBottom: 8, borderLeftWidth: 3, borderLeftColor: Colors.amber },
  row:         { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, backgroundColor: Colors.surface },
  rowIcon:     { fontSize: 20, width: 28, textAlign: 'center' },
  chevron:     { fontSize: 20, color: Colors.textMuted },
});
