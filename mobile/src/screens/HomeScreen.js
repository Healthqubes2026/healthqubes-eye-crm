import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { dashboardAPI, attendanceAPI } from '../../api';
import useAuthStore from '../../store/authStore';
import { Card, StatCard, Badge, Avatar, Colors, T, Divider, LiveDot } from '../../components';

const fmtINR = (n) => {
  if (!n) return '₹0';
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Number(n).toLocaleString('en-IN')}`;
};

export default function HomeScreen({ navigation }) {
  const { employee } = useAuthStore();
  const [data, setData]           = useState(null);
  const [todayAtt, setTodayAtt]   = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [dash, att] = await Promise.all([
        dashboardAPI.get(),
        attendanceAPI.getToday(),
      ]);
      setData(dash.data.data);
      setTodayAtt(att.data.data);
    } catch (_) {}
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const d = data || {};

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[T.small, { color: Colors.textSub }]}>{greeting},</Text>
            <Text style={[T.h2, { marginTop: 2 }]}>{employee?.name?.split(' ')[0]} 👋</Text>
          </View>
          <Avatar name={employee?.name} size={44} />
        </View>

        {/* Attendance status card */}
        <View style={styles.padH}>
          <Card style={styles.attCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={T.label}>Today's Attendance</Text>
                <Text style={[T.h3, { marginTop: 4 }]}>
                  {todayAtt?.checkin_time
                    ? `Checked in at ${new Date(todayAtt.checkin_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                    : 'Not checked in yet'}
                </Text>
                {todayAtt?.is_late && (
                  <Badge label="Late" variant="amber" />
                )}
              </View>
              {!todayAtt?.checkin_time
                ? <TouchableOpacity style={styles.checkInBtn} onPress={() => navigation.navigate('Attendance')}>
                    <Text style={styles.checkInBtnText}>Check In →</Text>
                  </TouchableOpacity>
                : !todayAtt?.checkout_time
                  ? <TouchableOpacity style={[styles.checkInBtn, { backgroundColor: Colors.greenBg }]}
                      onPress={() => navigation.navigate('Attendance')}>
                      <Text style={[styles.checkInBtnText, { color: Colors.green }]}>Check Out →</Text>
                    </TouchableOpacity>
                  : <Badge label="Done ✓" variant="green" />
              }
            </View>
          </Card>
        </View>

        {/* KPI grid */}
        <Text style={[T.label, styles.sectionLabel]}>Today's Summary</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statRow}>
          <StatCard label="Visits Today"     value={d.meetings?.today_visits ?? 0}   icon="🤝" iconBg={Colors.brandBg} />
          <StatCard label="New Leads"        value={d.leads?.new_leads ?? 0}         icon="👥" iconBg="#FEF3C7" />
          <StatCard label="MTD Revenue"      value={fmtINR(d.sales?.mtd_revenue)}    icon="💰" iconBg={Colors.greenBg} color={Colors.green} />
          <StatCard label="Follow-ups Due"   value={d.meetings?.followups_due ?? 0}  icon="📆" iconBg={Colors.amberBg} color={Colors.amber} />
        </ScrollView>

        {/* Quick actions */}
        <Text style={[T.label, styles.sectionLabel]}>Quick Actions</Text>
        <View style={[styles.padH, styles.quickGrid]}>
          {[
            { icon: '📅', label: 'Attendance',  screen: 'Attendance',  bg: Colors.brandBg,  color: Colors.brand },
            { icon: '🤝', label: 'Log Visit',   screen: 'Meetings',    bg: '#F3E8FF',       color: '#7C3AED' },
            { icon: '👥', label: 'Add Lead',    screen: 'Leads',       bg: Colors.amberBg,  color: Colors.amber },
            { icon: '💰', label: 'Add Sale',    screen: 'Sales',       bg: Colors.greenBg,  color: Colors.green },
          ].map(({ icon, label, screen, bg, color }) => (
            <TouchableOpacity key={label}
              style={[styles.quickCard, { backgroundColor: bg }]}
              onPress={() => navigation.navigate(screen)}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 26 }}>{icon}</Text>
              <Text style={[styles.quickLabel, { color }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Follow-ups due */}
        {d.meetings?.followups_due > 0 && (
          <>
            <View style={[styles.padH, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }]}>
              <Text style={T.label}>Follow-ups Pending</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Meetings')}>
                <Text style={[T.small, { color: Colors.brand }]}>View all →</Text>
              </TouchableOpacity>
            </View>
            <Card style={[styles.padH, { marginHorizontal: 16, marginBottom: 8 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <LiveDot />
                <Text style={T.body}>{d.meetings.followups_due} doctor follow-up{d.meetings.followups_due > 1 ? 's' : ''} need attention</Text>
              </View>
            </Card>
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: Colors.bg },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, backgroundColor: Colors.surface },
  padH:         { paddingHorizontal: 16 },
  sectionLabel: { marginHorizontal: 16, marginTop: 20, marginBottom: 10 },
  statRow:      { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },
  attCard:      { marginBottom: 0, borderLeftWidth: 3, borderLeftColor: Colors.brand },
  checkInBtn:   { backgroundColor: Colors.brandBg, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  checkInBtnText: { color: Colors.brand, fontWeight: '700', fontSize: 13 },
  quickGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickCard:    { width: '47%', borderRadius: 16, padding: 16, alignItems: 'center', gap: 8 },
  quickLabel:   { fontSize: 13, fontWeight: '600' },
});
