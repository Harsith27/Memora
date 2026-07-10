const http = require('http');

const API_BASE = 'http://localhost:3001/api';

// Helper function to make HTTP requests
function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      method: method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            statusText: res.statusText,
            data: jsonData
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            statusText: res.statusText,
            data: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

async function testReviewEndpoint() {
  try {
    console.log('🧪 Testing Memora Review Endpoint...\n');

    // Step 1: Login with test user
    console.log('📝 Step 1: Logging in...');
    const loginResponse = await makeRequest('POST', '/auth/login', {
      email: 'veeracharan99@gmail.com',
      password: 'StrongPassword123!' // Use actual password from your test user
    });

    if (loginResponse.status !== 200) {
      console.error('❌ Login failed:', loginResponse.data);
      // Try with a different password or check your actual test user password
      console.log('\n⚠️  Note: You may need to update the test password in this script');
      return;
    }

    const token = loginResponse.data.tokens.accessToken;
    const userId = loginResponse.data.user._id;
    console.log('✅ Login successful. Token:', token.substring(0, 20) + '...');

    // Step 2: Get topics
    console.log('\n📚 Step 2: Fetching topics...');
    const topicsResponse = await makeRequest('GET', '/topics', null, token);
    const topics = topicsResponse.data.topics;
    
    if (topics.length === 0) {
      console.error('❌ No topics found');
      return;
    }

    const testTopic = topics[0];
    console.log(`✅ Found ${topics.length} topics. Testing with: "${testTopic.title}"`);
    console.log(`   Topic ID: ${testTopic._id}`);

    // Step 3: Test review endpoint
    console.log('\n🎯 Step 3: Calling review endpoint...');
    const reviewResponse = await makeRequest(
      'POST',
      `/topics/${testTopic._id}/review`,
      {
        quality: 3,
        responseTime: 0
      },
      token
    );

    console.log(`Response Status: ${reviewResponse.status}`);
    console.log('Response Data:', JSON.stringify(reviewResponse.data, null, 2));

    if (reviewResponse.status === 200) {
      console.log('\n✅ Review endpoint working correctly!');
      if (reviewResponse.data.success) {
        console.log('✅ Review recorded successfully');
        console.log(`   Next Review Date: ${reviewResponse.data.topic.nextReviewDate}`);
        console.log(`   Interval: ${reviewResponse.data.topic.interval} days`);
      }
    } else {
      console.log('\n❌ Review endpoint returned error');
      console.log(`   Status: ${reviewResponse.status}`);
      console.log(`   Message: ${reviewResponse.data.message}`);
      if (reviewResponse.data.error) {
        console.log(`   Error Details: ${reviewResponse.data.error}`);
      }
    }

  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

// Run the test
testReviewEndpoint();
