// React Native Push Notification mock for mobile tests
module.exports = {
  configure: jest.fn(),
  localNotification: jest.fn(),
  localNotificationSchedule: jest.fn(),
  requestPermissions: jest.fn().mockResolvedValue({
    alert: true,
    badge: true,
    sound: true
  }),
  presentLocalNotification: jest.fn(),
  scheduleLocalNotification: jest.fn(),
  cancelLocalNotifications: jest.fn(),
  cancelAllLocalNotifications: jest.fn(),
  removeAllDeliveredNotifications: jest.fn(),
  getDeliveredNotifications: jest.fn().mockImplementation((callback) => {
    callback([]);
  }),
  removeDeliveredNotifications: jest.fn(),
  getScheduledLocalNotifications: jest.fn().mockImplementation((callback) => {
    callback([]);
  }),
  setApplicationIconBadgeNumber: jest.fn(),
  getApplicationIconBadgeNumber: jest.fn().mockImplementation((callback) => {
    callback(0);
  }),
  popInitialNotification: jest.fn().mockImplementation((callback) => {
    callback(null);
  }),
  checkPermissions: jest.fn().mockImplementation((callback) => {
    callback({
      alert: true,
      badge: true,
      sound: true
    });
  }),
  abandonPermissions: jest.fn(),
  registerNotificationActions: jest.fn(),
  clearAllNotifications: jest.fn(),
  createChannel: jest.fn(),
  channelExists: jest.fn().mockImplementation((channelId, callback) => {
    callback(true);
  }),
  channelBlocked: jest.fn().mockImplementation((channelId, callback) => {
    callback(false);
  }),
  deleteChannel: jest.fn()
};