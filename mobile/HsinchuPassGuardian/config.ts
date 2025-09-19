// API Configuration
// Using HTTP for immediate testing (Android 9+ requires domain)
export const API_BASE_URL = 'http://api.hsinchu.dpdns.org';

// Firebase Configuration
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDR82O3a-BWOSkJXHBMUMSzquYoz62pBVc',
  authDomain: 'hccg-hsinchu-pass-guardian.firebaseapp.com',
  projectId: 'hccg-hsinchu-pass-guardian',
  storageBucket: 'hccg-hsinchu-pass-guardian.firebasestorage.app',
  messagingSenderId: '484527168113',
  appId: '1:484527168113:ios:ee813420b0623bc5a119d0',
};

// Geofencing Configuration
export const GEOFENCE_CONFIG = {
  DEFAULT_RADIUS: 100, // meters
  MIN_RADIUS: 10,
  MAX_RADIUS: 10000,
  CHECK_INTERVAL: 30000, // 30 seconds
  ANOMALY_THRESHOLD: 30, // minutes without movement
};

// Emergency Contact Configuration
export const EMERGENCY_CONFIG = {
  SOS_MESSAGE: '緊急求救！請立即協助！',
  POLICE_NUMBER: '110',
  FIRE_DEPARTMENT: '119',
};