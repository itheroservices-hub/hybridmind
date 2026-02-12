/**
 * Workflow preset definitions
 * Each workflow defines a series of steps with model assignments
 */

const workflowPresets = {
  'code-review': {
    name: 'Code Review',
    description: 'Comprehensive code review with suggestions',
    steps: [
      {
        name: 'analyze-structure',
        prompt: 'Analyze the code structure, patterns, and architecture. Identify potential issues.',
        model: 'gpt-4',
        requiresInput: true
      },
      {
        name: 'check-best-practices',
        prompt: 'Review the code against best practices, coding standards, and security concerns.',
        model: 'claude-3-opus',
        requiresInput: true
      },
      {
        name: 'suggest-improvements',
        prompt: 'Based on the analysis, provide specific, actionable improvement suggestions with examples.',
        model: 'claude-3-opus',
        requiresInput: false
      }
    ],
    outputFormat: 'detailed'
  },

  'refactor': {
    name: 'Intelligent Refactor',
    description: 'Multi-step refactoring with planning and execution',
    steps: [
      {
        name: 'plan-refactoring',
        prompt: 'Analyze the code and create a step-by-step refactoring plan. Focus on: 1) Code structure improvements, 2) Performance optimizations, 3) Readability enhancements, 4) Design pattern applications.',
        model: 'gpt-4',
        requiresInput: true
      },
      {
        name: 'execute-refactoring',
        prompt: 'Execute the refactoring plan step by step. Provide the refactored code with inline comments explaining major changes.',
        model: 'claude-3-sonnet',
        requiresInput: false
      },
      {
        name: 'verify-refactoring',
        prompt: 'Review the refactored code to ensure: 1) Functionality is preserved, 2) Improvements are beneficial, 3) No new bugs introduced. Provide final polished version.',
        model: 'gpt-4',
        requiresInput: false
      }
    ],
    outputFormat: 'code'
  },

  'explain': {
    name: 'Code Explanation',
    description: 'Deep explanation of code functionality',
    steps: [
      {
        name: 'overview',
        prompt: 'Provide a high-level overview of what this code does, its purpose, and main components.',
        model: 'claude-3-sonnet',
        requiresInput: true
      },
      {
        name: 'detailed-breakdown',
        prompt: 'Provide a detailed line-by-line or section-by-section breakdown of the code logic.',
        model: 'claude-3-sonnet',
        requiresInput: true
      },
      {
        name: 'concepts-and-patterns',
        prompt: 'Explain the programming concepts, design patterns, and algorithms used in this code.',
        model: 'gpt-4',
        requiresInput: false
      }
    ],
    outputFormat: 'markdown'
  },

  'optimize': {
    name: 'Performance Optimization',
    description: 'Analyze and optimize code performance',
    steps: [
      {
        name: 'identify-bottlenecks',
        prompt: 'Analyze the code for performance bottlenecks, inefficiencies, and optimization opportunities. Consider time complexity, space complexity, and resource usage.',
        model: 'gpt-4-turbo',
        requiresInput: true
      },
      {
        name: 'propose-optimizations',
        prompt: 'Propose specific optimization strategies with code examples. Prioritize by impact and implementation difficulty.',
        model: 'claude-3-opus',
        requiresInput: false
      },
      {
        name: 'implement-optimizations',
        prompt: 'Implement the highest-priority optimizations while maintaining code readability and correctness.',
        model: 'gpt-4',
        requiresInput: false
      }
    ],
    outputFormat: 'code'
  },

  'debug': {
    name: 'Debugging Assistant',
    description: 'Identify and fix bugs',
    steps: [
      {
        name: 'identify-issues',
        prompt: 'Analyze the code to identify potential bugs, errors, edge cases, and problematic patterns.',
        model: 'gpt-4',
        requiresInput: true
      },
      {
        name: 'propose-fixes',
        prompt: 'For each identified issue, propose a fix with explanation of why the bug occurs and how the fix resolves it.',
        model: 'claude-3-opus',
        requiresInput: false
      },
      {
        name: 'implement-fixes',
        prompt: 'Implement all fixes and provide the corrected code with comments highlighting the changes.',
        model: 'gpt-4',
        requiresInput: false
      }
    ],
    outputFormat: 'code'
  },

  'document': {
    name: 'Documentation Generator',
    description: 'Generate comprehensive documentation',
    steps: [
      {
        name: 'generate-docstrings',
        prompt: 'Add comprehensive docstrings/JSDoc comments to all functions, classes, and complex code blocks.',
        model: 'claude-3-sonnet',
        requiresInput: true
      },
      {
        name: 'generate-readme',
        prompt: 'Create a README.md section explaining this code: purpose, usage, parameters, return values, and examples.',
        model: 'claude-3-sonnet',
        requiresInput: false
      },
      {
        name: 'generate-examples',
        prompt: 'Generate practical usage examples and common use cases for this code.',
        model: 'gpt-4',
        requiresInput: false
      }
    ],
    outputFormat: 'markdown'
  },

  'test': {
    name: 'Test Generation',
    description: 'Generate unit and integration tests',
    steps: [
      {
        name: 'analyze-test-cases',
        prompt: 'Analyze the code and identify all test cases needed: happy paths, edge cases, error conditions, and boundary conditions.',
        model: 'gpt-4',
        requiresInput: true
      },
      {
        name: 'generate-unit-tests',
        prompt: 'Generate comprehensive unit tests covering all identified test cases. Use appropriate testing framework and best practices.',
        model: 'gpt-4',
        requiresInput: false
      },
      {
        name: 'add-test-documentation',
        prompt: 'Add clear descriptions to each test explaining what it tests and why it matters.',
        model: 'claude-3-sonnet',
        requiresInput: false
      }
    ],
    outputFormat: 'code'
  },

  'security-audit': {
    name: 'Security Audit',
    description: 'Comprehensive security analysis',
    steps: [
      {
        name: 'identify-vulnerabilities',
        prompt: 'Scan the code for security vulnerabilities: SQL injection, XSS, authentication issues, data exposure, etc.',
        model: 'gpt-4',
        requiresInput: true
      },
      {
        name: 'assess-risk',
        prompt: 'Assess the severity and risk level of each identified vulnerability. Prioritize by CVSS score or similar metric.',
        model: 'claude-3-opus',
        requiresInput: false
      },
      {
        name: 'recommend-fixes',
        prompt: 'Provide specific fixes for each vulnerability with secure code examples and best practices.',
        model: 'gpt-4',
        requiresInput: false
      }
    ],
    outputFormat: 'detailed'
  }
};

module.exports = workflowPresets;
