/**
 * Code Generator Tool - Generate code in various programming languages
 */

const logger = require('../../utils/logger');
const modelProxy = require('../modelProxy');

class CodeGeneratorTool {
  constructor() {
    this.templates = {
      function: this._functionTemplate,
      class: this._classTemplate,
      api_endpoint: this._apiEndpointTemplate,
      react_component: this._reactComponentTemplate,
      test: this._testTemplate,
      cli: this._cliTemplate
    };

    this.styleGuides = {
      javascript: 'https://standardjs.com/',
      typescript: 'https://typescript-eslint.io/',
      python: 'https://peps.python.org/pep-0008/',
      java: 'https://google.github.io/styleguide/javaguide.html'
    };
  }

  /**
   * Execute code generation
   * @param {Object} params
   * @param {string} params.language - Programming language
   * @param {string} params.description - What the code should do
   * @param {string} params.template - Code template
   * @param {string} params.style - Code style
   * @param {boolean} params.includeComments - Include comments
   * @param {boolean} params.includeTests - Generate tests
   * @param {string} params.complexity - Complexity level
   * @param {string} params.context - Additional context
   * @returns {Promise<Object>} Generated code
   */
  async execute({ 
    language, 
    description, 
    template = 'custom',
    style = 'standard',
    includeComments = true,
    includeTests = false,
    complexity = 'moderate',
    context = ''
  }) {
    const startTime = Date.now();

    try {
      logger.info(`Generating ${language} code: ${description.substring(0, 50)}...`);

      // Build prompt using template
      const prompt = this._buildPrompt({
        language,
        description,
        template,
        style,
        includeComments,
        includeTests,
        complexity,
        context
      });

      // Generate code using AI model
      const result = await modelProxy.callModel({
        model: 'gpt-4o-mini', // Cost-efficient for code generation
        prompt,
        temperature: 0.3, // Lower temp for more consistent code
        maxTokens: 2000
      });

      // Extract code from response
      const code = this._extractCode(result.output, language);

      const executionTime = Date.now() - startTime;

      // Generate tests if requested
      let tests = null;
      if (includeTests) {
        tests = await this._generateTests(code, language, description);
      }

      return {
        success: true,
        language,
        code,
        tests,
        description,
        template,
        executionTime,
        tokensUsed: result.usage?.total_tokens || 0,
        metadata: {
          style,
          includeComments,
          complexity
        }
      };

    } catch (error) {
      logger.error(`Code generation failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        language,
        description,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Build generation prompt
   * @private
   */
  _buildPrompt({ language, description, template, style, includeComments, includeTests, complexity, context }) {
    const templateFunc = this.templates[template];
    const basePrompt = templateFunc 
      ? templateFunc(language, description, style, includeComments, complexity)
      : this._customTemplate(language, description, style, includeComments, complexity);

    const contextSection = context ? `\n\nContext/Existing Code:\n${context}\n` : '';

    return `${basePrompt}${contextSection}

Requirements:
- Language: ${language}
- Style: ${style}
- Comments: ${includeComments ? 'Include inline comments' : 'Minimal comments'}
- Complexity: ${complexity}
- Must be production-ready and follow best practices

Provide ONLY the code, wrapped in markdown code blocks.`;
  }

  /**
   * Function template
   * @private
   */
  _functionTemplate(language, description, style, includeComments, complexity) {
    return `Generate a ${complexity} ${language} function that ${description}.

The function should:
- Have clear input/output types
- Include error handling
- Be well-structured and efficient
- Follow ${style} style conventions`;
  }

  /**
   * Class template
   * @private
   */
  _classTemplate(language, description, style, includeComments, complexity) {
    return `Generate a ${complexity} ${language} class that ${description}.

The class should:
- Have proper encapsulation
- Include constructor and methods
- Follow OOP best practices
- Include error handling
- Follow ${style} style conventions`;
  }

  /**
   * API endpoint template
   * @private
   */
  _apiEndpointTemplate(language, description, style, includeComments, complexity) {
    return `Generate a ${complexity} API endpoint in ${language} that ${description}.

The endpoint should:
- Include proper routing
- Have input validation
- Include error handling
- Return appropriate status codes
- Follow REST best practices
- Follow ${style} style conventions`;
  }

  /**
   * React component template
   * @private
   */
  _reactComponentTemplate(language, description, style, includeComments, complexity) {
    return `Generate a ${complexity} React component in ${language} that ${description}.

The component should:
- Be a functional component with hooks
- Include proper prop types
- Have good state management
- Be reusable and maintainable
- Follow React best practices
- Follow ${style} style conventions`;
  }

  /**
   * Test template
   * @private
   */
  _testTemplate(language, description, style, includeComments, complexity) {
    return `Generate ${complexity} unit tests in ${language} that ${description}.

The tests should:
- Cover main functionality
- Include edge cases
- Use appropriate test framework
- Have clear test names
- Follow ${style} style conventions`;
  }

  /**
   * CLI template
   * @private
   */
  _cliTemplate(language, description, style, includeComments, complexity) {
    return `Generate a ${complexity} command-line interface in ${language} that ${description}.

The CLI should:
- Parse command-line arguments
- Include help text
- Handle errors gracefully
- Provide user feedback
- Follow ${style} style conventions`;
  }

  /**
   * Custom template
   * @private
   */
  _customTemplate(language, description, style, includeComments, complexity) {
    return `Generate ${complexity} ${language} code that ${description}.

The code should:
- Be production-ready
- Follow best practices
- Include error handling
- Follow ${style} style conventions`;
  }

  /**
   * Extract code from AI response
   * @private
   */
  _extractCode(response, language) {
    // Try to extract code from markdown blocks
    const codeBlockRegex = new RegExp('```(?:' + language + ')?\\s*([\\s\\S]*?)```', 'i');
    const match = response.match(codeBlockRegex);
    
    if (match) {
      return match[1].trim();
    }

    // If no code block, return entire response
    return response.trim();
  }

  /**
   * Generate tests for code
   * @private
   */
  async _generateTests(code, language, description) {
    const testPrompt = `Generate comprehensive unit tests for this ${language} code:

\`\`\`${language}
${code}
\`\`\`

The tests should:
- Cover main functionality
- Test edge cases
- Include error scenarios
- Use appropriate test framework (Jest for JS/TS, pytest for Python, etc.)

Provide ONLY the test code, wrapped in markdown code blocks.`;

    try {
      const result = await modelProxy.callModel({
        model: 'gpt-4o-mini',
        prompt: testPrompt,
        temperature: 0.3,
        maxTokens: 1500
      });

      return this._extractCode(result.output, language);
    } catch (error) {
      logger.error(`Test generation failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Get supported languages
   * @returns {Array} List of languages
   */
  getSupportedLanguages() {
    return [
      'javascript',
      'typescript', 
      'python',
      'java',
      'go',
      'rust',
      'sql',
      'html',
      'css'
    ];
  }

  /**
   * Get available templates
   * @returns {Array} List of templates
   */
  getTemplates() {
    return Object.keys(this.templates);
  }
}

module.exports = new CodeGeneratorTool();
