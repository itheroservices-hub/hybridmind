import * as vscode from 'vscode';

type RealtimeSocket = any;

export interface VoiceGatewayConfig {
  apiKey: string;
  model?: string;
  endpoint?: string;
}

export interface VoiceCommandEvent {
  transcript: string;
  confidence?: number;
  timestamp: string;
}

export class VoiceAgentGateway implements vscode.Disposable {
  private socket: RealtimeSocket | null = null;
  private readonly emitter = new vscode.EventEmitter<VoiceCommandEvent>();
  private readonly config: VoiceGatewayConfig;

  constructor(config: VoiceGatewayConfig) {
    this.config = {
      model: 'gpt-4o-realtime-preview',
      endpoint: 'wss://api.openai.com/v1/realtime',
      ...config
    };
  }

  public get onVoiceCommand(): vscode.Event<VoiceCommandEvent> {
    return this.emitter.event;
  }

  public connect(): void {
    if (this.socket) {
      return;
    }

    const WebSocketCtor = (globalThis as any).WebSocket;
    if (!WebSocketCtor) {
      throw new Error('WebSocket runtime is not available in this extension host');
    }

    const url = `${this.config.endpoint}?model=${encodeURIComponent(this.config.model || '')}`;
    this.socket = new WebSocketCtor(url, {
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    this.socket.onopen = () => {
      this.sendSessionUpdate();
    };

    this.socket.onmessage = (event: { data: string }) => {
      this.handleRealtimeEvent(event.data);
    };

    this.socket.onerror = () => {
      vscode.window.showWarningMessage('HybridMind voice gateway encountered a realtime connection issue.');
    };

    this.socket.onclose = () => {
      this.socket = null;
    };
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  public pushToTalkStart(): void {
    this.sendEvent({ type: 'input_audio_buffer.start' });
  }

  public pushToTalkStop(): void {
    this.sendEvent({ type: 'input_audio_buffer.stop' });
    this.sendEvent({ type: 'response.create' });
  }

  private sendSessionUpdate(): void {
    this.sendEvent({
      type: 'session.update',
      session: {
        instructions: 'You are HybridMind voice agent. Convert spoken requests into concise coding actions.',
        modalities: ['text', 'audio']
      }
    });
  }

  private sendEvent(payload: Record<string, unknown>): void {
    if (!this.socket || this.socket.readyState !== 1) {
      return;
    }

    this.socket.send(JSON.stringify(payload));
  }

  private handleRealtimeEvent(raw: string): void {
    let event: any;
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }

    if (event?.type === 'response.output_text.delta' && typeof event.delta === 'string') {
      this.emitter.fire({
        transcript: event.delta,
        timestamp: new Date().toISOString()
      });
    }
  }

  public dispose(): void {
    this.disconnect();
    this.emitter.dispose();
  }
}
