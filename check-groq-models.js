require('dotenv').config();
const fetch = require('node-fetch');

async function checkGroqModels() {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      }
    });

    const data = await response.json();
    
    console.log('\n🔍 All Available Groq Models:\n');
    data.data.forEach(model => {
      console.log(`- ${model.id} (${model.active ? 'ACTIVE' : 'INACTIVE'})`);
    });

    console.log('\n🎯 Mixtral/Mistral Models:\n');
    const mixtralModels = data.data.filter(m => 
      m.id.includes('mixtral') || m.id.includes('mistral')
    );
    mixtralModels.forEach(model => {
      console.log(`- ${model.id} (${model.active ? '✅ ACTIVE' : '❌ INACTIVE'})`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkGroqModels();
