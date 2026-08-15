/**
 * Context Chunker - Splits large contexts into semantic chunks
 * Preserves code structure, function boundaries, and logical units
 */

const logger = require('../../utils/logger');

class ContextChunker {
  constructor() {
    this.chunkIdCounter = 0;
  }

  /**
   * Chunk content into semantic pieces
   * @param {Object} options
   * @param {string} options.content - Content to chunk
   * @param {number} options.maxChunkSize - Max tokens per chunk
   * @param {number} options.overlap - Token overlap between chunks
   * @param {boolean} options.preserveStructure - Keep code/doc structure intact
   * @returns {Promise<Array>} Array of chunks with metadata
   */
  async chunk({ content, maxChunkSize = 1000, overlap = 100, preserveStructure = true }) {
    try {
      if (!content || content.trim().length === 0) {
        return [];
      }

      // Detect content type
      const contentType = this._detectContentType(content);
      
      logger.info(`Chunking ${contentType} content (${content.length} chars)`);

      // Choose chunking strategy based on content type
      let chunks;
      switch (contentType) {
        case 'code':
          chunks = preserveStructure 
            ? this._chunkCodeStructured(content, maxChunkSize, overlap)
            : this._chunkBySize(content, maxChunkSize, overlap);
          break;
        
        case 'markdown':
          chunks = preserveStructure
            ? this._chunkMarkdownStructured(content, maxChunkSize, overlap)
            : this._chunkBySize(content, maxChunkSize, overlap);
          break;
        
        default:
          chunks = this._chunkBySize(content, maxChunkSize, overlap);
      }

      logger.info(`Created ${chunks.length} chunks from ${contentType} content`);

      return chunks;

    } catch (error) {
      logger.error(`Chunking failed: ${error.message}`);
      // Fallback to simple size-based chunking
      return this._chunkBySize(content, maxChunkSize, overlap);
    }
  }

  /**
   * Detect content type
   */
  _detectContentType(content) {
    // Check for code patterns
    const codePatterns = [
      /^import\s+/m,
      /^const\s+/m,
      /^function\s+/m,
      /^class\s+/m,
      /^\s*\/\//m,  // Comments
      /^\s*\/\*/m,
      /^export\s+/m
    ];

    const hasCodePatterns = codePatterns.some(pattern => pattern.test(content));
    
    // Check for markdown
    const hasMarkdown = /^#{1,6}\s+/m.test(content) || /^```/m.test(content);

    if (hasCodePatterns) return 'code';
    if (hasMarkdown) return 'markdown';
    return 'text';
  }

  /**
   * Chunk code while preserving structure (functions, classes, etc.)
   */
  _chunkCodeStructured(content, maxChunkSize, overlap) {
    const chunks = [];
    const lines = content.split('\n');
    
    // Find structural boundaries (functions, classes, etc.)
    const boundaries = this._findCodeBoundaries(lines);
    
    let currentChunk = [];
    let currentTokens = 0;
    let position = 0;

    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i];
      const boundaryLines = lines.slice(boundary.start, boundary.end + 1);
      const boundaryText = boundaryLines.join('\n');
      const boundaryTokens = this._estimateTokens(boundaryText);

      // If this boundary alone exceeds max size, split it
      if (boundaryTokens > maxChunkSize) {
        // Save current chunk if exists
        if (currentChunk.length > 0) {
          chunks.push(this._createChunk(currentChunk.join('\n'), position++, currentTokens));
          currentChunk = [];
          currentTokens = 0;
        }

        // Split large boundary
        const subChunks = this._chunkBySize(boundaryText, maxChunkSize, overlap);
        for (const subChunk of subChunks) {
          chunks.push({ ...subChunk, position: position++, boundary: boundary.type });
        }
        continue;
      }

      // If adding this boundary exceeds max size, save current chunk
      if (currentTokens + boundaryTokens > maxChunkSize && currentChunk.length > 0) {
        chunks.push(this._createChunk(currentChunk.join('\n'), position++, currentTokens, boundary.type));
        
        // Add overlap from previous chunk
        const overlapLines = Math.floor(overlap / 20); // ~20 tokens per line
        currentChunk = currentChunk.slice(-overlapLines);
        currentTokens = this._estimateTokens(currentChunk.join('\n'));
      }

