// NOTE: Requires `zod` package (`npm install zod`)
const { z } = require('zod');

const MODEL_ALLOWLIST = [
  'anthropic/claude-sonnet-4-5',
  'anthropic/claude-opus-4',
  'anthropic/claude-haiku-4',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'openai/o1',
  'openai/o3-mini',
  'google/gemini-2.0-flash',
  'google/gemini-pro',
  'meta-llama/llama-3.3-70b-instruct',
  'deepseek/deepseek-r1',
  'x-ai/grok-2',
  'mistralai/mistral-large',
  'cohere/command-r-plus'
];

const runSchema = z.object({
  models: z.array(z.enum(MODEL_ALLOWLIST)).min(1).max(5).optional(),
  prompt: z.string().min(1).max(50000),
  code: z.string().max(50000).optional(),
  systemPrompt: z.string().max(10000).optional()
});

const agentSchema = z
  .object({
    goal: z.string().min(1).max(10000).optional(),
    prompt: z.string().min(1).max(10000).optional(),
    tier: z.string().optional(),
    model: z.enum(MODEL_ALLOWLIST).optional()
  })
  .refine((d) => d.goal || d.prompt, {
    message: 'Either goal or prompt is required'
  });

const workflowSchema = z.object({
  workflowId: z.string().min(1).max(100),
  code: z.string().min(1).max(50000)
});

const comparisonSchema = z.object({
  models: z.array(z.enum(MODEL_ALLOWLIST)).min(1).max(10),
  prompt: z.string().min(1).max(50000)
});

const schemaMap = {
  run: runSchema,
  agent: agentSchema,
  workflow: workflowSchema,
  comparison: comparisonSchema
};

/**
 * Validates request body against a named schema.
 * Unknown schema names are ignored intentionally to preserve existing behavior.
 *
 * @param {string} schemaName - Name of schema to validate against.
 * @returns {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => void}
 */
function validateRequest(schemaName) {
  return (req, res, next) => {
    const schema = schemaMap[schemaName];

    if (!schema) {
      return next();
    }

    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.errors
      });
    }

    req.body = parsed.data;
    return next();
  };
}

module.exports = validateRequest;