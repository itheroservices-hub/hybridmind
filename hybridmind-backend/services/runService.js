const callOpenAI = require("./openaiService");
const callQwen = require("./qwenService");
const callClaude = require("./claudeService");

async function callModel(model, prompt, code) {
  switch (model) {
    case "gpt-5.1":
      return await callOpenAI(prompt, code);
    case "qwen":
      return await callQwen(prompt, code);
    case "claude":
      return await callClaude(prompt, code);
    default:
      throw new Error(`Unsupported model: ${model}`);
  }
}

module.exports = async function runService(models, prompt, code) {
  // If user only selects one model, run normally
  if (!Array.isArray(models) || models.length === 1) {
    return await callModel(models[0], prompt, code);
  }

  // Multi-model chaining
  let currentOutput = code;

  for (const model of models) {
    currentOutput = await callModel(model, prompt, currentOutput);
  }

  return currentOutput;
};