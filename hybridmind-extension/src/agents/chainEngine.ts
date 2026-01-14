/**
 * HybridMind v1.1 - Agentic Chain Engine
 * Executes multi-step autonomous workflows across multiple AI models
 */

import * as vscode from 'vscode';
import { LicenseManager } from '../auth/licenseManager';

export interface ChainStep {
  id: string;
  name: string;
  model: string;
  prompt: string;
  input?: string;
  output?: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  error?: string;
  cost?: number;
  tokens?: number;
  duration?: number;
  timestamp?: Date;
}

export interface AgenticChain {
  id: string;
  name: string;
  description: string;
  steps: ChainStep[];
  context: Map<string, any>;
  currentStepIndex: number;
  totalCost?: number;
  totalTokens?: number;
  totalDuration?: number;
  createdAt: Date;
  completedAt?: Date;
}

export type ChainProgressCallback = (step: ChainStep, chain: AgenticChain) => void;

export class ChainEngine {
  private activeChains: Map<string, AgenticChain> = new Map();
  private serverPort: number;
  private licenseManager: LicenseManager;

  constructor(serverPort: number = 3000) {
    this.serverPort = serverPort;
    this.licenseManager = LicenseManager.getInstance();
  }

  /**
   * Validate chain against tier limits
   */
  async validateChain(chain: AgenticChain): Promise<{ valid: boolean; error?: string }> {
    const uniqueModels = new Set(chain.steps.map(step => step.model));
    const modelLimit = this.licenseManager.getModelLimit();
    
    if (uniqueModels.size > modelLimit) {
      const tier = this.licenseManager.getTier();
      return {
        valid: false,
        error: `Your ${tier} tier allows up to ${modelLimit} models per chain. This chain uses ${uniqueModels.size} models.`
      };
    }

    return { valid: true };
  }

  async executeChain(
    chain: AgenticChain, 
    onProgress?: ChainProgressCallback
  ): Promise<string> {
    // Validate chain against tier limits
    const validation = await this.validateChain(chain);
    if (!validation.valid) {
      const action = await vscode.window.showWarningMessage(
        validation.error!,
        'Upgrade to Pro',
        'Cancel'
      );
      
      if (action === 'Upgrade to Pro') {
        vscode.env.openExternal(vscode.Uri.parse('https://hybridmind.dev/pricing'));
      }
      
      throw new Error(validation.error);
    }

    this.activeChains.set(chain.id, chain);
    const results: string[] = [];
    
    chain.totalCost = 0;
    chain.totalTokens = 0;
    chain.totalDuration = 0;

    try {
      for (let i = 0; i < chain.steps.length; i++) {
        const step = chain.steps[i];
        chain.currentStepIndex = i;
        
        step.status = 'running';
        step.timestamp = new Date();
        
        if (onProgress) {
          onProgress(step, chain);
        }

        try {
          const startTime = Date.now();
          
          // Build input from previous step or initial input
          const input = i === 0 
            ? step.input || chain.context.get('initial_input') || ''
            : this.interpolateContext(step.prompt, chain.context);

          // Execute step
          const result = await this.executeStep(step.model, input);
          
          // Update step with results
          step.output = result.content;
          step.status = 'complete';
          step.tokens = result.tokens || this.estimateTokens(input, result.content);
          step.cost = this.estimateCost(step.model, step.tokens || 0);
          step.duration = Date.now() - startTime;

          // Update chain totals
          chain.totalCost! += step.cost;
          chain.totalTokens! += (step.tokens || 0);
          chain.totalDuration! += step.duration;

          // Store in context for next steps
          chain.context.set(`step_${i}_output`, result.content);
          chain.context.set(`step_${i}_model`, step.model);
          chain.context.set(`step_${i}_tokens`, step.tokens);

          results.push(result.content);

          if (onProgress) {
            onProgress(step, chain);
          }

        } catch (error: any) {
          step.status = 'failed';
          step.error = error.message;
          
          if (onProgress) {
            onProgress(step, chain);
          }

          throw new Error(`Chain "${chain.name}" failed at step ${i + 1} (${step.name}): ${error.message}`);
        }
      }

      chain.completedAt = new Date();
      return results[results.length - 1]; // Return final output

    } finally {
      this.activeChains.delete(chain.id);
    }
  }

  private interpolateContext(prompt: string, context: Map<string, any>): string {
    let result = prompt;
    
    // Replace {{variable}} with context values
    context.forEach((value, key) => {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(pattern, String(value));
    });

    return result;
  }

  private async executeStep(model: string, prompt: string): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60 second timeout for chains

    try {
      const response = await fetch(`http://127.0.0.1:${this.serverPort}/run/single`, {
        method: 'POST',
        headers: this.licenseManager.getApiHeaders(),
        body: JSON.stringify({ model, prompt }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error: ${error}`);
      }

      return await response.json();

    } catch (error: any) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        throw new Error('Step timed out after 60 seconds');
      }
      throw error;
    }
  }

  private estimateTokens(input: string, output: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil((input.length + output.length) / 4);
  }

  private estimateCost(model: string, tokens: number): number {
    // Cost per 1M tokens (approximate as of Jan 2026)
    const pricing: Record<string, number> = {
      'gpt-4-turbo': 10.00,
      'gpt-4o': 5.00,
      'gpt-3.5-turbo': 0.50,
      'claude-3-opus-20240229': 15.00,
      'claude-3-sonnet-20240229': 3.00,
      'claude-3-haiku-20240307': 0.25,
      'gemini-1.5-pro': 7.00,
      'gemini-1.5-flash': 0.35,
      'deepseek-chat': 0.14,
      'deepseek-coder': 0.14,
      'qwen-max': 2.00,
      'qwen-plus': 0.80,
      'llama-3.3-70b': 0.00, // Groq free tier
      'mixtral-8x7b': 0.00
    };

    const pricePerMillion = pricing[model] || 1.00;
    return (tokens / 1000000) * pricePerMillion;
  }

  createChain(name: string, description: string, steps: Omit<ChainStep, 'status'>[]): AgenticChain {
    return {
      id: this.generateChainId(),
      name,
      description,
      steps: steps.map(step => ({ ...step, status: 'pending' })),
      context: new Map(),
      currentStepIndex: 0,
      createdAt: new Date()
    };
  }

  private generateChainId(): string {
    return `chain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getActiveChains(): AgenticChain[] {
    return Array.from(this.activeChains.values());
  }

  getChain(id: string): AgenticChain | undefined {
    return this.activeChains.get(id);
  }

  cancelChain(id: string): boolean {
    const chain = this.activeChains.get(id);
    if (chain) {
      // Mark current step as failed
      if (chain.currentStepIndex < chain.steps.length) {
        chain.steps[chain.currentStepIndex].status = 'failed';
        chain.steps[chain.currentStepIndex].error = 'Cancelled by user';
      }
      this.activeChains.delete(id);
      return true;
    }
    return false;
  }
}
