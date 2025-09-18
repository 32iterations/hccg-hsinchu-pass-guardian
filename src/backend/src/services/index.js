/**
 * Services Index - Centralized Service Exports
 *
 * This file provides a single point of entry for all services
 * and manages the service container initialization.
 */

const { getContainer, resetContainer, ServiceContainer } = require('./ServiceContainer');

// Export individual service classes for direct instantiation if needed
const { CaseFlowService } = require('../../services/CaseFlowService');
const { KPIService } = require('../../services/KPIService');
const MyDataAdapter = require('../../services/MyDataAdapter');
const { RBACService } = require('../../services/RBACServiceEnhanced');
const { AuditService } = require('../../services/AuditService');
const { GeoAlertService } = require('../../services/GeoAlertService');
const { BLEScannerService } = require('../../services/BLEScannerService');

/**
 * Get services from the global container
 */
function getServices() {
  const container = getContainer();
  return container.getServicesForContext('api');
}

/**
 * Get services for testing with mocks
 */
function getTestServices() {
  const container = ServiceContainer.createTestContainer();
  return container.getServicesForContext('test');
}

/**
 * Initialize services with custom configuration
 */
function initializeServices(config = {}) {
  const container = getContainer();

  // Update container configuration
  if (config.database) {
    container.config.database = config.database;
  }

  if (config.storage) {
    container.config.storage = config.storage;
  }

  return container.getServicesForContext('api');
}

/**
 * Cleanup services (for tests and shutdown)
 */
async function cleanupServices() {
  const container = getContainer();
  await container.shutdown();
  resetContainer();
}

module.exports = {
  // Service Container
  getContainer,
  resetContainer,
  ServiceContainer,

  // Service Management
  getServices,
  getTestServices,
  initializeServices,
  cleanupServices,

  // Individual Service Classes
  CaseFlowService,
  KPIService,
  MyDataAdapter,
  RBACService,
  AuditService,
  GeoAlertService,
  BLEScannerService
};