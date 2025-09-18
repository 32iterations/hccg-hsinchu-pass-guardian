/**
 * Enhanced CaseFlowService for Console RBAC Testing
 * Provides mock case data and methods needed for P4 validation tests
 */

class EnhancedCaseFlowService {
  constructor(dependencies = {}) {
    this.storage = dependencies.storage;
    this.database = dependencies.database;
    this.auditService = dependencies.auditService;
    this.rbacService = dependencies.rbacService;
    this.workflowService = dependencies.workflowService;

    // Mock case data for testing
    this.testCases = new Map([
      ['case123', {
        id: 'case123',
        title: '失智長者走失案件',
        description: '78歲陳老先生在大潤發走失',
        status: 'active',
        priority: 'high',
        createdBy: 'family123',
        assignedTo: 'volunteer456',
        location: {
          lat: 24.8138,
          lng: 120.9675,
          address: '新竹市東區光復路二段101號'
        },
        contactInfo: {
          name: '陳小華',
          phone: '0912345678',
          relationship: '女兒'
        },
        missingPerson: {
          name: '陳老先生',
          age: 78,
          description: '身高約165cm，穿深色衣服',
          lastSeen: '2023-10-15T14:30:00.000Z'
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }],
      ['CASE-2025-001', {
        id: 'CASE-2025-001',
        title: '失智長者走失案件',
        status: 'active',
        priority: 'high',
        sensitivityLevel: 'confidential',
        assignedWorker: 'case-worker-001',
        createdBy: 'case-worker-001',
        familyMember: 'family-member-005',
        personalData: {
          patientName: '王○○',
          age: 78,
          address: '新竹市東區○○路123號',
          medicalHistory: '阿茲海默症第二期',
          emergencyContacts: ['0912-345-678', '0987-654-321']
        },
        locationData: [
          { lat: 24.8067, lng: 120.9687, timestamp: new Date().toISOString() }
        ],
        assignedVolunteers: ['volunteer-001', 'volunteer-002'],
        createdAt: new Date().toISOString(),
        workflow: {
          currentStage: '建立',
          nextStages: ['派遣'],
          stageHistory: [{
            stage: '建立',
            timestamp: new Date().toISOString(),
            performer: 'case-worker-001',
            validationsPassed: true
          }]
        }
      }],
      ['CASE-2025-002', {
        id: 'CASE-2025-002',
        title: '志工協助案件',
        status: 'pending',
        priority: 'medium',
        sensitivityLevel: 'restricted',
        assignedWorker: 'social-worker-002',
        createdBy: 'volunteer-coord-003',
        personalData: {
          patientName: '李○○',
          age: 65,
          address: '新竹市北區○○路456號',
          generalLocation: '新竹市北區',
          medicalHistory: '輕度認知障礙',
          emergencyContacts: ['0912-345-678']
        },
        locationData: [
          { lat: 24.8067, lng: 120.9687, timestamp: new Date().toISOString() }
        ],
        assignedVolunteers: ['volunteer-003'],
        createdAt: new Date().toISOString(),
        workflow: {
          currentStage: '建立',
          nextStages: ['派遣']
        }
      }]
    ]);
  }

  async getCaseById(caseId) {
    const caseData = this.testCases.get(caseId);
    if (!caseData) {
      return null;
    }
    return { ...caseData };
  }

  async createCase(caseData) {
    const caseId = `CASE-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;

    const newCase = {
      id: caseId,
      ...caseData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active', // Changed from 'created' to 'active' to match test expectations
      // Add missing fields expected by tests
      alertConfig: {
        enabled: true,
        radius: 5000,
        notificationTypes: ['sms', 'email'],
        escalationRules: {
          timeThreshold: 60,
          autoEscalate: true
        }
      },
      metadata: {
        createdBy: caseData.createdBy,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0',
        source: 'web_application'
      }
    };

    this.testCases.set(caseId, newCase);

    // Log case creation
    if (this.auditService) {
      await this.auditService.logDataAccess({
        userId: caseData.createdBy,
        action: 'case_creation',
        resourceId: caseId,
        result: 'success',
        timestamp: new Date().toISOString()
      });
    }

    return newCase;
  }

  async searchCases(searchParams) {
    const cases = Array.from(this.testCases.values());

    // Apply basic filtering if needed
    if (searchParams.status) {
      return cases.filter(c => c.status === searchParams.status);
    }

    return cases;
  }

  async validateAssignee(assigneeId, assigneeType) {
    // Mock validation - return true for test assignees
    const validAssignees = [
      'social-worker-002',
      'volunteer-001',
      'volunteer-002',
      'volunteer456',
      'case-worker-001',
      'unavailable-volunteer' // Valid but unavailable for testing 409 response
    ];
    return validAssignees.includes(assigneeId);
  }

  async checkAssigneeAvailability(assigneeId) {
    // Mock availability check - return false for unavailable volunteers to test 409 error
    if (assigneeId === 'unavailable-volunteer') {
      return false;
    }
    return true;
  }

  async assignCase(caseId, assignmentData, assignedBy, context = {}) {
    const existingCase = this.testCases.get(caseId);
    if (!existingCase) {
      throw new Error('Case not found');
    }

    const previousAssignee = existingCase.assignedTo;
    const newAssignee = assignmentData.assigneeId || assignmentData.primaryWorker;

    const updatedCase = {
      ...existingCase,
      assignedTo: newAssignee,
      assignedBy,
      assignedAt: new Date().toISOString(),
      status: 'assigned'
    };

    this.testCases.set(caseId, updatedCase);

    // Log assignment
    if (this.auditService) {
      await this.auditService.logDataAccess({
        userId: assignedBy,
        action: 'case_assignment',
        resourceId: caseId,
        result: 'success',
        timestamp: new Date().toISOString()
      });
    }

    // Return format expected by the test
    return {
      caseId,
      assignedTo: newAssignee,
      assignedBy,
      assignedAt: updatedCase.assignedAt,
      previousAssignee
    };
  }

  async updateCaseStatusAPI(caseId, statusData, updatedBy, context = {}) {
    const existingCase = this.testCases.get(caseId);
    if (!existingCase) {
      throw new Error('Case not found');
    }

    const previousStatus = existingCase.status;
    const updatedCase = {
      ...existingCase,
      status: statusData.status,
      updatedBy,
      updatedAt: new Date().toISOString(),
      updateReason: statusData.updateReason,
      progressNotes: statusData.progressNotes
    };

    this.testCases.set(caseId, updatedCase);

    // Return format expected by the test
    return {
      id: caseId,
      previousStatus,
      newStatus: statusData.status,
      updatedAt: updatedCase.updatedAt,
      updatedBy
    };
  }

  async closeCase(caseId, closureData, closedBy) {
    const existingCase = this.testCases.get(caseId);
    if (!existingCase) {
      throw new Error('Case not found');
    }

    const updatedCase = {
      ...existingCase,
      status: 'closed',
      closedBy,
      closedAt: new Date().toISOString(),
      outcome: closureData.outcome,
      resolution: closureData.resolution,
      closureReason: closureData.closureReason,
      finalLocation: closureData.finalLocation,
      totalDuration: closureData.totalDuration,
      resourcesUsed: closureData.resourcesUsed,
      followUpRequired: closureData.followUpRequired,
      followUpPlan: closureData.followUpPlan,
      lessonsLearned: closureData.lessonsLearned,
      satisfactionScore: closureData.satisfactionScore
    };

    this.testCases.set(caseId, updatedCase);

    return updatedCase;
  }

  async getCaseHistory(caseId) {
    const caseData = this.testCases.get(caseId);
    if (!caseData) {
      return [];
    }

    // Mock case history
    return [
      {
        id: 'hist-001',
        action: 'case_created',
        timestamp: caseData.createdAt,
        performer: caseData.createdBy,
        details: { title: caseData.title }
      },
      {
        id: 'hist-002',
        action: 'status_updated',
        timestamp: new Date().toISOString(),
        performer: caseData.assignedWorker,
        details: { status: caseData.status }
      }
    ];
  }

  async validateStateTransition(options) {
    if (this.workflowService) {
      return await this.workflowService.validateStateTransition(options);
    }

    // Fallback validation
    const { fromState, toState } = options;
    const validTransitions = {
      '建立': ['派遣'],
      '派遣': ['執行中', '暫停'],
      '執行中': ['結案', '暫停'],
      '暫停': ['執行中', '結案'],
      '結案': []
    };

    const allowed = validTransitions[fromState]?.includes(toState) || false;

    return {
      valid: allowed,
      violationType: allowed ? null : 'invalid_transition',
      allowedTransitions: validTransitions[fromState] || []
    };
  }

  async cleanup() {
    this.testCases.clear();
  }
}

module.exports = { EnhancedCaseFlowService };