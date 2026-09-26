import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert,
  TouchableOpacity, Image, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Geolocation from '@react-native-community/geolocation';
import { launchCamera } from 'react-native-image-picker';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { attendanceAPI } from '../../api';
import { enqueue } from '../../store/offlineDB';
import { Button, Card, Badge, Colors, T, Divider, EmptyState } from '../../components';

const CAMERA_PERM = Platform.OS === 'ios' ? PERMISSIONS.IOS.CAMERA : PERMISSIONS.ANDROID.CAMERA;
const LOCATION_PERM = Platform.OS === 'ios' ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }) : '—';
const fmtHours = (h) => h ? `${h}h ${Math.round((h % 1) * 60)}m` : '—';

export default function AttendanceScreen() {
  const [todayRecord, setTodayRecord] = useState(null);
  const [history, setHistory]         = useState([]);
  const [loading, setLoading]         = useState(false);
  const [selfieUri, setSelfieUri]     = useState(null);
  const [coords, setCoords]           = useState(null);
  const [gpsLoading, setGpsLoading]   = useState(false);
  const [tab, setTab]                 = useState('today'); // 'today' | 'history'

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [today, hist] = await Promise.all([
        attendanceAPI.getToday(),
        attendanceAPI.getHistory({ limit: 14 }),
      ]);
      setTodayRecord(today.data.data);
      setHistory(hist.data.data || []);
    } catch (_) {}
  };

  const getLocation = () => new Promise((resolve, reject) => {
    setGpsLoading(true);
    Geolocation.getCurrentPosition(
      (pos) => { setGpsLoading(false); resolve(pos.coords); },
      (err) => { setGpsLoading(false); reject(err); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  });

  const takeSelfie = async () => {
    const perm = await request(CAMERA_PERM);
    if (perm !== RESULTS.GRANTED) {
      Alert.alert('Permission', 'Camera permission required for selfie check-in');
      return null;
    }
    return new Promise((resolve) => {
      launchCamera(
        { mediaType: 'photo', quality: 0.7, cameraType: 'front', saveToPhotos: false },
        (res) => {
          if (res.didCancel || res.errorCode) { resolve(null); return; }
          const uri = res.assets?.[0]?.uri;
          setSelfieUri(uri);
          resolve(uri);
        }
      );
    });
  };

  const handleCheckIn = async () => {
    // 1. Get selfie
    const photoUri = await takeSelfie();
    if (!photoUri) return;

    // 2. Get GPS
    let position;
    try {
      await request(LOCATION_PERM);
      position = await getLocation();
      setCoords(position);
    } catch {
      Alert.alert('GPS Error', 'Could not get your location. Please enable GPS and try again.');
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('lat', position.latitude);
      fd.append('lng', position.longitude);
      fd.append('address', 'Current Location');
      fd.append('selfie', { uri: photoUri, type: 'image/jpeg', name: 'selfie.jpg' });

      await attendanceAPI.checkIn(fd);
      Alert.alert('✅ Checked In!', 'Have a great day in the field!');
      await loadData();
    } catch (err) {
      if (!err.response) {
        // Offline — queue it
        await enqueue('attendance_checkin', {
          lat: position.latitude,
          lng: position.longitude,
          address: 'Current Location',
        });
        Alert.alert('Saved Offline', 'Check-in saved. Will sync when internet is available.');
        setTodayRecord({ checkin_time: new Date().toISOString(), is_late: false, status: 'present' });
      } else {
        Alert.alert('Error', err.response?.data?.message || 'Check-in failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    let position;
    try {
      await request(LOCATION_PERM);
      position = await getLocation();
    } catch {
      Alert.alert('GPS Error', 'Could not get your location.');
      return;
    }

    Alert.alert('Confirm Check-out', 'Are you sure you want to check out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Check Out',
        onPress: async () => {
          setLoading(true);
          try {
            await attendanceAPI.checkOut({ lat: position.latitude, lng: position.longitude });
            Alert.alert('✅ Checked Out', 'See you tomorrow!');
            await loadData();
          } catch (err) {
            if (!err.response) {
              await enqueue('attendance_checkout', { lat: position.latitude, lng: position.longitude });
              Alert.alert('Saved Offline', 'Check-out saved. Will sync when internet returns.');
            } else {
              Alert.alert('Error', err.response?.data?.message || 'Check-out failed');
            }
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const rec = todayRecord;
  const checkedIn  = !!rec?.checkin_time;
  const checkedOut = !!rec?.checkout_time;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Tabs */}
      <View style={styles.tabRow}>
        {['today', 'history'].map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'today' ? 'Today' : 'History'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
        {tab === 'today' && (
          <>
            {/* Today's status card */}
            <Card style={styles.todayCard}>
              <Text style={T.label}>{fmtDate(new Date())}</Text>

              <View style={styles.timeRow}>
                <View style={styles.timeBlock}>
                  <Text style={[T.small, { marginBottom: 4 }]}>Check-in</Text>
                  <Text style={[T.h2, { color: checkedIn ? Colors.green : Colors.textMuted }]}>
                    {checkedIn ? fmtTime(rec.checkin_time) : '—'}
                  </Text>
                  {rec?.is_late && <Badge label="Late" variant="amber" />}
                </View>
                <View style={styles.timeSep}>
                  <Text style={{ fontSize: 20, color: Colors.textMuted }}>→</Text>
                </View>
                <View style={styles.timeBlock}>
                  <Text style={[T.small, { marginBottom: 4 }]}>Check-out</Text>
                  <Text style={[T.h2, { color: checkedOut ? Colors.brand : Colors.textMuted }]}>
                    {checkedOut ? fmtTime(rec.checkout_time) : '—'}
                  </Text>
                </View>
              </View>

              {checkedIn && checkedOut && (
                <View style={styles.hoursRow}>
                  <Text style={T.label}>Working Hours</Text>
                  <Text style={[T.h3, { color: Colors.brand }]}>{fmtHours(rec?.working_hours)}</Text>
                </View>
              )}

              {checkedIn && !checkedOut && (
                <View style={styles.hoursRow}>
                  <Text style={T.small}>📍 {rec?.checkin_address || 'Location captured'}</Text>
                </View>
              )}
            </Card>

            {/* Selfie preview */}
            {selfieUri && (
              <Image source={{ uri: selfieUri }}
                style={styles.selfiePreview} />
            )}

            {/* Action buttons */}
            <View style={styles.btnArea}>
              {!checkedIn && (
                <Button
                  title="📸 Take Selfie & Check In"
                  onPress={handleCheckIn}
                  loading={loading || gpsLoading}
                  size="lg"
                />
              )}
              {checkedIn && !checkedOut && (
                <Button
                  title="Check Out"
                  onPress={handleCheckOut}
                  loading={loading || gpsLoading}
                  variant="secondary"
                  size="lg"
                />
              )}
              {checkedIn && checkedOut && (
                <View style={styles.doneWrap}>
                  <Text style={{ fontSize: 32 }}>🎉</Text>
                  <Text style={[T.h3, { marginTop: 8, color: Colors.green }]}>All done for today!</Text>
                  <Text style={[T.small, { marginTop: 4 }]}>Working hours: {fmtHours(rec?.working_hours)}</Text>
                </View>
              )}
            </View>
          </>
        )}

        {tab === 'history' && (
          <>
            {history.length === 0
              ? <EmptyState icon="📅" title="No history" description="Your attendance records will appear here" />
              : history.map((r) => (
                <Card key={r.id || r.date} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View>
                      <Text style={[T.body, { fontWeight: '600' }]}>{fmtDate(r.date)}</Text>
                      <Text style={T.small}>
                        {r.checkin_time ? fmtTime(r.checkin_time) : '—'} → {r.checkout_time ? fmtTime(r.checkout_time) : '—'}
                        {r.working_hours ? `  ·  ${fmtHours(r.working_hours)}` : ''}
                      </Text>
                    </View>
                    <Badge
                      label={r.status || 'absent'}
                      variant={r.status === 'present' ? 'green' : r.status === 'late' ? 'amber' : r.status === 'absent' ? 'red' : 'gray'}
                    />
                  </View>
                </Card>
              ))
            }
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: Colors.bg },
  tabRow:       { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab:          { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive:    { borderBottomWidth: 2, borderBottomColor: Colors.brand },
  tabText:      { fontSize: 14, color: Colors.textSub, fontWeight: '500' },
  tabTextActive:{ color: Colors.brand, fontWeight: '700' },
  todayCard:    { marginBottom: 16 },
  timeRow:      { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 12 },
  timeBlock:    { flex: 1, alignItems: 'center' },
  timeSep:      { paddingHorizontal: 8 },
  hoursRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  selfiePreview:{ width: 80, height: 80, borderRadius: 12, alignSelf: 'center', marginBottom: 16 },
  btnArea:      { gap: 12 },
  doneWrap:     { alignItems: 'center', paddingVertical: 24 },
});