      // Add boundary to current chunk
      currentChunk.push(...boundaryLines);
      currentTokens += boundaryTokens;
    }

    // Add remaining chunk
    if (currentChunk.length > 0) {
      chunks.push(this._createChunk(currentChunk.join('\n'), position++, currentTokens));
    }

    return chunks;
  }

  /**
   * Find code structure boundaries (functions, classes, etc.)
   */
  _findCodeBoundaries(lines) {
    const boundaries = [];
    let currentBoundary = null;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Detect start of function/class
      if (!currentBoundary) {
        const functionMatch = /^(export\s+)?(async\s+)?(function|class|const|let|var)\s+(\w+)/.exec(trimmed);
        const methodMatch = /^(async\s+)?(\w+)\s*\([^)]*\)\s*{/.exec(trimmed);
        
        if (functionMatch || methodMatch) {
          currentBoundary = {
            type: functionMatch ? functionMatch[3] : 'method',
            name: functionMatch ? functionMatch[4] : (methodMatch ? methodMatch[2] : 'anonymous'),
            start: i,
            end: i
          };
        }
      }

      // Track brace depth
      braceDepth += (line.match(/{/g) || []).length;
      braceDepth -= (line.match(/}/g) || []).length;

      // End of boundary when braces balance
      if (currentBoundary && braceDepth === 0 && line.includes('}')) {
        currentBoundary.end = i;
        boundaries.push(currentBoundary);
        currentBoundary = null;
      }
    }

    // Handle unclosed boundary
    if (currentBoundary) {
      currentBoundary.end = lines.length - 1;
      boundaries.push(currentBoundary);
    }

    // If no boundaries found, create single boundary for whole content
    if (boundaries.length === 0) {
      boundaries.push({
        type: 'block',
        name: 'content',
        start: 0,
        end: lines.length - 1
      });
    }

    return boundaries;
  }

  /**
   * Chunk markdown while preserving structure (headers, sections, etc.)
   */
  _chunkMarkdownStructured(content, maxChunkSize, overlap) {
    const chunks = [];
    const lines = content.split('\n');
    
    // Find markdown sections (headers)
    const sections = this._findMarkdownSections(lines);
    
    let currentChunk = [];
    let currentTokens = 0;
    let position = 0;

    for (const section of sections) {
      const sectionLines = lines.slice(section.start, section.end + 1);
      const sectionText = sectionLines.join('\n');
      const sectionTokens = this._estimateTokens(sectionText);

      // If section exceeds max size, split it
      if (sectionTokens > maxChunkSize) {
        // Save current chunk if exists
        if (currentChunk.length > 0) {
          chunks.push(this._createChunk(currentChunk.join('\n'), position++, currentTokens));
          currentChunk = [];
          currentTokens = 0;
        }

        // Split large section
        const subChunks = this._chunkBySize(sectionText, maxChunkSize, overlap);
        for (const subChunk of subChunks) {
          chunks.push({ ...subChunk, position: position++, section: section.title });
        }
        continue;
      }

      // If adding this section exceeds max size, save current chunk
      if (currentTokens + sectionTokens > maxChunkSize && currentChunk.length > 0) {
        chunks.push(this._createChunk(currentChunk.join('\n'), position++, currentTokens));
        currentChunk = [];
        currentTokens = 0;
      }

      // Add section to current chunk
      currentChunk.push(...sectionLines);
      currentTokens += sectionTokens;
    }

    // Add remaining chunk
    if (currentChunk.length > 0) {
      chunks.push(this._createChunk(currentChunk.join('\n'), position++, currentTokens));
    }

    return chunks;
  }

  /**
   * Find markdown sections based on headers
   */
  _findMarkdownSections(lines) {
    const sections = [];
    let currentSection = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headerMatch = /^(#{1,6})\s+(.+)$/.exec(line.trim());

      if (headerMatch) {
        // Save previous section
        if (currentSection) {
          currentSection.end = i - 1;
          sections.push(currentSection);
        }

        // Start new section
        currentSection = {
          level: headerMatch[1].length,
          title: headerMatch[2],
          start: i,
          end: i
        };
      }
    }

    // Save last section
    if (currentSection) {
      currentSection.end = lines.length - 1;
      sections.push(currentSection);
    }

    // If no sections, create one for entire content
    if (sections.length === 0) {
      sections.push({
        level: 0,
        title: 'content',
        start: 0,
        end: lines.length - 1
      });
    }

    return sections;
  }

  /**
   * Simple size-based chunking with overlap
   */
  _chunkBySize(content, maxChunkSize, overlap) {
    const chunks = [];
    const tokens = this._estimateTokens(content);
    
    if (tokens <= maxChunkSize) {
      return [this._createChunk(content, 0, tokens)];
    }

    // Calculate character size per chunk
    const charsPerToken = content.length / tokens;
    const maxChars = Math.floor(maxChunkSize * charsPerToken);
    const overlapChars = Math.floor(overlap * charsPerToken);

    let position = 0;
    let start = 0;

    while (start < content.length) {
      let end = Math.min(start + maxChars, content.length);

      // Try to break at natural boundaries (newline, space, punctuation)
      if (end < content.length) {
        const searchStart = Math.max(start, end - 100);
        const segment = content.substring(searchStart, end);
        
        const breakPoints = ['\n\n', '\n', '. ', ', ', ' '];
        for (const breakPoint of breakPoints) {
          const lastBreak = segment.lastIndexOf(breakPoint);
          if (lastBreak !== -1) {
            end = searchStart + lastBreak + breakPoint.length;
            break;
          }
        }
      }

      const chunkText = content.substring(start, end);
      const chunkTokens = this._estimateTokens(chunkText);
      
      chunks.push(this._createChunk(chunkText, position++, chunkTokens));

      // Move start forward with overlap
      start = end - overlapChars;
    }

    return chunks;
  }

  /**
   * Create chunk object with metadata
   */
  _createChunk(text, position, tokens, type = 'general') {
    return {
      id: `chunk_${this.chunkIdCounter++}`,
      text: text.trim(),
      tokens: tokens || this._estimateTokens(text),
      position,
      type,
      metadata: {
        length: text.length,
        lines: text.split('\n').length
      }
    };
  }

  /**
   * Estimate tokens (rough approximation: ~4 chars per token)
   */
  _estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  /**
   * Reset chunk ID counter (for testing)
   */
  resetCounter() {
    this.chunkIdCounter = 0;
  }
}

module.exports = ContextChunker;
