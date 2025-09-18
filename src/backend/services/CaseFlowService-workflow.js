/**
 * CaseFlowService - Workflow State Transition Support
 * Enhanced workflow validation for P4 console RBAC testing
 */

class CaseFlowWorkflowService {
  constructor(dependencies = {}) {
    this.auditService = dependencies.auditService;
    this.rbacService = dependencies.rbacService;
    this.database = dependencies.database;

    // Workflow state definitions
    this.workflowStates = {
      '建立': {
        name: '建立',
        validTransitions: ['派遣'],
        requiredRoles: ['case_worker', 'case_manager', 'admin'],
        requiredPermissions: ['create_cases']
      },
      '派遣': {
        name: '派遣',
        validTransitions: ['執行中', '暫停'],
        requiredRoles: ['case_worker', 'case_manager', 'admin'],
        requiredPermissions: ['assign_cases']
      },
      '執行中': {
        name: '執行中',
        validTransitions: ['結案', '暫停'],
        requiredRoles: ['case_worker', 'social_worker', 'volunteer', 'case_manager', 'admin'],
        requiredPermissions: ['update_case_status']
      },
      '暫停': {
        name: '暫停',
        validTransitions: ['執行中', '結案'],
        requiredRoles: ['case_worker', 'case_manager', 'admin'],
        requiredPermissions: ['update_case_status']
      },
      '結案': {
        name: '結案',
        validTransitions: [],
        requiredRoles: ['case_worker', 'case_manager', 'admin'],
        requiredPermissions: ['close_cases']
      }
    };
  }

  async validateStateTransition(options) {
    const { fromState, toState, caseId, userId } = options;

    try {
      // Check if fromState exists
      const fromStateConfig = this.workflowStates[fromState];
      if (!fromStateConfig) {
        return {
          valid: false,
          violationType: 'invalid_source_state',
          allowedTransitions: [],
          message: `Invalid source state: ${fromState}`
        };
      }

      // Check if toState exists
      const toStateConfig = this.workflowStates[toState];
      if (!toStateConfig) {
        return {
          valid: false,
          violationType: 'invalid_target_state',
          allowedTransitions: fromStateConfig.validTransitions,
          message: `Invalid target state: ${toState}`
        };
      }

      // Check if transition is valid
      if (!fromStateConfig.validTransitions.includes(toState)) {
        return {
          valid: false,
          violationType: 'invalid_transition',
          allowedTransitions: fromStateConfig.validTransitions,
          message: `Cannot transition from ${fromState} to ${toState}`
        };
      }

      // Check permissions for target state
      if (userId && this.rbacService) {
        const userRole = await this.rbacService.getUserRole(userId);
        const userRoleName = userRole?.roleName;

        if (userRoleName && !toStateConfig.requiredRoles.includes(userRoleName)) {
          return {
            valid: false,
            violationType: 'insufficient_role_permissions',
            allowedTransitions: fromStateConfig.validTransitions.filter(state =>
              this.workflowStates[state].requiredRoles.includes(userRoleName)
            ),
            message: `Role ${userRoleName} cannot transition to ${toState}`
          };
        }
      }

      // Log successful validation
      if (this.auditService) {
        await this.auditService.logWorkflowTransition({
          caseId,
          fromState,
          toState,
          userId,
          validationResult: 'passed',
          timestamp: new Date().toISOString()
        });
      }

      return {
        valid: true,
        transitionAllowed: true,
        message: `Transition from ${fromState} to ${toState} is valid`
      };

    } catch (error) {
      return {
        valid: false,
        violationType: 'validation_error',
        allowedTransitions: [],
        message: `Validation error: ${error.message}`
      };
    }
  }

  async getValidTransitions(fromState, userId) {
    const stateConfig = this.workflowStates[fromState];
    if (!stateConfig) {
      return [];
    }

    let validTransitions = [...stateConfig.validTransitions];

    // Filter by user permissions if userId provided
    if (userId && this.rbacService) {
      try {
        const userRole = await this.rbacService.getUserRole(userId);
        const userRoleName = userRole?.roleName;

        if (userRoleName) {
          validTransitions = validTransitions.filter(state =>
            this.workflowStates[state].requiredRoles.includes(userRoleName)
          );
        }
      } catch (error) {
        console.warn('Error filtering transitions by user role:', error.message);
      }
    }

    return validTransitions;
  }

  async createWorkflowHistory(caseId, stage, performer, details = {}) {
    const historyEntry = {
      stage,
      timestamp: new Date().toISOString(),
      performer,
      details,
      validationsPassed: true
    };

    if (this.auditService) {
      await this.auditService.logWorkflowStageCompletion({
        caseId,
        stage,
        performer,
        details,
        timestamp: historyEntry.timestamp
      });
    }

    return historyEntry;
  }

  async validateWorkflowIntegrity(stageHistory) {
    if (!Array.isArray(stageHistory) || stageHistory.length === 0) {
      return {
        valid: false,
        violations: ['empty_history'],
        message: 'No workflow history found'
      };
    }

    const violations = [];
    let previousStage = null;

    for (let i = 0; i < stageHistory.length; i++) {
      const currentEntry = stageHistory[i];
      const currentStage = currentEntry.stage;

      if (i === 0) {
        // First stage should be '建立'
        if (currentStage !== '建立') {
          violations.push(`invalid_initial_stage:${currentStage}`);
        }
      } else {
        // Check if transition was valid
        const transitionValid = await this.validateStateTransition({
          fromState: previousStage,
          toState: currentStage,
          userId: currentEntry.performer
        });

        if (!transitionValid.valid) {
          violations.push(`invalid_transition:${previousStage}_to_${currentStage}`);
        }
      }

      previousStage = currentStage;
    }

    return {
      valid: violations.length === 0,
      violations,
      message: violations.length === 0 ? 'Workflow integrity validated' : 'Workflow violations detected'
    };
  }

  async getWorkflowStatistics() {
    // Mock workflow statistics for testing
    return {
      totalCases: 150,
      stageDistribution: {
        '建立': 25,
        '派遣': 35,
        '執行中': 60,
        '暫停': 10,
        '結案': 20
      },
      averageProcessingTime: {
        '建立_to_派遣': 2.5, // hours
        '派遣_to_執行中': 1.2,
        '執行中_to_結案': 8.5,
        total: 12.2
      },
      successRate: 0.92
    };
  }
}

module.exports = { CaseFlowWorkflowService };