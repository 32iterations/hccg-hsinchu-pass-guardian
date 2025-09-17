// Mock for node-cron
module.exports = {
  schedule: jest.fn((expression, callback, options) => {
    // Return a mock task object
    return {
      start: jest.fn(),
      stop: jest.fn(),
      destroy: jest.fn(),
      getStatus: jest.fn().mockReturnValue('scheduled')
    };
  }),
  validate: jest.fn().mockReturnValue(true),
  getTasks: jest.fn().mockReturnValue([])
};