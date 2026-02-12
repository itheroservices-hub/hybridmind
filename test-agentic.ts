// Test file for HybridMind Agentic Extension
// Place this in your workspace to test the agentic features

// ❌ ERROR: Missing type annotations
function calculateSum(a, b) {
  return a + b;
}

// ❌ ERROR: Type mismatch
const result = calculateSum(5, "10");

// Unoptimized code - can be improved
function processArray(arr) {
  let results = [];
  for (let i = 0; i < arr.length; i++) {
    results.push(arr[i] * 2);
  }
  return results;
}

// ❌ ERROR: No error handling
function divideNumbers(x, y) {
  return x / y;
}

export { calculateSum, processArray, divideNumbers };
