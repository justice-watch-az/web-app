const axios = require('axios');

async function testScheduler() {
  const API_URL = 'http://localhost:3001';
  
  try {
    // Test health endpoint
    console.log('Testing health endpoint...');
    const health = await axios.get(`${API_URL}/api/cron/health`);
    console.log('Health Status:', JSON.stringify(health.data, null, 2));
    
    // Test schedules endpoint
    console.log('\nTesting schedules endpoint...');
    const schedules = await axios.get(`${API_URL}/api/cron/schedules`);
    console.log('Active Schedules:', schedules.data.schedules.length);
    
    schedules.data.schedules.forEach(schedule => {
      console.log(`- ${schedule.name}: ${schedule.enabled ? 'ENABLED' : 'DISABLED'} (${schedule.cron_expression})`);
    });
    
    console.log('\n✅ Scheduler API is working properly!');
    console.log(`\n📍 Access the admin UI at: http://localhost:5173/scheduler`);
    
  } catch (error) {
    console.error('❌ Error testing scheduler:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testScheduler();