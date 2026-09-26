import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Alert, FlatList, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Geolocation from '@react-native-community/geolocation';
import { meetingsAPI } from '../../api';
import { enqueue } from '../../store/offlineDB';
import {
  Button, Card, Badge, Colors, T, Divider,
  EmptyState, Avatar, Input, ListRow,
} from '../../components';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';

const OUTCOMES = [
  { label: '✓ Positive', value: 'positive', color: Colors.green },
  { label: '~ Neutral',  value: 'neutral',  color: Colors.brand },
  { label: '✗ Negative', value: 'negative', color: Colors.red },
  { label: 'No Meet',    value: 'no_meet',  color: Colors.gray },
];

export default function MeetingsScreen() {
  const [tab, setTab]           = useState('visits');
  const [visits, setVisits]     = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [doctors, setDoctors]   = useState([]);
  const [addModal, setAddModal] = useState(false);
  const [loading, setLoading]   = useState(false);

  // Form state
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [doctorSearch, setDoctorSearch]     = useState('');
  const [products, setProducts]             = useState('');
  const [notes, setNotes]                   = useState('');
  const [outcome, setOutcome]               = useState('neutral');
  const [followUpDate, setFollowUpDate]     = useState('');
  const [doctorPickerOpen, setDoctorPickerOpen] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [vis, fu, docs] = await Promise.all([
        meetingsAPI.list({ limit: 30 }),
        meetingsAPI.followUps(),
        meetingsAPI.listDoctors({ limit: 100 }),
      ]);
      setVisits(vis.data.data || []);
      setFollowUps(fu.data.data || []);
      setDoctors(docs.data.data || []);
    } catch (_) {}
  };

  const filteredDoctors = doctors.filter(d =>
    d.name.toLowerCase().includes(doctorSearch.toLowerCase()) ||
    d.hospital?.toLowerCase().includes(doctorSearch.toLowerCase())
  );

  const handleAddVisit = async () => {
    if (!selectedDoctor) return Alert.alert('Required', 'Please select a doctor');

    let coords = null;
    try {
      coords = await new Promise((resolve, reject) =>
        Geolocation.getCurrentPosition(
          (p) => resolve(p.coords),
          (e) => reject(e),
          { enableHighAccuracy: true, timeout: 10000 }
        )
      );
    } catch (_) {}

    setLoading(true);
    const payload = {
      doctor_id:           selectedDoctor.id,
      visit_date:          new Date().toISOString().split('T')[0],
      checkin_lat:         coords?.latitude,
      checkin_lng:         coords?.longitude,
      products_discussed:  products,
      meeting_notes:       notes,
      follow_up_date:      followUpDate || undefined,
      outcome,
    };

    try {
      const fd = new FormData();
      Object.entries(payload).forEach(([k, v]) => v !== undefined && fd.append(k, String(v)));
      await meetingsAPI.add(fd);
      Alert.alert('✅ Visit Logged', `Visit with ${selectedDoctor.name} recorded`);
      resetForm();
      setAddModal(false);
      await loadAll();
    } catch (err) {
      if (!err.response) {
        await enqueue('meeting_add', payload);
        Alert.alert('Saved Offline', 'Will sync when internet returns');
        resetForm();
        setAddModal(false);
      } else {
        Alert.alert('Error', err.response?.data?.message || 'Failed to save');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedDoctor(null);
    setProducts('');
    setNotes('');
    setOutcome('neutral');
    setFollowUpDate('');
    setDoctorSearch('');
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Tabs */}
      <View style={styles.tabRow}>
        {[
          { key: 'visits',   label: 'My Visits' },
          { key: 'followups',label: `Follow-ups${followUps.length ? ` (${followUps.length})` : ''}` },
        ].map(({ key, label }) => (
          <TouchableOpacity key={key} onPress={() => setTab(key)}
            style={[styles.tab, tab === key && styles.tabActive]}>
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.addBtn}>
        <Button title="+ Log Visit" onPress={() => setAddModal(true)} size="sm" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingTop: 8 }}>
        {/* Visits */}
        {tab === 'visits' && (
          visits.length === 0
            ? <EmptyState icon="🤝" title="No visits yet" description="Log your first doctor visit" />
            : visits.map((v) => (
              <Card key={v.id} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[T.body, { fontWeight: '600' }]}>{v.doctor_name}</Text>
                    <Text style={T.small}>{v.hospital} · {v.city}</Text>
                    <Text style={[T.small, { marginTop: 4 }]}>{fmtDate(v.visit_date)} · {fmtTime(v.checkin_time)}</Text>
                    {v.duration_minutes ? <Text style={T.small}>Duration: {v.duration_minutes} min</Text> : null}
                  </View>
                  <Badge
                    label={v.outcome?.replace('_', ' ') || 'neutral'}
                    variant={v.outcome === 'positive' ? 'green' : v.outcome === 'negative' ? 'red' : 'blue'}
                  />
                </View>
                {v.follow_up_date && (
                  <View style={styles.followUpChip}>
                    <Text style={[T.small, { color: Colors.amber }]}>📅 Follow-up: {fmtDate(v.follow_up_date)}</Text>
                  </View>
                )}
              </Card>
            ))
        )}

        {/* Follow-ups */}
        {tab === 'followups' && (
          followUps.length === 0
            ? <EmptyState icon="🎉" title="No follow-ups pending" description="You're all caught up!" />
            : followUps.map((f) => (
              <Card key={f.id} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[T.body, { fontWeight: '600' }]}>{f.doctor_name}</Text>
                    <Text style={T.small}>{f.hospital}</Text>
                    <Text style={[T.small, { marginTop: 2 }]}>Due: {fmtDate(f.follow_up_date)}</Text>
                  </View>
                  {f.days_overdue > 0
                    ? <Badge label={`${f.days_overdue}d late`} variant="red" />
                    : <Badge label="Today" variant="amber" />
                  }
                </View>
              </Card>
            ))
        )}
      </ScrollView>

      {/* Add Visit Modal */}
      <Modal visible={addModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={T.h3}>Log Doctor Visit</Text>
            <TouchableOpacity onPress={() => { setAddModal(false); resetForm(); }}>
              <Text style={{ fontSize: 22, color: Colors.textSub }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            {/* Doctor picker */}
            <Text style={[T.label, { marginBottom: 6 }]}>Doctor *</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setDoctorPickerOpen(true)}>
              <Text style={selectedDoctor ? [T.body] : [T.body, { color: Colors.textMuted }]}>
                {selectedDoctor ? `${selectedDoctor.name} — ${selectedDoctor.hospital}` : 'Select doctor...'}
              </Text>
              <Text style={{ color: Colors.textSub }}>▾</Text>
            </TouchableOpacity>

            {/* Outcome */}
            <Text style={[T.label, { marginTop: 16, marginBottom: 8 }]}>Outcome</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {OUTCOMES.map((o) => (
                <TouchableOpacity key={o.value} onPress={() => setOutcome(o.value)}
                  style={[styles.outcomePill, outcome === o.value && { backgroundColor: o.color, borderColor: o.color }]}>
                  <Text style={[styles.outcomePillText, outcome === o.value && { color: '#fff' }]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ marginTop: 16 }}>
              <Input label="Products Discussed"
                placeholder="e.g. Cataract IOL Lens, Dry Eye Drops"
                value={products} onChangeText={setProducts} />
              <Input label="Follow-up Date (YYYY-MM-DD)"
                placeholder="2026-04-15"
                value={followUpDate} onChangeText={setFollowUpDate} />
              <Input label="Meeting Notes"
                placeholder="Discussion summary, doctor's response..."
                value={notes} onChangeText={setNotes}
                multiline numberOfLines={4} />
            </View>

            <Button title="Save Visit" onPress={handleAddVisit} loading={loading} size="lg" style={{ marginTop: 8 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Doctor picker modal */}
      <Modal visible={doctorPickerOpen} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={T.h3}>Select Doctor</Text>
            <TouchableOpacity onPress={() => setDoctorPickerOpen(false)}>
              <Text style={{ fontSize: 22, color: Colors.textSub }}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 16 }}>
            <TextInput
              value={doctorSearch}
              onChangeText={setDoctorSearch}
              placeholder="Search by name or hospital..."
              placeholderTextColor={Colors.textMuted}
              style={styles.searchInput}
            />
          </View>
          <FlatList
            data={filteredDoctors}
            keyExtractor={(d) => String(d.id)}
            renderItem={({ item: d }) => (
              <ListRow
                left={<Avatar name={d.name} size={36} />}
                center={<>
                  <Text style={[T.body, { fontWeight: '600' }]}>{d.name}</Text>
                  <Text style={T.small}>{d.hospital} · {d.city}</Text>
                  {d.specialization && <Text style={T.small}>{d.specialization}</Text>}
                </>}
                onPress={() => { setSelectedDoctor(d); setDoctorPickerOpen(false); }}
              />
            )}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: Colors.border, marginLeft: 68 }} />}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: Colors.bg },
  tabRow:         { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab:            { flex: 1, paddingVertical: 13, alignItems: 'center' },
  tabActive:      { borderBottomWidth: 2, borderBottomColor: Colors.brand },
  tabText:        { fontSize: 13, color: Colors.textSub, fontWeight: '500' },
  tabTextActive:  { color: Colors.brand, fontWeight: '700' },
  addBtn:         { padding: 12, paddingHorizontal: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, alignItems: 'flex-end' },
  followUpChip:   { marginTop: 8, backgroundColor: Colors.amberBg, borderRadius: 8, padding: 8 },
  modalRoot:      { flex: 1, backgroundColor: Colors.bg },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  pickerBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, backgroundColor: Colors.surface, marginBottom: 4 },
  outcomePill:    { borderWidth: 1, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  outcomePillText:{ fontSize: 13, color: Colors.text, fontWeight: '500' },
  searchInput:    { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: Colors.text, backgroundColor: Colors.surface },
});
