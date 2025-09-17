const crypto = {
  randomBytes: jest.fn(),
  createHmac: jest.fn(() => ({
    update: jest.fn(() => ({
      digest: jest.fn(() => 'mocked-signature')
    }))
  })),
  randomUUID: jest.fn(() => 'mocked-uuid-1234')
};

module.exports = crypto;