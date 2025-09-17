/**
 * Error Utility Classes for HsinchuPass Guardian
 * 新竹通安心守護 - 錯誤定義
 */

class ValidationError extends Error {
  constructor(message, code = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
  }
}

class SecurityError extends Error {
  constructor(message, code = 'SECURITY_ERROR') {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
  }
}

class ComplianceError extends Error {
  constructor(message, code = 'COMPLIANCE_ERROR') {
    super(message);
    this.name = 'ComplianceError';
    this.code = code;
  }
}

class AuditError extends Error {
  constructor(message, code = 'AUDIT_ERROR') {
    super(message);
    this.name = 'AuditError';
    this.code = code;
  }
}

class IntegrityError extends Error {
  constructor(message, code = 'INTEGRITY_ERROR') {
    super(message);
    this.name = 'IntegrityError';
    this.code = code;
  }
}

class CalculationError extends Error {
  constructor(message, code = 'CALCULATION_ERROR') {
    super(message);
    this.name = 'CalculationError';
    this.code = code;
  }
}

class ThresholdError extends Error {
  constructor(message, code = 'THRESHOLD_ERROR') {
    super(message);
    this.name = 'ThresholdError';
    this.code = code;
  }
}

module.exports = {
  ValidationError,
  SecurityError,
  ComplianceError,
  AuditError,
  IntegrityError,
  CalculationError,
  ThresholdError
};