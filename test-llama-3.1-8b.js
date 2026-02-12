require('dotenv').config();
const fetch = require('node-fetch');

async function testModel() {
  try {
    console.log('Testing Llama 3.1 8B Instant on Groq...\n');
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: 'Write a hello world in Python' }],
        max_tokens: 100
      })
    });

    const data = await response.json();
    
    if (data.error) {
      console.error('❌ Error:', data.error.message);
    } else {
      console.log('✅ Model working!');
      console.log('\nResponse:', data.choices[0].message.content);
      console.log('\n📊 Usage:', data.usage);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testModel();
