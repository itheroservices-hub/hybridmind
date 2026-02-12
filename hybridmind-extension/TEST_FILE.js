"use strict";
// Test file for agentic extension
// This file has intentional errors for testing
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSum = calculateSum;
exports.processArray = processArray;
exports.divideNumbers = divideNumbers;
function calculateSum(a, b) {
    return a + b;
} // ❌ Missing semicolon
const result = calculateSum(5, "10"); // ❌ Type mismatch
// Unoptimized code for testing optimization
function processArray(arr) {
    let results = [];
    for (let i = 0; i < arr.length; i++) {
        results.push(arr[i] * 2);
    }
    return results;
}
// Function that needs error handling
function divideNumbers(x, y) {
    return x / y; // ❌ No check for division by zero
}
//# sourceMappingURL=TEST_FILE.js.map