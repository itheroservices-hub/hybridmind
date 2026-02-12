/**
 * Test to see exact response structure
 */
const axios = require('axios');

async function test() {
  try {
    console.log('Testing single model response structure...\n');
    
    const response = await axios.post('http://localhost:3000/run/single', {
      model: 'llama-3.3-70b',
      prompt: 'Say hello',
      code: 'function test() { return 1; }'
    });

    console.log('FULL RESPONSE:');
    console.log(JSON.stringify(response.data, null, 2));
    
    console.log('\n\nACCESS PATHS:');
    console.log('response.data:', typeof response.data);
    console.log('response.data.data:', typeof response.data?.data);
    console.log('response.data.data.output:', typeof response.data?.data?.output);
    console.log('response.data.data.content:', typeof response.data?.data?.content);
    console.log('response.data.meta:', typeof response.data?.meta);
    console.log('response.data.meta.usage:', typeof response.data?.meta?.usage);

  } catch (error) {
    console.error('ERROR:', error.response?.data || error.message);
  }
}

test();
