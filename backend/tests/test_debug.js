const request = require('supertest');
const app = require('./src/backend/src/app');

async function testCaseCreation() {
  const caseData = {
    title: '失智長者走失案件',
    description: '78歲陳老先生在大潤發走失',
    priority: 'high',
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
    }
  };

  try {
    const response = await request(app)
      .post('/api/v1/cases/create')
      .set('Authorization', 'Bearer admin-token')
      .send(caseData);

    console.log('Status:', response.status);
    console.log('Response body keys:', Object.keys(response.body));
    console.log('Data keys:', Object.keys(response.body.data || {}));
    console.log('Has alertConfig:', !!response.body.data?.alertConfig);
    console.log('Has metadata:', !!response.body.data?.metadata);
    console.log('AlertConfig:', response.body.data?.alertConfig);
    console.log('Metadata:', response.body.data?.metadata);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testCaseCreation();
