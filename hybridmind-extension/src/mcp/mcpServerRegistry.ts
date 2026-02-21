import * as vscode from 'vscode';

const MCP_PROVIDER_ID = 'hybridmind.mcpRegistry';

export function registerHybridMindMcpProviders(
  context: vscode.ExtensionContext,
  backendPort: number
): void {
  const lmApi = (vscode as any).lm;

  if (!lmApi || typeof lmApi.registerMcpServerDefinitionProvider !== 'function') {
    console.log('HybridMind MCP provider skipped: vscode.lm MCP API unavailable in current VS Code build');
    return;
  }

  const changeEmitter = new vscode.EventEmitter<void>();
  context.subscriptions.push(changeEmitter);

  const provider: any = {
    onDidChangeMcpServerDefinitions: changeEmitter.event,

    provideMcpServerDefinitions: async () => {
      return buildServerDefinitions(backendPort);
    },

    resolveMcpServerDefinition: async (server: any) => {
      const config = vscode.workspace.getConfiguration('hybridmind');
      const openrouterApiKey = config.get<string>('openrouterApiKey') || '';

      if (server && server.headers && openrouterApiKey) {
        server.headers = {
          ...server.headers,
          'x-hybridmind-openrouter-key-present': 'true'
        };
      }

      return server;
    }
  };

  const disposable = lmApi.registerMcpServerDefinitionProvider(MCP_PROVIDER_ID, provider);
  context.subscriptions.push(disposable);
  console.log(`HybridMind MCP provider registered (${MCP_PROVIDER_ID})`);
}

function buildServerDefinitions(backendPort: number): any[] {
  const vscodeAny = vscode as any;
  const HttpDefinition = vscodeAny.McpHttpServerDefinition;

  const serverBase = `http://127.0.0.1:${backendPort}`;

  const definitions = [
    {
      label: 'HybridMind Filesystem MCP',
      uri: `${serverBase}/mcp/filesystem`,
      headers: {
        'x-hybridmind-source': 'vscode-extension',
        'x-hybridmind-capability': 'filesystem'
      },
      version: '1.8.0'
    },
    {
      label: 'HybridMind Terminal MCP',
      uri: `${serverBase}/mcp/terminal`,
      headers: {
        'x-hybridmind-source': 'vscode-extension',
        'x-hybridmind-capability': 'terminal'
      },
      version: '1.8.0'
    },
    {
      label: 'HybridMind Web Search MCP',
      uri: `${serverBase}/mcp/web-search`,
      headers: {
        'x-hybridmind-source': 'vscode-extension',
        'x-hybridmind-capability': 'web-search'
      },
      version: '1.8.0'
    },
    {
      label: 'HybridMind Graphiti Memory MCP',
      uri: `${serverBase}/mcp/graphiti-memory`,
      headers: {
        'x-hybridmind-source': 'vscode-extension',
        'x-hybridmind-capability': 'graphiti-memory'
      },
      version: '1.8.0'
    }
  ];

  if (typeof HttpDefinition === 'function') {
    return definitions.map(def => new HttpDefinition(def));
  }

  return definitions;
}
