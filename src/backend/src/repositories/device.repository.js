/**
 * Device Repository - Minimal implementation for TDD GREEN phase
 */

class DeviceRepository {
  // These methods are empty and will be mocked by jest
  async checkNCCRegistry() {}
  async findBySerialNumber() {}
  async getUserConsent() {}
  async create() {}
  async findById() {}
  async updateStatus() {}
  async saveUserConsent() {}
  async transferOwnership() {}
  async countUserGeofences() {}
  async findByUserAndName() {}
}

module.exports = { DeviceRepository };