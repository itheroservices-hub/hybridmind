import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Analyzes workspace to find files and gather context
 */
export class WorkspaceAnalyzer {
  
  /**
   * Extract file references from user message
   * Supports: "review server.js", "analyze config/models.js", "check the README"
   */
  public extractFileReferences(message: string): string[] {
    const filePatterns = [
      // Direct file mentions: "review server.js", "analyze app.ts"
      /(?:review|analyze|check|fix|update|refactor|optimize)\s+(?:the\s+)?([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)/gi,
      // File paths with extensions
      /([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)/g,
      // Common files without extensions
      /(?:the\s+)?(README|Dockerfile|Makefile|package\.json|tsconfig\.json)/gi
    ];

    const files = new Set<string>();
    
    for (const pattern of filePatterns) {
      let match;
      while ((match = pattern.exec(message)) !== null) {
        const file = match[1] || match[0];
        // Clean up the file name
        const cleaned = file.trim().replace(/['"`,]/g, '');
        if (cleaned && !cleaned.includes(' ')) {
          files.add(cleaned);
        }
      }
    }

    return Array.from(files);
  }

  /**
   * Search workspace for a file by name (fuzzy matching)
   */
  public async findFile(fileName: string): Promise<vscode.Uri | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return null;
    }

    // Try exact match first
    const exactFiles = await vscode.workspace.findFiles(`**/${fileName}`, '**/node_modules/**', 1);
    if (exactFiles.length > 0) {
      return exactFiles[0];
    }

    // Try fuzzy match (without path)
    const baseName = path.basename(fileName);
    const fuzzyFiles = await vscode.workspace.findFiles(`**/${baseName}`, '**/node_modules/**', 5);
    
    if (fuzzyFiles.length > 0) {
      // If multiple matches, prefer files closer to root or in common directories
      return this._selectBestMatch(fuzzyFiles, fileName);
    }

    // Try partial match - search for files containing key parts of the name
    // e.g., "requestValidation.js" should match "validateRequest.js"
    const nameWithoutExt = baseName.replace(/\.[^.]+$/, '');
    const words = nameWithoutExt.split(/(?=[A-Z])|[-_]/).filter(w => w.length > 2);
    
    for (const word of words) {
      const partialFiles = await vscode.workspace.findFiles(`**/*${word}*.js`, '**/node_modules/**', 5);
      if (partialFiles.length > 0) {
        return this._selectBestMatch(partialFiles, fileName);
      }
    }

    return null;
  }

  /**
   * Select the most relevant file from multiple matches
   */
  private _selectBestMatch(files: vscode.Uri[], searchTerm: string): vscode.Uri {
    // Score each file based on relevance
    const scored = files.map(uri => {
      const filePath = uri.fsPath.toLowerCase();
      const search = searchTerm.toLowerCase();
      let score = 0;

      // Exact path match
      if (filePath.endsWith(search)) {
        score += 100;
      }

      // Shorter path = more relevant (closer to root)
      score -= filePath.split(/[/\\]/).length;

      // Prefer certain directories
      if (filePath.includes('/src/') || filePath.includes('\\src\\')) {
        score += 10;
      }
      if (filePath.includes('/config/') || filePath.includes('\\config\\')) {
        score += 5;
      }

      // Penalize test/build directories
      if (filePath.includes('/test/') || filePath.includes('\\test\\') ||
          filePath.includes('/dist/') || filePath.includes('\\dist\\')) {
        score -= 20;
      }

      return { uri, score };
    });

    // Return highest scored file
    scored.sort((a, b) => b.score - a.score);
    return scored[0].uri;
  }

  /**
   * Read file content and gather context
   */
  public async getFileContext(fileUri: vscode.Uri): Promise<{
    path: string;
    absolutePath: string;
    content: string;
    language: string;
    size: number;
    lines: number;
  } | null> {
    try {
      const document = await vscode.workspace.openTextDocument(fileUri);
      const content = document.getText();
      
      return {
        path: vscode.workspace.asRelativePath(fileUri),
        absolutePath: fileUri.fsPath,
        content: content,
        language: document.languageId,
        size: Buffer.from(content).length,
        lines: document.lineCount
      };
    } catch (error) {
      console.error('Error reading file:', error);
      return null;
    }
  }

  /**
   * Gather project context (package.json, README, etc.)
   */
  public async getProjectContext(): Promise<{
    name?: string;
    description?: string;
    dependencies?: Record<string, string>;
    structure?: string[];
  }> {
    const context: any = {};

    // Try to find package.json
    const packageJsonFiles = await vscode.workspace.findFiles('**/package.json', '**/node_modules/**', 1);
    if (packageJsonFiles.length > 0) {
      try {
        const doc = await vscode.workspace.openTextDocument(packageJsonFiles[0]);
        const packageJson = JSON.parse(doc.getText());
        context.name = packageJson.name;
        context.description = packageJson.description;
        context.dependencies = packageJson.dependencies;
      } catch (error) {
        console.error('Error parsing package.json:', error);
      }
    }

    // Get basic workspace structure (top-level folders)
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
      const structure: string[] = [];
      for (const folder of workspaceFolders) {
        const files = await vscode.workspace.fs.readDirectory(folder.uri);
        structure.push(...files.map(([name, type]) => 
          type === vscode.FileType.Directory ? `${name}/` : name
        ));
      }
      context.structure = structure;
    }

    return context;
  }

  /**
   * Analyze relationships between files (imports, dependencies)
   */
  public async analyzeFileDependencies(fileUri: vscode.Uri): Promise<{
    imports: string[];
    exportedSymbols: string[];
  }> {
    const document = await vscode.workspace.openTextDocument(fileUri);
    const content = document.getText();
    const language = document.languageId;

    const imports: string[] = [];
    const exportedSymbols: string[] = [];

    if (language === 'typescript' || language === 'javascript') {
      // Extract imports
      const importRegex = /import\s+.*\s+from\s+['"](.+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[1]);
      }

      // Extract exports
      const exportRegex = /export\s+(?:class|function|const|let|var|interface|type)\s+([a-zA-Z0-9_]+)/g;
      while ((match = exportRegex.exec(content)) !== null) {
        exportedSymbols.push(match[1]);
      }
    }

    return { imports, exportedSymbols };
  }
}
