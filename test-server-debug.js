// Direct test of the model proxy without server
const modelProxy = require('./hybridmind-backend/services/modelProxy');

async function test() {
  console.log('Testing modelProxy directly...\n');
  
  try {
    const result = await modelProxy.call('meta-llama/llama-3.3-70b-instruct', 'Say hello', {
      code: '',
      temperature: 0.7
    });
    
    console.log('✅ Success!');
    console.log('Result:', result);
  } catch (error) {
    console.log('❌ Error:', error.message);
    console.log('Stack:', error.stack);
  }
}

test();
