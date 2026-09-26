/**
 * Healthqube Eyes — React Native Root
 * Bootstraps auth session, starts GPS background service,
 * starts offline sync listener, and registers Firebase FCM.
 */
import React, { useEffect } from 'react';
import { StatusBar, LogBox, Alert } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import Toast from 'react-native-toast-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import AppNavigator             from './src/navigation/AppNavigator';
import useAuthStore             from './src/store/authStore';
import { employeesAPI }         from './src/api';
import { configureBackgroundFetch } from './src/utils/locationService';
import { startSyncService, stopSyncService } from './src/utils/syncService';
import { openDB }               from './src/store/offlineDB';

// Suppress known non-critical warnings
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'ViewPropTypes will be removed',
]);

export default function App() {
  const { bootstrap, accessToken, employee, logout } = useAuthStore();

  useEffect(() => {
    // 1. Restore session from AsyncStorage
    bootstrap();
  }, []);

  useEffect(() => {
    if (!accessToken || !employee) return;

    // 2. Open SQLite offline DB
    openDB().catch(console.warn);

    // 3. Start offline sync service
    startSyncService();

    // 4. Configure background GPS every 3 minutes
    configureBackgroundFetch(async () => {
      const { useAuthStore: store } = require('./src/store/authStore');
      return store.getState().accessToken;
    }).catch(console.warn);

    // 5. Register FCM token with backend
    registerFcm();

    // 6. Handle foreground notifications
    const unsubFg = messaging().onMessage(async (remoteMessage) => {
      Toast.show({
        type:  'info',
        text1: remoteMessage.notification?.title || 'Healthqube Eyes',
        text2: remoteMessage.notification?.body  || '',
      });
    });

    return () => {
      unsubFg();
      stopSyncService();
    };
  }, [accessToken, employee]);

  const registerFcm = async () => {
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) return;

      const fcmToken = await messaging().getToken();
      if (fcmToken) {
        await employeesAPI.updateFcm(fcmToken).catch(() => {});
      }

      // Refresh token listener
      messaging().onTokenRefresh(async (newToken) => {
        await employeesAPI.updateFcm(newToken).catch(() => {});
      });
    } catch (_) {}
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <AppNavigator />
      <Toast />
    </GestureHandlerRootView>
  );
}
