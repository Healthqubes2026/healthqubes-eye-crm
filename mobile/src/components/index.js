import React from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  ActivityIndicator, StyleSheet, Dimensions,
} from 'react-native';

const { width: W } = Dimensions.get('window');

// ── Design tokens ─────────────────────────────────────────────────────────────
export const Colors = {
  brand:    '#2E6BE6',
  brandDark:'#1B55C8',
  brandBg:  '#EEF4FF',
  teal:     '#0F8C6A',
  tealBg:   '#E0F7F2',
  amber:    '#BA7517',
  amberBg:  '#FAEEDA',
  red:      '#DC2626',
  redBg:    '#FCEBEB',
  green:    '#15803D',
  greenBg:  '#F0FDF4',
  gray:     '#6B7280',
  grayBg:   '#F3F4F6',
  bg:       '#F7F8FA',
  surface:  '#FFFFFF',
  border:   '#E5E7EB',
  text:     '#111827',
  textSub:  '#6B7280',
  textMuted:'#9CA3AF',
};

// ── Typography ────────────────────────────────────────────────────────────────
export const T = StyleSheet.create({
  h1:    { fontSize: 24, fontWeight: '700', color: Colors.text, letterSpacing: -0.5 },
  h2:    { fontSize: 20, fontWeight: '600', color: Colors.text },
  h3:    { fontSize: 16, fontWeight: '600', color: Colors.text },
  body:  { fontSize: 14, color: Colors.text, lineHeight: 20 },
  small: { fontSize: 12, color: Colors.textSub },
  mono:  { fontSize: 12, fontFamily: 'monospace', color: Colors.textSub },
  label: { fontSize: 12, fontWeight: '600', color: Colors.textSub, textTransform: 'uppercase', letterSpacing: 0.5 },
});

// ── Button ────────────────────────────────────────────────────────────────────
export const Button = ({
  title, onPress, variant = 'primary', size = 'md',
  loading = false, disabled = false, icon, style,
}) => {
  const bg = {
    primary:  Colors.brand,
    secondary: Colors.surface,
    danger:   Colors.red,
    ghost:    'transparent',
  }[variant];

  const textColor = variant === 'secondary' ? Colors.brand : variant === 'ghost' ? Colors.brand : '#fff';
  const borderColor = variant === 'secondary' ? Colors.brand : 'transparent';
  const py = size === 'sm' ? 10 : size === 'lg' ? 16 : 13;
  const fs = size === 'sm' ? 13 : size === 'lg' ? 16 : 14;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.btn,
        { backgroundColor: bg, borderColor, paddingVertical: py, opacity: (disabled || loading) ? 0.5 : 1 },
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator color={textColor} size="small" />
        : <>
            {icon && <View style={{ marginRight: 6 }}>{icon}</View>}
            <Text style={[styles.btnText, { color: textColor, fontSize: fs }]}>{title}</Text>
          </>
      }
    </TouchableOpacity>
  );
};

