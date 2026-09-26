// utils/firebase.js  — FCM push notification helper
// Initialise once; safe to require multiple times (firebase-admin is a singleton)

let messaging = null;

const init = () => {
  if (messaging) return messaging;
  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId:   process.env.FIREBASE_PROJECT_ID,
          privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
          privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
    }
    messaging = admin.messaging();
    console.log('✅  Firebase Admin initialised');
  } catch (err) {
    console.warn('⚠️   Firebase not configured – push notifications disabled:', err.message);
  }
  return messaging;
};

/**
 * Send push to a single device token
 */
const sendToDevice = async (fcmToken, title, body, data = {}) => {
  const msg = init();
  if (!msg || !fcmToken) return null;

  try {
    const result = await msg.send({
      token: fcmToken,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: { priority: 'high', notification: { sound: 'default', channelId: 'healthqubes_eye' } },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });
    return result;
  } catch (err) {
    console.error('FCM send error:', err.message);
    return null;
  }
};

/**
 * Send push to multiple tokens (multicast)
 */
const sendToDevices = async (fcmTokens, title, body, data = {}) => {
  const msg = init();
  if (!msg || !fcmTokens?.length) return null;

  try {
    return await msg.sendEachForMulticast({
      tokens: fcmTokens,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: { priority: 'high' },
    });
  } catch (err) {
    console.error('FCM multicast error:', err.message);
    return null;
  }
};

module.exports = { sendToDevice, sendToDevices };
