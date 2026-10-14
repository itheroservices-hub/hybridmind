/**
 * Agent Client - Communicates with HybridMind backend for agentic workflows
 * Handles strict JSON tool call requests and responses
 */

import { localServerHeaders, localServerUrl } from '../localServer';
import axios, { AxiosError } from 'axios';

export interface Position {
  line: number;
  character: number;
}

export interface ToolCall {
  tool: string;
  file?: string;
  path?: string;
  start?: Position;
  end?: Position;
  position?: Position;
  text?: string;
  content?: string;
  question?: string;
  actions?: ToolCall[];
}

export interface AgenticResponse {
  success: boolean;
  data?: {
    toolCall: ToolCall;
    steps: Array<{
      model: string;
      provider: string;
      attempt: number;
      aiResponse: string;
      usage: { total_tokens: number };
      cost: number;
    }>;
  };
  error?: string;
}

export interface AgenticOptions {
  prompt: string;
  context?: string;
  model?: string;
  provider?: string;
}

class AgentClient {
  /**
   * Execute an agentic workflow with strict JSON tool calls
   */
  async executeWorkflow(options: AgenticOptions): Promise<ToolCall> {
    const {
      prompt,
      context = '',
      model = 'gpt-4-turbo-preview',
      provider = 'openai'
    } = options;

    try {
      const response = await axios.post<AgenticResponse>(
        localServerUrl('/agent/execute'),
        {
          prompt,
          context,
          model,
          provider
        },
        {
          headers: localServerHeaders(),
          timeout: 60000 // 60 second timeout for complex workflows
        }
      );

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Unknown error from backend');
      }

      return response.data.data.toolCall;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<AgenticResponse>;
        if (axiosError.response?.data?.error) {
          throw new Error(`Backend error: ${axiosError.response.data.error}`);
        }
        if (axiosError.code === 'ECONNREFUSED') {
          throw new Error('Cannot connect to the HybridMind local server. Reload the window and try again.');
        }
        throw new Error(`Network error: ${axiosError.message}`);
      }
      throw error;
    }
  }

  /**
   * Test connection to backend
   */
  async testConnection(): Promise<boolean> {
    try {
      await axios.get(localServerUrl('/health'), { headers: localServerHeaders(), timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get available models from backend
   */
  async getAvailableModels(): Promise<any[]> {
    try {
      const response = await axios.get(localServerUrl('/models'), { headers: localServerHeaders() });
      return response.data.models || [];
    } catch {
      return [];
    }
  }
}

// Singleton instance
export const agentClient = new AgentClient();
