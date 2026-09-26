import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { leadsAPI } from '../../api';
import { enqueue } from '../../store/offlineDB';
import { Button, Card, Badge, Colors, T, EmptyState, Input, Avatar } from '../../components';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';

const STATUSES = [
  { label: 'New',        value: 'new',       variant: 'blue' },
  { label: 'Contacted',  value: 'contacted', variant: 'teal' },
  { label: 'Follow Up',  value: 'follow_up', variant: 'amber' },
  { label: 'Converted',  value: 'converted', variant: 'green' },
  { label: 'Closed',     value: 'closed',    variant: 'gray' },
];

const PRIORITIES = ['high', 'medium', 'low'];
const SOURCES    = ['field', 'referral', 'online', 'camp', 'other', 'google_leads', 'facebook', 'instagram', 'linkedin', 'twitter', 'whatsapp'];

export default function LeadsScreen() {
  const [leads, setLeads]           = useState([]);
  const [pipeline, setPipeline]     = useState({});
  const [addModal, setAddModal]     = useState(false);
  const [statusModal, setStatusModal] = useState(null);
  const [loading, setLoading]       = useState(false);
  const [filterStatus, setFilterStatus] = useState('');

  // Form
  const [name, setName]           = useState('');
  const [phone, setPhone]         = useState('');
  const [email, setEmail]         = useState('');
  const [city, setCity]           = useState('');
  const [condition, setCondition] = useState('');
  const [treatment, setTreatment] = useState('');
  const [hospital, setHospital]   = useState('');
  const [followUp, setFollowUp]   = useState('');
  const [priority, setPriority]   = useState('medium');
  const [source, setSource]       = useState('field');
  const [notesText, setNotesText] = useState('');

  const [newStatus, setNewStatus]   = useState('');
  const [statusNotes, setStatusNotes] = useState('');

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [l, p] = await Promise.all([
        leadsAPI.list({ limit: 50, status: filterStatus || undefined }),
        leadsAPI.pipeline(),
      ]);
      setLeads(l.data.data || []);
      setPipeline(p.data.data || {});
    } catch (_) {}
  };

  useEffect(() => { loadAll(); }, [filterStatus]);

  const handleAdd = async () => {
    if (!name.trim()) return Alert.alert('Required', 'Patient name is required');
    setLoading(true);
    const payload = {
      patient_name: name, phone, email, city,
      eye_condition: condition, treatment, hospital,
      follow_up_date: followUp || undefined,
      priority, source, notes: notesText,
    };
    try {
      const fd = new FormData();
      Object.entries(payload).forEach(([k, v]) => v && fd.append(k, v));
      await leadsAPI.add(fd);
      Alert.alert('✅ Lead Added', `${name} has been added`);
      resetForm();
      setAddModal(false);
      await loadAll();
    } catch (err) {
      if (!err.response) {
        await enqueue('lead_add', payload);
        Alert.alert('Saved Offline', 'Will sync when internet returns');
        resetForm();
        setAddModal(false);
      } else {
        Alert.alert('Error', err.response?.data?.message || 'Failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!newStatus) return Alert.alert('Required', 'Select a status');
    setLoading(true);
    try {
      await leadsAPI.updateStatus(statusModal.id, { status: newStatus, notes: statusNotes });
      Alert.alert('Updated', 'Lead status updated');
      setStatusModal(null);
      await loadAll();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName(''); setPhone(''); setEmail(''); setCity('');
    setCondition(''); setTreatment(''); setHospital('');
    setFollowUp(''); setPriority('medium'); setSource('field'); setNotesText('');
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Pipeline summary */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.pipelineBar} contentContainerStyle={{ padding: 12, gap: 8 }}>
        {STATUSES.map(({ label, value, variant }) => (
          <TouchableOpacity key={value}
            onPress={() => setFilterStatus(filterStatus === value ? '' : value)}
            style={[styles.pipeChip, filterStatus === value && styles.pipeChipActive]}>
            <Text style={styles.pipeCount}>{pipeline[value] || 0}</Text>
            <Text style={styles.pipeLabel}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.addBtn}>
        <Button title="+ Add Lead" onPress={() => setAddModal(true)} size="sm" />
      </View>

      <FlatList
        data={leads}
        keyExtractor={(l) => String(l.id)}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        ListEmptyComponent={<EmptyState icon="👥" title="No leads" description="Add your first patient lead" />}
        renderItem={({ item: l }) => (
          <Card style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={[T.body, { fontWeight: '600' }]}>{l.patient_name}</Text>
                <Text style={T.small}>{l.phone || l.email || '—'}</Text>
                {l.eye_condition && <Text style={[T.small, { marginTop: 2 }]}>{l.eye_condition} · {l.city}</Text>}
                {l.follow_up_date && (
                  <Text style={[T.small, { marginTop: 2, color: new Date(l.follow_up_date) < new Date() ? Colors.red : Colors.amber }]}>
                    📅 Follow-up: {fmtDate(l.follow_up_date)}
                  </Text>
                )}
              </View>
              <Badge
                label={l.status.replace('_', ' ')}
                variant={STATUSES.find(s => s.value === l.status)?.variant || 'gray'}
              />
            </View>
            <TouchableOpacity style={styles.updateBtn}
              onPress={() => { setStatusModal(l); setNewStatus(l.status); setStatusNotes(''); }}>
              <Text style={{ color: Colors.brand, fontSize: 12, fontWeight: '600' }}>Update Status →</Text>
            </TouchableOpacity>
          </Card>
        )}
      />

      {/* Add Lead Modal */}
      <Modal visible={addModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={T.h3}>Add Patient Lead</Text>
            <TouchableOpacity onPress={() => { setAddModal(false); resetForm(); }}>
              <Text style={{ fontSize: 22, color: Colors.textSub }}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Input label="Patient Name *" placeholder="Full name" value={name} onChangeText={setName} />
            <Input label="Phone" placeholder="9XXXXXXXXX" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <Input label="Email" placeholder="patient@email.com" value={email} onChangeText={setEmail} keyboardType="email-address" />
            <Input label="City" placeholder="Bengaluru" value={city} onChangeText={setCity} />
            <Input label="Eye Condition" placeholder="Cataract, Glaucoma, LASIK..." value={condition} onChangeText={setCondition} />
            <Input label="Treatment" placeholder="IOL Surgery, Anti-VEGF..." value={treatment} onChangeText={setTreatment} />
            <Input label="Hospital" placeholder="Hospital name" value={hospital} onChangeText={setHospital} />
            <Input label="Follow-up Date (YYYY-MM-DD)" placeholder="2026-04-20" value={followUp} onChangeText={setFollowUp} />

            {/* Priority */}
            <Text style={[T.label, { marginBottom: 8 }]}>Priority</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {PRIORITIES.map((p) => (
                <TouchableOpacity key={p} onPress={() => setPriority(p)}
                  style={[styles.pill, priority === p && styles.pillActive]}>
                  <Text style={[styles.pillText, priority === p && styles.pillTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Source */}
            <Text style={[T.label, { marginBottom: 8 }]}>Source</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {SOURCES.map((s) => (
                <TouchableOpacity key={s} onPress={() => setSource(s)}
                  style={[styles.pill, source === s && styles.pillActive]}>
                  <Text style={[styles.pillText, source === s && styles.pillTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input label="Notes" placeholder="Additional notes..." value={notesText} onChangeText={setNotesText} multiline numberOfLines={3} />
            <Button title="Add Lead" onPress={handleAdd} loading={loading} size="lg" style={{ marginTop: 8 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Status update modal */}
      {statusModal && (
        <Modal visible={!!statusModal} animationType="slide" presentationStyle="formSheet">
          <SafeAreaView style={styles.modalRoot}>
            <View style={styles.modalHeader}>
              <Text style={T.h3}>{statusModal.patient_name}</Text>
              <TouchableOpacity onPress={() => setStatusModal(null)}>
                <Text style={{ fontSize: 22, color: Colors.textSub }}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20 }}>
              <Text style={[T.label, { marginBottom: 10 }]}>Update Status</Text>
              {STATUSES.map(({ label, value, variant }) => (
                <TouchableOpacity key={value} onPress={() => setNewStatus(value)}
                  style={[styles.statusRow, newStatus === value && styles.statusRowActive]}>
                  <Badge label={label} variant={variant} />
                  {newStatus === value && <Text style={{ color: Colors.brand, fontWeight: '700' }}>✓</Text>}
                </TouchableOpacity>
              ))}
              <Input label="Notes" placeholder="Update notes..." value={statusNotes}
                onChangeText={setStatusNotes} multiline numberOfLines={3} />
              <Button title="Update Status" onPress={handleStatusUpdate} loading={loading} size="lg" style={{ marginTop: 8 }} />
            </View>
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: Colors.bg },
  pipelineBar:    { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, maxHeight: 90 },
  pipeChip:       { alignItems: 'center', backgroundColor: Colors.grayBg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, minWidth: 72 },
  pipeChipActive: { backgroundColor: Colors.brandBg, borderWidth: 1, borderColor: Colors.brand },
  pipeCount:      { fontSize: 18, fontWeight: '700', color: Colors.text },
  pipeLabel:      { fontSize: 10, color: Colors.textSub, marginTop: 2 },
  addBtn:         { padding: 10, paddingHorizontal: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, alignItems: 'flex-end' },
  updateBtn:      { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border, alignItems: 'flex-end' },
  modalRoot:      { flex: 1, backgroundColor: Colors.bg },
  modalHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  pill:           { borderWidth: 1, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  pillActive:     { backgroundColor: Colors.brand, borderColor: Colors.brand },
  pillText:       { fontSize: 12, color: Colors.text, fontWeight: '500' },
  pillTextActive: { color: '#fff' },
  statusRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, backgroundColor: Colors.surface, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  statusRowActive:{ borderColor: Colors.brand, backgroundColor: Colors.brandBg },
});
