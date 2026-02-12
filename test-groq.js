const axios = require('axios');
require('dotenv').config();

async function testGroqDirect() {
  try {
    console.log('Testing Groq API directly...');
    console.log('API Key starts with:', process.env.GROQ_API_KEY?.substring(0, 10));
    
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-70b-versatile',
        messages: [
          { role: 'user', content: 'Say hello in one word' }
        ],
        temperature: 0.7,
        max_tokens: 100
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ SUCCESS!');
    console.log('Response:', response.data.choices[0].message.content);
  } catch (error) {
    console.log('❌ ERROR:');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log(error.message);
    }
  }
}

testGroqDirect();
