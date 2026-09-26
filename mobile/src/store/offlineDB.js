/**
 * offlineDB.js
 * SQLite-backed offline queue. When the device has no internet,
 * attendance, location pings, meetings, leads and sales are
 * written here and synced automatically when connectivity returns.
 */
import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

let db = null;

export const openDB = async () => {
  if (db) return db;
  db = await SQLite.openDatabase({ name: 'healthqubes_offline.db', location: 'default' });
  await createTables();
  return db;
};

const createTables = async () => {
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS offline_queue (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      type        TEXT NOT NULL,
      payload     TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now')),
      synced      INTEGER DEFAULT 0,
      retry_count INTEGER DEFAULT 0
    )
  `);

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS location_cache (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      lat         REAL NOT NULL,
      lng         REAL NOT NULL,
      accuracy    REAL,
      speed       REAL,
      battery     INTEGER,
      recorded_at TEXT DEFAULT (datetime('now')),
      synced      INTEGER DEFAULT 0
    )
  `);
};

// ── Enqueue a record for later sync ─────────────────────────────────────────
export const enqueue = async (type, payload) => {
  const conn = await openDB();
  await conn.executeSql(
    'INSERT INTO offline_queue (type, payload) VALUES (?, ?)',
    [type, JSON.stringify(payload)]
  );
};

// ── Enqueue a location ping ──────────────────────────────────────────────────
export const cacheLocation = async ({ lat, lng, accuracy, speed, battery }) => {
  const conn = await openDB();
  await conn.executeSql(
    'INSERT INTO location_cache (lat, lng, accuracy, speed, battery) VALUES (?,?,?,?,?)',
    [lat, lng, accuracy ?? null, speed ?? null, battery ?? null]
  );
};

// ── Get unsynced queue items ─────────────────────────────────────────────────
export const getUnsynced = async () => {
  const conn = await openDB();
  const [result] = await conn.executeSql(
    'SELECT * FROM offline_queue WHERE synced = 0 AND retry_count < 5 ORDER BY id ASC LIMIT 50'
  );
  const rows = [];
  for (let i = 0; i < result.rows.length; i++) rows.push(result.rows.item(i));
  return rows;
};

// ── Get unsynced location pings ──────────────────────────────────────────────
export const getUnsyncedLocations = async () => {
  const conn = await openDB();
  const [result] = await conn.executeSql(
    'SELECT * FROM location_cache WHERE synced = 0 ORDER BY id ASC LIMIT 100'
  );
  const rows = [];
  for (let i = 0; i < result.rows.length; i++) rows.push(result.rows.item(i));
  return rows;
};

// ── Mark synced ──────────────────────────────────────────────────────────────
export const markSynced = async (id) => {
  const conn = await openDB();
  await conn.executeSql('UPDATE offline_queue SET synced = 1 WHERE id = ?', [id]);
};

export const markLocationSynced = async (id) => {
  const conn = await openDB();
  await conn.executeSql('UPDATE location_cache SET synced = 1 WHERE id = ?', [id]);
};

// ── Increment retry count on failure ─────────────────────────────────────────
export const incrementRetry = async (id) => {
  const conn = await openDB();
  await conn.executeSql('UPDATE offline_queue SET retry_count = retry_count + 1 WHERE id = ?', [id]);
};

// ── Count pending ────────────────────────────────────────────────────────────
export const pendingCount = async () => {
  const conn = await openDB();
  const [result] = await conn.executeSql(
    'SELECT COUNT(*) as cnt FROM offline_queue WHERE synced = 0'
  );
  return result.rows.item(0).cnt;
};
