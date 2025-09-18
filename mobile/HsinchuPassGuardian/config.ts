// API Configuration
export const API_BASE_URL = 'http://147.251.115.54:3000';

// Firebase Configuration
export const FIREBASE_CONFIG = {
  // Add your Firebase configuration here
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
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