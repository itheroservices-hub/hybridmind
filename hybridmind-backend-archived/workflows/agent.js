const runService = require("../services/runService");

module.exports = async function agenticWorkflow(goal, code) {
  // Step 1: Ask GPT‑5.1 to create a plan
  const plan = await runService(["gpt-5.1"], "Break this task into steps:", goal);

  // Step 2: Parse steps (MVP: split by newline)
  const steps = plan.split("\n").filter(s => s.trim().length > 0);

  let currentOutput = code;

  // Step 3: Execute each step using the best model
  for (const step of steps) {
    const model = chooseModelForStep(step);
    currentOutput = await runService([model], step, currentOutput);
  }

  // Step 4: Final refinement by Claude
  const finalOutput = await runService(["claude"], "Refine and finalize:", currentOutput);

  return finalOutput;
};

// Simple heuristic for now
function chooseModelForStep(step) {
  if (step.toLowerCase().includes("refactor")) return "gpt-5.1";
  if (step.toLowerCase().includes("explain")) return "claude";
  return "qwen";
}