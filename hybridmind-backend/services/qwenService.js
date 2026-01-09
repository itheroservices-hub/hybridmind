const axios = require("axios");

module.exports = async function callQwen(prompt, code) {
  const fullPrompt = `${prompt}\n\nCode:\n${code}`;

  try {
    const response = await axios.post(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation",
      {
        model: "qwen-max",
        input: { prompt: fullPrompt }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.QWEN_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data.output.text;
  } catch (err) {
    console.error("Qwen API Error:", err.response?.data || err.message);
    throw new Error("Qwen request failed");
  }
};