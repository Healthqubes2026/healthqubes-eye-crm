// SalesScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Geolocation from '@react-native-community/geolocation';
import { salesAPI, meetingsAPI } from '../../api';
import { enqueue } from '../../store/offlineDB';
import { Button, Card, Badge, Colors, T, EmptyState, Input } from '../../components';

const fmtINR = (n) => n >= 1000 ? `₹${(n/1000).toFixed(1)}K` : `₹${n}`;
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

const PRODUCTS = [
  { id: 1, name: 'Cataract IOL (Monofocal)', price: 1700 },
  { id: 2, name: 'Cataract IOL (Trifocal)',  price: 8500 },
  { id: 3, name: 'Anti-VEGF Injection',       price: 5000 },
  { id: 4, name: 'Dry Eye Drops',             price: 160  },
  { id: 5, name: 'Contact Lens Solution',     price: 250  },
  { id: 6, name: 'Daily Disposable Lenses',   price: 800  },
  { id: 7, name: 'Fundus Camera Kit',         price: 2500 },
  { id: 8, name: 'LASIK Post-op Kit',         price: 450  },
];

const PAYMENT_MODES = ['cash', 'upi', 'neft', 'cheque'];

export default function SalesScreen() {
  const [sales, setSales]         = useState([]);
  const [addModal, setAddModal]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [doctors, setDoctors]     = useState([]);

  // Form state
  const [items, setItems]         = useState([{ product_id: null, quantity: 1 }]);
  const [doctorId, setDoctorId]   = useState(null);
  const [hospital, setHospital]   = useState('');
  const [payMode, setPayMode]     = useState('cash');
  const [notes, setNotes]         = useState('');
  const [prodPickerIdx, setProdPickerIdx] = useState(null);
  const [docPickerOpen, setDocPickerOpen] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [s, d] = await Promise.all([
        salesAPI.list({ limit: 30 }),
        meetingsAPI.listDoctors({ limit: 100 }),
      ]);
      setSales(s.data.data || []);
      setDoctors(d.data.data || []);
    } catch (_) {}
  };

  const orderTotal = items.reduce((sum, item) => {
    const p = PRODUCTS.find(pr => pr.id === item.product_id);
    return sum + (p ? p.price * (item.quantity || 0) : 0);
  }, 0);

  const addItem = () => setItems([...items, { product_id: null, quantity: 1 }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i, key, val) => {
    const next = [...items];
    next[i] = { ...next[i], [key]: val };
    setItems(next);
  };

  const handleAdd = async () => {
    const validItems = items.filter(it => it.product_id);
    if (!validItems.length) return Alert.alert('Required', 'Add at least one product');

    let coords = null;
    try {
      coords = await new Promise((res, rej) =>
        Geolocation.getCurrentPosition(p => res(p.coords), e => rej(e), { enableHighAccuracy: true, timeout: 10000 })
      );
    } catch (_) {}

    setLoading(true);
    const payload = {
      doctor_id:    doctorId || undefined,
      hospital,
      sale_date:    new Date().toISOString().split('T')[0],
      lat:          coords?.latitude,
      lng:          coords?.longitude,
      location_name: 'Current Location',
      payment_mode: payMode,
      notes,
      items:        validItems.map(it => ({ product_id: it.product_id, quantity: parseInt(it.quantity) || 1 })),
    };

    try {
      await salesAPI.add(payload);
      Alert.alert('✅ Sale Recorded', `Total: ${fmtINR(orderTotal)}`);
      resetForm(); setAddModal(false);
      await loadAll();
    } catch (err) {
      if (!err.response) {
        await enqueue('sale_add', payload);
        Alert.alert('Saved Offline', 'Will sync when internet returns');
        resetForm(); setAddModal(false);
      } else {
        Alert.alert('Error', err.response?.data?.message || 'Failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setItems([{ product_id: null, quantity: 1 }]);
    setDoctorId(null); setHospital(''); setPayMode('cash'); setNotes('');
  };

  const selectedDoctor = doctors.find(d => d.id === doctorId);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.addBtn}>
        <Button title="+ Add Sale" onPress={() => setAddModal(true)} size="sm" />
      </View>

      <FlatList
        data={sales}
        keyExtractor={(s) => String(s.id)}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<EmptyState icon="💰" title="No sales yet" description="Record your first sale" />}
        renderItem={({ item: s }) => (
          <Card style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={[T.body, { fontWeight: '600' }]}>{fmtDate(s.sale_date)}</Text>
              <Text style={[T.h3, { color: Colors.green }]}>{fmtINR(s.total_amount)}</Text>
            </View>
            {s.doctor_name && <Text style={T.small}>Doctor: {s.doctor_name}</Text>}
            {(s.items || []).map((it, i) => (
              <Text key={i} style={T.small}>{it.product_name} ×{it.quantity}</Text>
            ))}
            <Badge label={s.payment_mode || 'cash'} variant="gray" />
          </Card>
        )}
      />

      {/* Add Sale Modal */}
      <Modal visible={addModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={T.h3}>Record Sale</Text>
            <TouchableOpacity onPress={() => { setAddModal(false); resetForm(); }}>
              <Text style={{ fontSize: 22, color: Colors.textSub }}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">

            {/* Doctor */}
            <Text style={[T.label, { marginBottom: 6 }]}>Doctor</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setDocPickerOpen(true)}>
              <Text style={selectedDoctor ? T.body : [T.body, { color: Colors.textMuted }]}>
                {selectedDoctor ? selectedDoctor.name : 'Select doctor (optional)'}
              </Text>
              <Text>▾</Text>
            </TouchableOpacity>

            <Input label="Hospital" placeholder="Hospital name" value={hospital} onChangeText={setHospital} />

            {/* Products */}
            <Text style={[T.label, { marginBottom: 8, marginTop: 4 }]}>Products *</Text>
            {items.map((item, idx) => {
              const prod = PRODUCTS.find(p => p.id === item.product_id);
              return (
                <View key={idx} style={styles.itemRow}>
                  <TouchableOpacity style={styles.prodPicker} onPress={() => setProdPickerIdx(idx)}>
                    <Text style={prod ? T.body : [T.body, { color: Colors.textMuted }]} numberOfLines={1}>
                      {prod ? prod.name : 'Select product...'}
                    </Text>
                    {prod && <Text style={[T.small, { color: Colors.green }]}>{fmtINR(prod.price)}</Text>}
                  </TouchableOpacity>
                  <View style={styles.qtyWrap}>
                    <TouchableOpacity onPress={() => updateItem(idx, 'quantity', Math.max(1, (item.quantity || 1) - 1))} style={styles.qtyBtn}>
                      <Text style={styles.qtyBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.qtyNum}>{item.quantity || 1}</Text>
                    <TouchableOpacity onPress={() => updateItem(idx, 'quantity', (item.quantity || 1) + 1)} style={styles.qtyBtn}>
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  {items.length > 1 && (
                    <TouchableOpacity onPress={() => removeItem(idx)} style={{ paddingLeft: 8 }}>
                      <Text style={{ color: Colors.red, fontSize: 18 }}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
            <TouchableOpacity onPress={addItem} style={{ marginBottom: 16 }}>
              <Text style={{ color: Colors.brand, fontWeight: '600', fontSize: 13 }}>+ Add another product</Text>
            </TouchableOpacity>

            {/* Order total */}
            {orderTotal > 0 && (
              <View style={styles.totalRow}>
                <Text style={[T.body, { fontWeight: '600' }]}>Order Total</Text>
                <Text style={[T.h3, { color: Colors.green }]}>{fmtINR(orderTotal)}</Text>
              </View>
            )}

            {/* Payment */}
            <Text style={[T.label, { marginBottom: 8 }]}>Payment Mode</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {PAYMENT_MODES.map(m => (
                <TouchableOpacity key={m} onPress={() => setPayMode(m)}
                  style={[styles.pill, payMode === m && styles.pillActive]}>
                  <Text style={[styles.pillText, payMode === m && { color: '#fff' }]}>{m.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input label="Notes" placeholder="Optional notes..." value={notes} onChangeText={setNotes} multiline numberOfLines={2} />
            <Button title="Record Sale" onPress={handleAdd} loading={loading} size="lg" style={{ marginTop: 8 }} />
          </ScrollView>
        </SafeAreaView>

        {/* Product picker */}
        <Modal visible={prodPickerIdx !== null} animationType="slide" presentationStyle="formSheet">
          <SafeAreaView style={styles.modalRoot}>
            <View style={styles.modalHeader}>
              <Text style={T.h3}>Select Product</Text>
              <TouchableOpacity onPress={() => setProdPickerIdx(null)}>
                <Text style={{ fontSize: 22, color: Colors.textSub }}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={PRODUCTS}
              keyExtractor={(p) => String(p.id)}
              renderItem={({ item: p }) => (
                <TouchableOpacity style={styles.prodRow} onPress={() => {
                  updateItem(prodPickerIdx, 'product_id', p.id);
                  setProdPickerIdx(null);
                }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[T.body, { fontWeight: '500' }]}>{p.name}</Text>
                  </View>
                  <Text style={[T.body, { color: Colors.green, fontWeight: '600' }]}>₹{p.price}</Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: Colors.border }} />}
            />
          </SafeAreaView>
        </Modal>

        {/* Doctor picker */}
        <Modal visible={docPickerOpen} animationType="slide" presentationStyle="formSheet">
          <SafeAreaView style={styles.modalRoot}>
            <View style={styles.modalHeader}>
              <Text style={T.h3}>Select Doctor</Text>
              <TouchableOpacity onPress={() => setDocPickerOpen(false)}>
                <Text style={{ fontSize: 22, color: Colors.textSub }}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={doctors}
              keyExtractor={(d) => String(d.id)}
              renderItem={({ item: d }) => (
                <TouchableOpacity style={styles.prodRow} onPress={() => { setDoctorId(d.id); setDocPickerOpen(false); }}>
                  <Text style={[T.body, { fontWeight: '500' }]}>{d.name}</Text>
                  <Text style={T.small}>{d.hospital}</Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: Colors.border }} />}
            />
          </SafeAreaView>
        </Modal>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.bg },
  addBtn:      { padding: 10, paddingHorizontal: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, alignItems: 'flex-end' },
  modalRoot:   { flex: 1, backgroundColor: Colors.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  pickerBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, backgroundColor: Colors.surface, marginBottom: 14 },
  itemRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  prodPicker:  { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, backgroundColor: Colors.surface },
  qtyWrap:     { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  qtyBtn:      { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.grayBg, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText:  { fontSize: 18, fontWeight: '600', color: Colors.text },
  qtyNum:      { width: 30, textAlign: 'center', fontSize: 15, fontWeight: '600' },
  totalRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.greenBg, borderRadius: 12, padding: 14, marginBottom: 16 },
  pill:        { borderWidth: 1, borderColor: Colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  pillActive:  { backgroundColor: Colors.brand, borderColor: Colors.brand },
  pillText:    { fontSize: 11, fontWeight: '600', color: Colors.text },
  prodRow:     { padding: 16, backgroundColor: Colors.surface },
});
