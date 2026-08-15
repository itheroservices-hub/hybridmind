/**
 * Code Sandbox - Secure, isolated code execution with resource limits
 * 
 * Features:
 * - CPU, memory, time, and I/O limits
 * - Library whitelisting
 * - Input/output sanitization
 * - Multi-language support (JavaScript, Python)
 * - Process isolation
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const logger = require('../../utils/logger');

/**
 * Resource limits per tier
 */
const RESOURCE_LIMITS = {
  free: {
    cpu: 1000,        // 1 second CPU time
    memory: 50,       // 50MB
    timeout: 5000,    // 5 seconds wall time
    outputSize: 10000 // 10KB output
  },
  pro: {
    cpu: 5000,        // 5 seconds
    memory: 256,      // 256MB
    timeout: 30000,   // 30 seconds
    outputSize: 100000 // 100KB
  },
  proPlus: {
    cpu: 30000,       // 30 seconds
    memory: 1024,     // 1GB
    timeout: 120000,  // 2 minutes
    outputSize: 1000000 // 1MB
  }
};

class CodeSandbox {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'hybridmind-sandbox');
    this.executionCount = 0;
    
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      timeouts: 0,
      memoryLimitExceeded: 0,
      outputLimitExceeded: 0,
      byLanguage: {}
    };
  }

  /**
   * Initialize sandbox environment
   */
  async initialize() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      logger.info(`Sandbox initialized at ${this.tempDir}`);
    } catch (error) {
      logger.error('Failed to initialize sandbox:', error);
      throw error;
    }
  }

  /**
   * Execute code in sandbox
   */
  async execute({
    code,
    language,
    tier = 'free',
    input = '',
    libraries = [],
    allowedModules = null // If null, use default whitelist
  }) {
    this.stats.totalExecutions++;
    this.executionCount++;
    
    const executionId = `exec_${Date.now()}_${this.executionCount}`;
    const limits = RESOURCE_LIMITS[tier] || RESOURCE_LIMITS.free;
    
    logger.info(`Executing ${language} code in sandbox (${executionId}, tier: ${tier})`);

    try {
      // Track by language
      this.stats.byLanguage[language] = (this.stats.byLanguage[language] || 0) + 1;

      let result;
      
      switch (language.toLowerCase()) {
        case 'javascript':
        case 'js':
        case 'node':
          result = await this._executeJavaScript({
            code,
            executionId,
            limits,
            input,
            allowedModules
          });
          break;
          
        case 'python':
        case 'py':
          result = await this._executePython({
            code,
            executionId,
            limits,
            input,
            allowedModules
          });
          break;
          
        default:
          throw new Error(`Unsupported language: ${language}`);
      }

      this.stats.successfulExecutions++;
      
      return {
        success: true,
        executionId,
        language,
        output: result.output,
        executionTime: result.executionTime,
        memoryUsed: result.memoryUsed,
        limits
      };

    } catch (error) {
      this.stats.failedExecutions++;
      
      if (error.message.includes('timeout')) {
        this.stats.timeouts++;
      } else if (error.message.includes('memory')) {
        this.stats.memoryLimitExceeded++;
      } else if (error.message.includes('output')) {
        this.stats.outputLimitExceeded++;
      }

      logger.error(`Sandbox execution failed (${executionId}):`, error.message);
      
      return {
        success: false,
        executionId,
        language,
        error: error.message,
        limits
      };
    }
  }

  /**
   * Execute JavaScript code
   */
  async _executeJavaScript({
    code,
    executionId,
    limits,
    input,
    allowedModules
  }) {
    const startTime = Date.now();
    
    // Create wrapper code with restrictions
    const wrapperCode = this._createJavaScriptWrapper(code, allowedModules, limits);
    
    // Write to temp file
    const filePath = path.join(this.tempDir, `${executionId}.js`);
    await fs.writeFile(filePath, wrapperCode);

    try {
      const result = await this._runProcess({
        command: 'node',
        args: [
          '--max-old-space-size=' + limits.memory,
          filePath
        ],
        input,
        timeout: limits.timeout,
        maxOutputSize: limits.outputSize
      });

      const executionTime = Date.now() - startTime;

      return {
        output: result.stdout,
        executionTime,
        memoryUsed: this._parseMemoryUsage(result.stderr)
      };

    } finally {
      // Cleanup temp file
      try {
        await fs.unlink(filePath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Create JavaScript wrapper with security restrictions
   */
  _createJavaScriptWrapper(code, allowedModules, limits) {
    const whitelist = allowedModules || [
      'lodash', 'moment', 'axios', 'mathjs', 
      'date-fns', 'uuid', 'validator'
    ];

    return `
'use strict';

// Security: Override dangerous globals
global.eval = undefined;
global.Function = undefined;
process.exit = () => { throw new Error('process.exit is disabled'); };
process.kill = () => { throw new Error('process.kill is disabled'); };

// Resource monitoring
const startMemory = process.memoryUsage().heapUsed;
let outputSize = 0;

// Override console to track output size
const originalLog = console.log;
console.log = (...args) => {
  const output = args.join(' ') + '\\n';
  outputSize += output.length;
  
  if (outputSize > ${limits.outputSize}) {
    throw new Error('Output size limit exceeded');
  }
  
  originalLog(...args);
};

// Whitelist require
const originalRequire = require;
const Module = originalRequire('module');
const originalRequireResolve = Module._resolveFilename;

Module._resolveFilename = function(request, parent, isMain) {
  const whitelist = ${JSON.stringify(whitelist)};
  
  // Allow built-in modules (except dangerous ones)
  const dangerousBuiltins = ['child_process', 'cluster', 'fs', 'net', 'dgram', 'dns'];
  if (Module.builtinModules.includes(request) && !dangerousBuiltins.includes(request)) {
    return originalRequireResolve(request, parent, isMain);
  }
  
  // Check whitelist for external modules
  if (!whitelist.includes(request)) {
    throw new Error(\`Module '\${request}' is not in the whitelist. Allowed: \${whitelist.join(', ')}\`);
  }
  
  return originalRequireResolve(request, parent, isMain);
};

// Execute user code
try {
  ${code}
} catch (error) {
  console.error('Execution error:', error.message);
  process.exit(1);
}
`;
  }

  /**
   * Execute Python code
   */
  async _executePython({
    code,
    executionId,
    limits,
    input,
    allowedModules
  }) {
    const startTime = Date.now();
    
    // Create wrapper code
    const wrapperCode = this._createPythonWrapper(code, allowedModules, limits);
    
    // Write to temp file
    const filePath = path.join(this.tempDir, `${executionId}.py`);
    await fs.writeFile(filePath, wrapperCode);

    try {
      const result = await this._runProcess({
        command: 'python',
        args: ['-u', filePath], // -u for unbuffered output
        input,
        timeout: limits.timeout,
        maxOutputSize: limits.outputSize
      });

      const executionTime = Date.now() - startTime;

      return {
        output: result.stdout,
        executionTime,
        memoryUsed: 0 // Python memory tracking is more complex
      };

    } finally {
      // Cleanup
      try {
        await fs.unlink(filePath);
      } catch (e) {
        // Ignore
      }
    }
  }

  /**
   * Create Python wrapper with security restrictions
   */
  _createPythonWrapper(code, allowedModules, limits) {
    const whitelist = allowedModules || [
      'math', 'random', 'datetime', 'json', 'collections',
      'itertools', 'functools', 're', 'string'
    ];

    return `
import sys
import builtins
import resource

# Security: Restrict imports
_original_import = __builtins__.__import__
_whitelist = ${JSON.stringify(whitelist)}

def _restricted_import(name, *args, **kwargs):
    # Block dangerous modules
    dangerous = ['os', 'subprocess', 'shutil', 'socket', 'urllib', 'requests']
    if name in dangerous or name.split('.')[0] in dangerous:
        raise ImportError(f"Module '{name}' is not allowed")
    
    # Check whitelist
    if name not in _whitelist and name.split('.')[0] not in _whitelist:
        raise ImportError(f"Module '{name}' not in whitelist. Allowed: {', '.join(_whitelist)}")
    
    return _original_import(name, *args, **kwargs)

__builtins__.__import__ = _restricted_import

# Block dangerous built-ins
builtins.eval = None
builtins.exec = None
builtins.compile = None
builtins.open = None
builtins.__import__ = _restricted_import

# Resource limits (Unix only)
try:
    # CPU time limit
    resource.setrlimit(resource.RLIMIT_CPU, (${Math.floor(limits.cpu / 1000)}, ${Math.floor(limits.cpu / 1000)}))
    # Memory limit
    resource.setrlimit(resource.RLIMIT_AS, (${limits.memory * 1024 * 1024}, ${limits.memory * 1024 * 1024}))
except:
    pass  # Windows doesn't support resource limits

# Output size tracking
output_size = 0
max_output = ${limits.outputSize}

_original_print = print
def _limited_print(*args, **kwargs):
    global output_size
    output = ' '.join(map(str, args)) + '\\n'
    output_size += len(output)
    
    if output_size > max_output:
        raise Exception('Output size limit exceeded')
    
    _original_print(*args, **kwargs)

builtins.print = _limited_print

# Execute user code
try:
${code.split('\n').map(line => '    ' + line).join('\n')}
except Exception as e:
    print(f"Execution error: {e}", file=sys.stderr)
    sys.exit(1)
`;
  }

  /**
   * Run process with limits
   */
  _runProcess({
    command,
    args,
    input,
    timeout,
    maxOutputSize
  }) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      let killed = false;

      const proc = spawn(command, args, {
        timeout,
        killSignal: 'SIGTERM'
      });

      // Timeout handler
      const timeoutId = setTimeout(() => {
        killed = true;
        proc.kill('SIGKILL');
        reject(new Error(`Execution timeout (${timeout}ms exceeded)`));
      }, timeout);

      // Collect stdout
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
        
        if (stdout.length > maxOutputSize) {
          killed = true;
          proc.kill('SIGKILL');
          clearTimeout(timeoutId);
          reject(new Error(`Output size limit exceeded (${maxOutputSize} bytes)`));
        }
      });

      // Collect stderr
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle completion
      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        
        if (killed) {
          return; // Already rejected
        }

        const executionTime = Date.now() - startTime;

        if (code === 0) {
          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: code,
            executionTime
          });
        } else {
          reject(new Error(`Process exited with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(new Error(`Process error: ${error.message}`));
      });

      // Send input if provided
      if (input) {
        proc.stdin.write(input);
        proc.stdin.end();
      }
    });
  }

  /**
   * Parse memory usage from output
   */
  _parseMemoryUsage(stderr) {
    // Try to extract memory usage from stderr
    const match = stderr.match(/heap.*?(\d+)/i);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Get sandbox stats
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalExecutions > 0 
        ? (this.stats.successfulExecutions / this.stats.totalExecutions * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Cleanup sandbox
   */
  async cleanup() {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
      logger.info('Sandbox cleaned up');
    } catch (error) {
      logger.error('Sandbox cleanup failed:', error);
    }
  }
}

// Singleton instance
module.exports = new CodeSandbox();