// ── Input ─────────────────────────────────────────────────────────────────────
export const Input = ({
  label, placeholder, value, onChangeText, error,
  secureTextEntry, keyboardType, multiline, numberOfLines,
  rightIcon, style,
}) => (
  <View style={{ marginBottom: 14 }}>
    {label && <Text style={[T.label, { marginBottom: 6 }]}>{label}</Text>}
    <View style={[styles.inputWrap, error && { borderColor: Colors.red }, style]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
        numberOfLines={numberOfLines}
        style={[styles.input, multiline && { height: 90, textAlignVertical: 'top' }]}
      />
      {rightIcon && <View style={styles.inputRight}>{rightIcon}</View>}
    </View>
    {error && <Text style={[T.small, { color: Colors.red, marginTop: 4 }]}>{error}</Text>}
  </View>
);

// ── Select pill group ─────────────────────────────────────────────────────────
export const SegmentControl = ({ options, value, onChange }) => (
  <View style={styles.segment}>
    {options.map((opt) => (
      <TouchableOpacity
        key={opt.value}
        onPress={() => onChange(opt.value)}
        style={[styles.segItem, value === opt.value && styles.segActive]}
      >
        <Text style={[styles.segText, value === opt.value && styles.segTextActive]}>
          {opt.label}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
);

// ── Card ──────────────────────────────────────────────────────────────────────
export const Card = ({ children, style }) => (
  <View style={[styles.card, style]}>{children}</View>
);

// ── Stat card ─────────────────────────────────────────────────────────────────
export const StatCard = ({ label, value, sub, iconBg = Colors.brandBg, icon, color = Colors.brand }) => (
  <Card style={styles.statCard}>
    <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
    </View>
    <Text style={[T.small, { marginTop: 8, marginBottom: 2 }]}>{label}</Text>
    <Text style={[T.h2, { color, fontSize: 22 }]}>{value ?? '—'}</Text>
    {sub ? <Text style={[T.small, { marginTop: 2 }]}>{sub}</Text> : null}
  </Card>
);

// ── Badge ─────────────────────────────────────────────────────────────────────
const BADGE_VARIANTS = {
  green:  { bg: Colors.greenBg,  text: Colors.green },
  red:    { bg: Colors.redBg,    text: Colors.red },
  amber:  { bg: Colors.amberBg,  text: Colors.amber },
  blue:   { bg: Colors.brandBg,  text: Colors.brand },
  teal:   { bg: Colors.tealBg,   text: Colors.teal },
  gray:   { bg: Colors.grayBg,   text: Colors.gray },
};

export const Badge = ({ label, variant = 'gray' }) => {
  const v = BADGE_VARIANTS[variant] || BADGE_VARIANTS.gray;
  return (
    <View style={[styles.badge, { backgroundColor: v.bg }]}>
      <Text style={[styles.badgeText, { color: v.text }]}>{label}</Text>
    </View>
  );
};

// ── Avatar ────────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  { bg: Colors.brandBg, text: Colors.brand },
  { bg: Colors.tealBg,  text: Colors.teal },
  { bg: Colors.amberBg, text: Colors.amber },
  { bg: '#F3E8FF',      text: '#7C3AED' },
];

export const Avatar = ({ name = '', size = 40 }) => {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const c = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.bg }]}>
      <Text style={[styles.avatarText, { color: c.text, fontSize: size * 0.35 }]}>{initials}</Text>
    </View>
  );
};

// ── Empty state ───────────────────────────────────────────────────────────────
export const EmptyState = ({ icon = '📭', title, description }) => (
  <View style={styles.empty}>
    <Text style={{ fontSize: 40, marginBottom: 12 }}>{icon}</Text>
    <Text style={[T.h3, { textAlign: 'center' }]}>{title}</Text>
    {description && <Text style={[T.small, { textAlign: 'center', marginTop: 6 }]}>{description}</Text>}
  </View>
);

// ── Divider ───────────────────────────────────────────────────────────────────
export const Divider = ({ style }) => <View style={[styles.divider, style]} />;

// ── Row item ──────────────────────────────────────────────────────────────────
export const ListRow = ({ left, center, right, onPress, style }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7}
    style={[styles.listRow, style]}>
    {left && <View style={{ marginRight: 12 }}>{left}</View>}
    <View style={{ flex: 1 }}>{center}</View>
    {right && <View style={{ marginLeft: 8 }}>{right}</View>}
  </TouchableOpacity>
);

// ── Screen header ─────────────────────────────────────────────────────────────
export const ScreenHeader = ({ title, subtitle, right }) => (
  <View style={styles.screenHeader}>
    <View style={{ flex: 1 }}>
      <Text style={T.h2}>{title}</Text>
      {subtitle && <Text style={[T.small, { marginTop: 2 }]}>{subtitle}</Text>}
    </View>
    {right}
  </View>
);

// ── Live indicator ────────────────────────────────────────────────────────────
export const LiveDot = () => (
  <View style={styles.liveDot} />
);

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  btn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 20 },
  btnText:    { fontWeight: '600', letterSpacing: 0.2 },
  inputWrap:  { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 12, backgroundColor: Colors.surface, paddingHorizontal: 14 },
  input:      { flex: 1, fontSize: 15, color: Colors.text, paddingVertical: 13 },
  inputRight: { marginLeft: 8 },
  card:       { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  statCard:   { flex: 1, minWidth: (W - 48) / 2 },
  statIcon:   { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  badgeText:  { fontSize: 11, fontWeight: '600' },
  avatar:     { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '700' },
  empty:      { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  divider:    { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  listRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: Colors.surface },
  screenHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  segment:    { flexDirection: 'row', backgroundColor: Colors.grayBg, borderRadius: 10, padding: 4 },
  segItem:    { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segActive:  { backgroundColor: Colors.surface, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  segText:    { fontSize: 13, color: Colors.textSub, fontWeight: '500' },
  segTextActive: { color: Colors.brand, fontWeight: '600' },
  liveDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
});
