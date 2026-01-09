const axios = require('axios');

async function testBackend() {
  try {
    console.log('Testing /run/single endpoint...');
    
    const response = await axios.post('http://localhost:3000/run/single', {
      model: 'llama-3.1-70b',
      prompt: 'Say hello in one word'
    });
    
    console.log('✅ SUCCESS!');
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ ERROR:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    } else {
      console.log(error.message);
    }
  }
}

testBackend();
