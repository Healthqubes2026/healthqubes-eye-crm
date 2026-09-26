import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import useAuthStore from '../store/authStore';
import { Colors } from '../components';

// Screens
import LoginScreen       from '../screens/auth/LoginScreen';
import HomeScreen        from '../screens/HomeScreen';
import AttendanceScreen  from '../screens/attendance/AttendanceScreen';
import MeetingsScreen    from '../screens/meetings/MeetingsScreen';
import LeadsScreen       from '../screens/leads/LeadsScreen';
import SalesScreen       from '../screens/sales/SalesScreen';
import ProfileScreen     from '../screens/ProfileScreen';
import ReportsScreen     from '../screens/reports/ReportsScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ── Custom bottom tab bar ──────────────────────────────────────────────────────
const TAB_ITEMS = [
  { name: 'Home',       label: 'Home',       icon: '🏠' },
  { name: 'Attendance', label: 'Attendance', icon: '📅' },
  { name: 'Meetings',   label: 'Doctors',    icon: '🤝' },
  { name: 'Leads',      label: 'Leads',      icon: '👥' },
  { name: 'Profile',    label: 'Profile',    icon: '👤' },
];

const CustomTabBar = ({ state, descriptors, navigation }) => (
  <View style={tabStyles.bar}>
    {state.routes.map((route, index) => {
      const { options } = descriptors[route.key];
      const item        = TAB_ITEMS.find(t => t.name === route.name);
      const isFocused   = state.index === index;

      return (
        <TouchableOpacity
          key={route.key}
          accessibilityRole="button"
          accessibilityState={isFocused ? { selected: true } : {}}
          onPress={() => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          }}
          style={tabStyles.item}
          activeOpacity={0.7}
        >
          <View style={[tabStyles.iconWrap, isFocused && tabStyles.iconWrapActive]}>
            <Text style={{ fontSize: 18 }}>{item?.icon}</Text>
          </View>
          <Text style={[tabStyles.label, isFocused && tabStyles.labelActive]}>
            {item?.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

// ── Main tab navigator (logged-in) ────────────────────────────────────────────
const MainTabs = () => (
  <Tab.Navigator
    tabBar={(props) => <CustomTabBar {...props} />}
    screenOptions={{ headerShown: false }}
  >
    <Tab.Screen name="Home"       component={HomeScreen} />
    <Tab.Screen name="Attendance" component={AttendanceScreen} />
    <Tab.Screen name="Meetings"   component={MeetingsScreen} />
    <Tab.Screen name="Leads"      component={LeadsScreen} />
    <Tab.Screen name="Profile"    component={ProfileScreen} />
  </Tab.Navigator>
);

// ── Root stack with extra screens reachable from Home ──────────────────────────
const AppStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="MainTabs" component={MainTabs} />
    <Stack.Screen name="Sales"    component={SalesScreen}
      options={{ headerShown: true, title: 'Sales', headerBackTitle: 'Back',
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.brand }} />
    <Stack.Screen name="Reports"  component={ReportsScreen}
      options={{ headerShown: true, title: 'My Reports', headerBackTitle: 'Back',
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.brand }} />
  </Stack.Navigator>
);

// ── Auth stack ────────────────────────────────────────────────────────────────
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
  </Stack.Navigator>
);

// ── Root navigator ────────────────────────────────────────────────────────────
export default function AppNavigator() {
  const { accessToken, employee, isBootstrapping } = useAuthStore();
  const isLoggedIn = !!accessToken && !!employee;

  if (isBootstrapping) return null; // Splash handled by native layer

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {isLoggedIn ? <AppStack /> : <AuthStack />}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const tabStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 8,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  item:          { flex: 1, alignItems: 'center', gap: 2 },
  iconWrap:      { width: 40, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  iconWrapActive:{ backgroundColor: Colors.brandBg },
  label:         { fontSize: 10, color: Colors.textSub, fontWeight: '500' },
  labelActive:   { color: Colors.brand, fontWeight: '700' },
});
