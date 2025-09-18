// React Native Keychain mock for mobile tests
module.exports = {
  setInternetCredentials: jest.fn().mockResolvedValue(true),
  getInternetCredentials: jest.fn().mockResolvedValue({
    username: 'hsinchu_guardian',
    password: 'access_token_123'
  }),
  resetInternetCredentials: jest.fn().mockResolvedValue(true),
  hasInternetCredentials: jest.fn().mkResolvedValue(true),

  SECURITY_LEVEL: {
    SECURE_HARDWARE: 'SECURE_HARDWARE',
    SECURE_SOFTWARE: 'SECURE_SOFTWARE',
    ANY: 'ANY'
  },

  ACCESS_CONTROL: {
    BIOMETRY_ANY: 'kSecAccessControlBiometryAny',
    BIOMETRY_CURRENT_SET: 'kSecAccessControlBiometryCurrentSet'
  }
};