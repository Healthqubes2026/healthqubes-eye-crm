import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { reportsAPI } from '../../api';
import { Card, StatCard, Colors, T, EmptyState, Badge } from '../../components';

// reportsAPI is imported from the main api index
import api from '../../api';

const fmtINR = (n) => {
  if (!n) return '₹0';
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Number(n).toLocaleString('en-IN')}`;
};

export default function ReportsScreen() {
  const [tab, setTab]         = useState('month');
  const [perf, setPerf]       = useState(null);
  const [attData, setAttData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();
  const from  = `${year}-${String(month).padStart(2, '0')}-01`;
  const to    = now.toISOString().split('T')[0];

  const load = async () => {
    try {
      const [p, a] = await Promise.all([
        reportsAPI.performance({ month, year }),
        reportsAPI.attendance({ from, to }),
      ]);
      setPerf(p.data.data || []);
      setAttData(a.data.data || []);
    } catch (_) {}
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Find current user's performance row
  const myPerf = perf?.[0] || null;
  const myAtt  = attData?.[0] || null;

  const attRate = myAtt && myAtt.total_days > 0
    ? Math.round((myAtt.present_days / myAtt.total_days) * 100)
    : 0;

  const convRate = myPerf && myPerf.leads_added > 0
    ? Math.round((myPerf.leads_converted / myPerf.leads_added) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Tab row */}
      <View style={styles.tabRow}>
        {[
          { key: 'month',   label: 'This Month' },
          { key: 'team',    label: 'Team Ranking' },
        ].map(({ key, label }) => (
          <TouchableOpacity key={key} onPress={() => setTab(key)}
            style={[styles.tab, tab === key && styles.tabActive]}>
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand} />}
      >
        {tab === 'month' && (
          <>
            <Text style={[T.label, { marginBottom: 12 }]}>
              {now.toLocaleString('default', { month: 'long' })} {year} — My Performance
            </Text>

            {/* KPI cards */}
            <View style={styles.gridRow}>
              <StatCard
                label="Days Present"
                value={myAtt?.present_days ?? '—'}
                sub={`${attRate}% attendance`}
                icon="📅"
                iconBg={Colors.brandBg}
              />
              <StatCard
                label="Doctor Visits"
                value={myPerf?.doctor_visits ?? '—'}
                icon="🤝"
                iconBg="#F3E8FF"
                color="#7C3AED"
              />
            </View>

            <View style={[styles.gridRow, { marginTop: 12 }]}>
              <StatCard
                label="Sales Revenue"
                value={fmtINR(myPerf?.sales_revenue)}
                sub={`${myPerf?.sales_orders ?? 0} orders`}
                icon="💰"
                iconBg={Colors.greenBg}
                color={Colors.green}
              />
              <StatCard
                label="Leads Added"
                value={myPerf?.leads_added ?? '—'}
                sub={`${myPerf?.leads_converted ?? 0} converted (${convRate}%)`}
                icon="👥"
                iconBg={Colors.amberBg}
                color={Colors.amber}
              />
            </View>

            {/* Attendance breakdown */}
            {myAtt && (
              <Card style={{ marginTop: 16 }}>
                <Text style={[T.label, { marginBottom: 12 }]}>Attendance Breakdown</Text>
                {[
                  { label: 'Present',  value: myAtt.present_days,  color: Colors.green },
                  { label: 'Absent',   value: myAtt.absent_days,   color: Colors.red },
                  { label: 'Late',     value: myAtt.late_days,     color: Colors.amber },
                  { label: 'Half Day', value: myAtt.half_days,     color: Colors.brand },
                ].map(({ label, value, color }) => (
                  <View key={label} style={styles.attRow}>
                    <Text style={[T.body, { width: 80 }]}>{label}</Text>
                    <View style={styles.barBg}>
                      <View style={[styles.barFill, {
                        width: `${Math.min(100, (value / (myAtt.total_days || 1)) * 100)}%`,
                        backgroundColor: color,
                      }]} />
                    </View>
                    <Text style={[T.body, { fontWeight: '700', width: 28, textAlign: 'right' }]}>{value}</Text>
                  </View>
                ))}
                <View style={styles.hoursRow}>
                  <Text style={T.small}>Total hours worked</Text>
                  <Text style={[T.body, { fontWeight: '700', color: Colors.brand }]}>
                    {myAtt.total_hours ?? '—'}h
                  </Text>
                </View>
                <View style={styles.hoursRow}>
                  <Text style={T.small}>Average daily hours</Text>
                  <Text style={[T.body, { fontWeight: '600' }]}>{myAtt.avg_hours ?? '—'}h</Text>
                </View>
              </Card>
            )}

            {!myPerf && !myAtt && (
              <EmptyState
                icon="📊"
                title="No data yet"
                description="Your performance stats will appear here as you log activities"
              />
            )}
          </>
        )}

        {tab === 'team' && (
          <>
            <Text style={[T.label, { marginBottom: 12 }]}>Team Sales Ranking — {now.toLocaleString('default', { month: 'long' })}</Text>
            {!perf?.length && (
              <EmptyState icon="🏆" title="No ranking data" description="Rankings appear once sales are recorded" />
            )}
            {(perf || []).map((emp, i) => (
              <Card key={emp.id} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[styles.rankBadge, i < 3 && styles.rankBadgeTop]}>
                    <Text style={[styles.rankNum, i < 3 && { color: Colors.amber }]}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[T.body, { fontWeight: '600' }]}>{emp.name}</Text>
                    <Text style={T.small}>{emp.zone || 'Field Agent'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[T.body, { fontWeight: '700', color: Colors.green }]}>
                      {fmtINR(emp.sales_revenue)}
                    </Text>
                    <Text style={T.small}>{emp.doctor_visits} visits · {emp.leads_added} leads</Text>
                  </View>
                </View>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: Colors.bg },
  tabRow:      { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab:         { flex: 1, paddingVertical: 13, alignItems: 'center' },
  tabActive:   { borderBottomWidth: 2, borderBottomColor: Colors.brand },
  tabText:     { fontSize: 13, color: Colors.textSub, fontWeight: '500' },
  tabTextActive: { color: Colors.brand, fontWeight: '700' },
  gridRow:     { flexDirection: 'row', gap: 12 },
  attRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  barBg:       { flex: 1, height: 8, backgroundColor: Colors.grayBg, borderRadius: 4, overflow: 'hidden' },
  barFill:     { height: 8, borderRadius: 4 },
  hoursRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: Colors.border },
  rankBadge:   { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.grayBg, alignItems: 'center', justifyContent: 'center' },
  rankBadgeTop:{ backgroundColor: '#FEF3C7' },
  rankNum:     { fontSize: 16, fontWeight: '700', color: Colors.textSub },
});
