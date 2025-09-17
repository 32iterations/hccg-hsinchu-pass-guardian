/**
 * Safety Guardian Services Usage Example
 * Demonstrates how to use all services together in a typical workflow
 */

const SafetyGuardianServices = require('../services/safety');

// Example configuration
const config = {
  enableEventStream: true,
  enableGeofencing: true,
  enableMatching: true,
  enableCaseManagement: true,
  enableMyData: true
};

async function demonstrateServiceUsage() {
  const services = new SafetyGuardianServices(config);

  try {
    // Initialize all services
    console.log('🚀 Initializing Safety Guardian Services...');
    await services.initialize();
    console.log('✅ All services initialized successfully');

    // Get individual service instances
    const eventStream = services.getService('eventStream');
    const geofence = services.getService('geofence');
    const matching = services.getService('matching');
    const caseManagement = services.getService('caseManagement');
    const myData = services.getService('myData');

    // Example 1: Create a geofence for a user
    console.log('\n📍 Creating geofence...');
    const safeZone = await geofence.createGeofence({
      userId: 'user_123',
      name: 'Home Safe Zone',
      center: { lat: 24.8138, lng: 120.9675 },
      radius: 500,
      type: 'safe_zone',
      settings: {
        alertOnEntry: true,
        alertOnExit: true,
        enabled: true
      }
    });
    console.log('✅ Geofence created:', safeZone.id);

    // Example 2: Register a volunteer
    console.log('\n👥 Registering volunteer...');
    const volunteer = await matching.registerVolunteer({
      userId: 'volunteer_456',
      location: { lat: 24.8150, lng: 120.9680, timestamp: new Date().toISOString() },
      preferences: {
        maxDistance: 3000,
        caseTypes: ['missing_person'],
        timeAvailability: ['morning', 'evening']
      },
      capabilities: {
        hasVehicle: true,
        canProvideTransport: true,
        hasFirstAid: true,
        languages: ['zh-TW', 'en']
      }
    });
    console.log('✅ Volunteer registered:', volunteer.userId);

    // Example 3: Create a missing person case
    console.log('\n🚨 Creating missing person case...');
    const missingPersonCase = await caseManagement.createCase({
      reporterId: 'family_789',
      missingPerson: {
        name: '張小明',
        age: 75,
        gender: 'male',
        description: '身高約170公分，穿著藍色外套',
        medicalConditions: ['dementia', 'diabetes'],
        clothing: '藍色外套、黑色褲子、白色運動鞋',
        distinguishingFeatures: ['左手有疤痕']
      },
      lastKnownLocation: {
        lat: 24.8140,
        lng: 120.9670,
        address: '新竹市東區光復路一段',
        timestamp: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      },
      circumstances: {
        timeOfDisappearance: new Date(Date.now() - 3600000).toISOString(),
        lastSeenWith: '獨自一人',
        behaviorBeforeDisappearance: '顯得困惑和焦慮',
        possibleDestinations: ['公園', '市場', '醫院'],
        transportationMethod: 'walking'
      },
      priority: 'high'
    });
    console.log('✅ Case created:', missingPersonCase.caseId);

    // Example 4: Update user location and check geofence violations
    console.log('\n📱 Updating user location...');
    const geofenceEvents = await geofence.updateUserLocation('user_123', {
      lat: 24.8200, // Outside the safe zone
      lng: 120.9700,
      timestamp: new Date().toISOString(),
      accuracy: 10
    });
    console.log('📋 Geofence events:', geofenceEvents.map(e => e.type));

    // Example 5: Find volunteer matches for the case
    console.log('\n🔍 Finding volunteer matches...');
    const matches = await matching.findMatchesForCase(missingPersonCase.caseId);
    console.log(`✅ Found ${matches.length} potential volunteer matches`);

    // Example 6: Assign volunteer to case
    if (matches.length > 0) {
      console.log('\n📋 Assigning volunteer to case...');
      const assignment = await matching.assignVolunteer(
        missingPersonCase.caseId,
        volunteer.userId,
        {
          role: 'searcher',
          priority: 'high'
        }
      );
      console.log('✅ Volunteer assigned:', assignment.matchId);

      // Simulate volunteer accepting assignment
      console.log('\n✅ Volunteer accepting assignment...');
      const acceptedAssignment = await matching.respondToAssignment(
        assignment.matchId,
        true
      );
      console.log('✅ Assignment accepted:', acceptedAssignment.status);
    }

    // Example 7: Create MyData request for emergency data access
    console.log('\n🔐 Creating MyData request...');
    const dataRequest = await myData.createDataRequest({
      userId: 'family_789',
      targetUserId: 'user_123',
      dataTypes: ['basic_profile', 'emergency_contacts', 'last_known_location'],
      purpose: 'Emergency - Missing person case',
      emergency: {
        type: 'missing_person',
        severity: 'high',
        caseId: missingPersonCase.caseId,
        timeElapsed: 3600000
      }
    });
    console.log('✅ MyData request created:', dataRequest.requestId);

    // Example 8: Add timeline entry to case
    console.log('\n📝 Adding timeline entry...');
    await caseManagement.addTimelineEntry(
      missingPersonCase.caseId,
      {
        type: 'volunteer_assigned',
        description: '志工已指派協助搜尋',
        data: {
          volunteerCount: 1,
          searchArea: 'East District'
        }
      },
      'system'
    );
    console.log('✅ Timeline entry added');

    // Example 9: Add a lead to the case
    console.log('\n🔍 Adding lead to case...');
    await caseManagement.addLead(
      missingPersonCase.caseId,
      {
        type: 'sighting',
        description: '有民眾在公園看到類似人員',
        location: { lat: 24.8160, lng: 120.9650 },
        timestamp: new Date().toISOString(),
        priority: 'medium',
        credibility: 'verified'
      },
      'citizen_reporter'
    );
    console.log('✅ Lead added to case');

    // Example 10: Get service statistics
    console.log('\n📊 Service Statistics:');
    const stats = services.getStats();
    console.log('Overall stats:', {
      uptime: Math.round(stats.uptime),
      memoryUsage: Math.round(stats.memoryUsage.heapUsed / 1024 / 1024) + 'MB'
    });

    Object.entries(stats.services).forEach(([serviceName, serviceStats]) => {
      console.log(`${serviceName}:`, serviceStats);
    });

    // Example 11: Get health status
    console.log('\n🏥 Health Status:');
    const health = services.getHealthStatus();
    console.log('Overall health:', health.overall);

    // Example 12: Demonstrate event streaming
    console.log('\n🌊 Event Stream Example:');
    if (eventStream) {
      // Broadcast a test event
      const sentCount = eventStream.broadcastToChannel('system_alerts', {
        type: 'test_notification',
        message: 'System is working properly',
        timestamp: new Date().toISOString()
      });
      console.log(`✅ Event broadcasted to ${sentCount} clients`);

      // Get connection stats
      const eventStats = eventStream.getStats();
      console.log('Event stream stats:', eventStats);
    }

    console.log('\n🎉 Service demonstration completed successfully!');

  } catch (error) {
    console.error('❌ Error during demonstration:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Shutting down services...');
    await services.shutdown();
    console.log('✅ All services shut down gracefully');
  }
}

// Run the demonstration
if (require.main === module) {
  demonstrateServiceUsage().catch(console.error);
}

module.exports = { demonstrateServiceUsage };