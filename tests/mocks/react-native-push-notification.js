// Mock react-native-push-notification

const PushNotification = {
  configure: jest.fn(),
  localNotification: jest.fn(),
  localNotificationSchedule: jest.fn(),
  cancelLocalNotifications: jest.fn(),
  cancelAllLocalNotifications: jest.fn(),
  createChannel: jest.fn((config, callback) => {
    if (callback) callback(true);
  }),
  deleteChannel: jest.fn(),
  getChannels: jest.fn((callback) => {
    callback(['default']);
  }),
  checkPermissions: jest.fn((callback) => {
    callback({ alert: true, badge: true, sound: true });
  }),
  requestPermissions: jest.fn(() => Promise.resolve({ alert: true, badge: true, sound: true })),
  abandonPermissions: jest.fn(),
  getApplicationIconBadgeNumber: jest.fn((callback) => {
    callback(0);
  }),
  setApplicationIconBadgeNumber: jest.fn(),
  popInitialNotification: jest.fn((callback) => {
    callback(null);
  })
};

module.exports = PushNotification;