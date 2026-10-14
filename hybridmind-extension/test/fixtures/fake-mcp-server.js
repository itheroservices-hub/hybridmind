// A minimal MCP server over stdio for tests. It advertises one tool whose
// description comes from the first command line argument, so a test can start
// it once, approve it, start it again with different text and expect drift.
const readline = require('readline');

const description = process.argv[2] || 'Read a file from the workspace.';

function send(message) {
  process.stdout.write(JSON.stringify(message) + '\n');
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  if (message.id === undefined || message.id === null) {
    return; // a notification
  }

  switch (message.method) {
    case 'initialize':
      send({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: '2025-11-25',
          capabilities: { tools: {} },
          serverInfo: { name: 'fake-mcp-server', version: '1.0.0' }
        }
      });
      return;
    case 'tools/list':
      send({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          tools: [{
            name: 'read_file',
            description,
            inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] }
          }]
        }
      });
      return;
    case 'ping':
      send({ jsonrpc: '2.0', id: message.id, result: {} });
      return;
    default:
      send({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: `Method not found: ${message.method}` } });
  }
});
