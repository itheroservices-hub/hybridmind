/**
 * Draft Command Router
 * Minimal command handlers used by toolExecutor for draft tool calls.
 */

const fs = require('fs');
const path = require('path');

function resolveWorkspacePath(workspacePath) {
  return workspacePath && typeof workspacePath === 'string'
    ? workspacePath
    : process.cwd();
}

class DraftCommandRouter {
  async execute(commandName, parameters = {}) {
    const workspacePath = resolveWorkspacePath(parameters.workspacePath);
    const draftPath = path.join(workspacePath, 'draft');

    switch (commandName) {
      case 'draftInit': {
        const exists = fs.existsSync(draftPath);
        return {
          success: true,
          command: commandName,
          workspacePath,
          draftExists: exists,
          message: exists
            ? 'Draft already initialized.'
            : 'Draft not initialized in workspace.'
        };
      }

      case 'draftStatus': {
        const tracksPath = path.join(draftPath, 'tracks');
        const hasDraft = fs.existsSync(draftPath);
        const hasTracksDir = fs.existsSync(tracksPath);
        const trackCount = hasTracksDir
          ? fs.readdirSync(tracksPath, { withFileTypes: true }).filter(d => d.isDirectory()).length
          : 0;

        return {
          success: true,
          command: commandName,
          workspacePath,
          hasDraft,
          hasTracksDir,
          trackCount
        };
      }

      case 'draftNewTrack': {
        const title = String(parameters.title || 'New Track').trim();
        const trackId = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'new-track';
        return {
          success: true,
          command: commandName,
          workspacePath,
          trackId,
          message: 'Track planning command routed. Use workspace Draft workflow to create files.'
        };
      }

      default:
        return {
          success: false,
          error: `Unsupported draft command: ${commandName}`
        };
    }
  }
}

module.exports = new DraftCommandRouter();
