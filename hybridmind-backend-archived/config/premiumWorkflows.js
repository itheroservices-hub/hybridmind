/**
 * HybridMind v1.1 - Premium Workflow Presets
 * Advanced multi-step workflows for Pro users
 */

module.exports = {
  /**
   * REFACTOR + COMMENT + TEST
   * 3-step workflow: Refactor code → Add comments → Generate tests
   */
  'refactor-comment-test': {
    name: 'Refactor + Comment + Test',
    description: 'Complete code improvement workflow: refactor, document, and test',
    tier: 'pro',
    steps: [
      {
        name: 'Refactor Code',
        model: 'claude-3-5-sonnet', // Best for code quality
        prompt: 'Refactor this code for better readability, performance, and maintainability. Use modern best practices and design patterns. Preserve all functionality.',
        requiresInput: true
      },
      {
        name: 'Add Documentation',
        model: 'gpt-4', // Best for documentation
        prompt: 'Add comprehensive JSDoc/docstring comments to all functions and classes. Include parameter descriptions, return types, and usage examples.',
        requiresInput: false // Uses output from step 1
      },
      {
        name: 'Generate Tests',
        model: 'deepseek-coder', // Fast and good at tests
        prompt: 'Generate comprehensive unit tests for this code. Cover edge cases, error handling, and happy paths. Use the appropriate testing framework (Jest, Mocha, PyTest, etc.).',
        requiresInput: false // Uses output from step 2
      }
    ],
    outputFormat: 'code'
  },

  /**
   * DEBUG + FIX + VERIFY
   * 3-step workflow: Identify bugs → Fix them → Verify solution
   */
  'debug-fix-verify': {
    name: 'Debug + Fix + Verify',
    description: 'Comprehensive debugging workflow: analyze, fix, and verify',
    tier: 'pro',
    steps: [
      {
        name: 'Debug Analysis',
        model: 'gpt-4',
        prompt: 'Analyze this code for bugs, errors, and potential issues. List all problems found with severity levels (critical, major, minor).',
        requiresInput: true
      },
      {
        name: 'Apply Fixes',
        model: 'claude-3-5-sonnet',
        prompt: 'Fix all the issues identified in the previous analysis. Provide the corrected code with inline comments explaining each fix.',
        requiresInput: false
      },
      {
        name: 'Verification',
        model: 'deepseek-coder',
        prompt: 'Verify that all fixes are correct and don\'t introduce new bugs. Generate test cases to prove the fixes work.',
        requiresInput: false
      }
    ],
    outputFormat: 'code'
  },

  /**
   * ARCHITECTURE REVIEW
   * 4-step workflow across multiple models for comprehensive review
   */
  'architecture-review': {
    name: 'Architecture Review',
    description: 'Multi-model architecture analysis: structure, security, performance, scalability',
    tier: 'pro',
    steps: [
      {
        name: 'Structure Analysis',
        model: 'gpt-4',
        prompt: 'Analyze the architecture and design patterns used in this code. Evaluate modularity, separation of concerns, and code organization. Suggest improvements.',
        requiresInput: true
      },
      {
        name: 'Security Audit',
        model: 'claude-3-5-sonnet',
        prompt: 'Perform a security audit. Identify vulnerabilities, unsafe practices, and potential attack vectors. Suggest security improvements.',
        requiresInput: true // Re-analyze original code
      },
      {
        name: 'Performance Review',
        model: 'gemini-1.5-pro',
        prompt: 'Analyze performance bottlenecks, inefficient algorithms, and resource usage. Suggest optimizations for speed and memory.',
        requiresInput: true // Re-analyze original code
      },
      {
        name: 'Scalability Assessment',
        model: 'deepseek-coder',
        prompt: 'Evaluate scalability. Identify potential issues as data/load grows. Suggest architectural changes for better scalability.',
        requiresInput: true // Re-analyze original code
      }
    ],
    outputFormat: 'markdown'
  },

  /**
   * SECURITY AUDIT + FIX
   * 2-step security-focused workflow
   */
  'security-audit-fix': {
    name: 'Security Audit + Fix',
    description: 'Find and fix security vulnerabilities',
    tier: 'pro',
    steps: [
      {
        name: 'Security Scan',
        model: 'claude-3-5-sonnet',
        prompt: 'Perform a comprehensive security audit. Check for: SQL injection, XSS, CSRF, authentication issues, data leaks, insecure dependencies, and OWASP Top 10 vulnerabilities. List all findings with severity.',
        requiresInput: true
      },
      {
        name: 'Security Fixes',
        model: 'gpt-4',
        prompt: 'Fix all security vulnerabilities identified. Use secure coding practices and industry standards. Add security comments explaining each fix.',
        requiresInput: false
      }
    ],
    outputFormat: 'code'
  },

  /**
   * PERFORMANCE OPTIMIZATION
   * 3-step performance improvement workflow
   */
  'performance-optimize': {
    name: 'Performance Optimization',
    description: 'Comprehensive performance improvements',
    tier: 'pro',
    steps: [
      {
        name: 'Performance Profiling',
        model: 'gemini-1.5-pro',
        prompt: 'Profile this code for performance issues. Identify slow operations, inefficient algorithms (O(n²) etc.), memory leaks, and unnecessary computations.',
        requiresInput: true
      },
      {
        name: 'Apply Optimizations',
        model: 'deepseek-coder',
        prompt: 'Optimize the code based on profiling results. Improve algorithm complexity, add caching, use efficient data structures, and eliminate redundant operations.',
        requiresInput: false
      },
      {
        name: 'Benchmark Tests',
        model: 'groq-llama3-70b',
        prompt: 'Generate benchmark tests to measure performance improvements. Compare before/after scenarios.',
        requiresInput: false
      }
    ],
    outputFormat: 'code'
  },

  /**
   * CODE MIGRATION
   * 3-step language/framework migration workflow
   */
  'code-migration': {
    name: 'Code Migration',
    description: 'Migrate code to a different language or framework',
    tier: 'pro',
    steps: [
      {
        name: 'Analyze Original',
        model: 'gpt-4',
        prompt: 'Analyze this code and identify all features, dependencies, and logic that need to be migrated. Create a migration plan.',
        requiresInput: true
      },
      {
        name: 'Translate Code',
        model: 'claude-3-5-sonnet',
        prompt: 'Translate the code to the target language/framework. Preserve all functionality and adapt to target best practices.',
        requiresInput: true
      },
      {
        name: 'Validation & Tests',
        model: 'deepseek-coder',
        prompt: 'Generate tests for the migrated code to ensure functionality matches the original. Include integration tests.',
        requiresInput: false
      }
    ],
    outputFormat: 'code'
  },

  /**
   * API DOCUMENTATION
   * 2-step comprehensive API documentation workflow
   */
  'api-documentation': {
    name: 'API Documentation',
    description: 'Generate complete API documentation',
    tier: 'pro',
    steps: [
      {
        name: 'API Analysis',
        model: 'gpt-4',
        prompt: 'Analyze this API code and extract all endpoints, parameters, responses, and authentication methods. Structure as API specification.',
        requiresInput: true
      },
      {
        name: 'Generate Docs',
        model: 'claude-3-5-sonnet',
        prompt: 'Create comprehensive API documentation in Markdown format. Include: endpoint descriptions, request/response examples, authentication guide, error codes, and usage examples.',
        requiresInput: false
      }
    ],
    outputFormat: 'markdown'
  },

  /**
   * FULL STACK SCAFFOLD
   * 4-step project scaffolding workflow (Advanced)
   */
  'full-stack-scaffold': {
    name: 'Full Stack Scaffold',
    description: 'Generate complete full-stack project structure',
    tier: 'pro',
    steps: [
      {
        name: 'Frontend Component',
        model: 'claude-3-5-sonnet',
        prompt: 'Generate a React/Vue component for this feature. Include state management, event handlers, and responsive design.',
        requiresInput: true
      },
      {
        name: 'Backend API',
        model: 'gpt-4',
        prompt: 'Generate backend API endpoints (Express/FastAPI) for this feature. Include validation, error handling, and database integration.',
        requiresInput: true
      },
      {
        name: 'Database Schema',
        model: 'deepseek-coder',
        prompt: 'Generate database schema (SQL/MongoDB) for this feature. Include indexes, constraints, and migrations.',
        requiresInput: true
      },
      {
        name: 'Integration Tests',
        model: 'groq-llama3-70b',
        prompt: 'Generate end-to-end tests covering frontend-backend-database integration for this feature.',
        requiresInput: true
      }
    ],
    outputFormat: 'multi-file'
  },

  /**
   * CODE REVIEW PRO
   * 3-step thorough code review workflow
   */
  'code-review-pro': {
    name: 'Code Review Pro',
    description: 'Comprehensive multi-aspect code review',
    tier: 'pro',
    steps: [
      {
        name: 'Code Quality Review',
        model: 'claude-3-5-sonnet',
        prompt: 'Review code quality: naming conventions, structure, readability, maintainability, and adherence to SOLID principles. Rate 1-10 and suggest improvements.',
        requiresInput: true
      },
      {
        name: 'Logic & Correctness',
        model: 'gpt-4',
        prompt: 'Review code logic and correctness. Check for bugs, edge cases, error handling, and potential runtime issues.',
        requiresInput: true
      },
      {
        name: 'Best Practices',
        model: 'gemini-1.5-pro',
        prompt: 'Review adherence to language-specific best practices, design patterns, and industry standards. Suggest modern alternatives.',
        requiresInput: true
      }
    ],
    outputFormat: 'markdown'
  }
};
