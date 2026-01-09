const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

module.exports = async function callOpenAI(prompt, code) {
  const fullPrompt = `${prompt}\n\nCode:\n${code}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4", // Use "gpt-4" or "gpt-4-turbo" until GPT‑5.1 is exposed
    messages: [{ role: "user", content: fullPrompt }],
    temperature: 0.7,
  });

  return response.choices[0].message.content;
};