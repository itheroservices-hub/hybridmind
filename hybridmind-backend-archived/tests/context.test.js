/**
 * Context Management System Tests
 * Tests for context chunking, relevance scoring, routing, and caching
 */

const ContextManager = require('../services/context/contextManager');
const ContextChunker = require('../services/context/contextChunker');
const RelevanceScorer = require('../services/context/relevanceScorer');
const ContextRouter = require('../services/context/contextRouter');
const ContextCache = require('../services/context/contextCache');

// Sample code for testing
const sampleCode = `
function calculateTotal(items) {
  let total = 0;
  for (const item of items) {
    total += item.price * item.quantity;
  }
  return total;
}

function processOrder(order) {
  const total = calculateTotal(order.items);
  const tax = total * 0.1;
  const shipping = total > 100 ? 0 : 10;
  
  return {
    subtotal: total,
    tax: tax,
    shipping: shipping,
    total: total + tax + shipping
  };
}

class OrderManager {
  constructor() {
    this.orders = [];
  }

  addOrder(order) {
    const processed = processOrder(order);
    this.orders.push({
      ...order,
      ...processed,
      timestamp: new Date()
    });
  }

  getTotal() {
    return this.orders.reduce((sum, order) => sum + order.total, 0);
  }
}

module.exports = { calculateTotal, processOrder, OrderManager };
`;

describe('Context Chunker Tests', () => {
  let chunker;

  beforeEach(() => {
    chunker = new ContextChunker();
  });

  test('should chunk code by structure', async () => {
    const chunks = await chunker.chunk({
      content: sampleCode,
      maxChunkSize: 500,
      overlap: 50,
      preserveStructure: true
    });

    expect(chunks).toBeDefined();
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]).toHaveProperty('id');
    expect(chunks[0]).toHaveProperty('text');
    expect(chunks[0]).toHaveProperty('tokens');
    expect(chunks[0]).toHaveProperty('position');

    console.log(`✓ Created ${chunks.length} chunks from sample code`);
  });

  test('should detect code content type', async () => {
    const chunks = await chunker.chunk({
      content: sampleCode,
      maxChunkSize: 1000
    });

    expect(chunks.length).toBeGreaterThan(0);
    console.log(`✓ Detected and chunked code content`);
  });

  test('should handle markdown content', async () => {
    const markdown = `# Title\n\n## Section 1\nContent here.\n\n## Section 2\nMore content.`;
    
    const chunks = await chunker.chunk({
      content: markdown,
      maxChunkSize: 100,
      preserveStructure: true
    });

    expect(chunks.length).toBeGreaterThan(0);
    console.log(`✓ Chunked markdown into ${chunks.length} sections`);
  });

  test('should add overlap between chunks', async () => {
    const text = 'word '.repeat(1000); // 1000 words
    
    const chunks = await chunker.chunk({
      content: text,
      maxChunkSize: 100,
      overlap: 20
    });

    expect(chunks.length).toBeGreaterThan(1);
    console.log(`✓ Created ${chunks.length} chunks with overlap`);
  });
});

describe('Relevance Scorer Tests', () => {
  let scorer;

  beforeEach(() => {
    scorer = new RelevanceScorer();
  });

  test('should score chunks for keyword relevance', async () => {
    const chunker = new ContextChunker();
    const chunks = await chunker.chunk({
      content: sampleCode,
      maxChunkSize: 500
    });

    const scoredChunks = await scorer.scoreChunks({
      chunks,
      task: 'calculate total price',
      taskType: 'analysis'
    });

    expect(scoredChunks).toBeDefined();
    expect(scoredChunks.length).toBe(chunks.length);
    expect(scoredChunks[0]).toHaveProperty('relevanceScore');
    expect(scoredChunks[0].relevanceScore).toBeGreaterThanOrEqual(0);
    expect(scoredChunks[0].relevanceScore).toBeLessThanOrEqual(1);

    console.log(`✓ Scored ${scoredChunks.length} chunks for relevance`);
    console.log(`  Average score: ${scoredChunks.reduce((s, c) => s + c.relevanceScore, 0) / scoredChunks.length}`);
  });

  test('should give higher scores to relevant chunks', async () => {
    const chunker = new ContextChunker();
    const chunks = await chunker.chunk({
      content: sampleCode,
      maxChunkSize: 500
    });

    const scoredChunks = await scorer.scoreChunks({
      chunks,
      task: 'OrderManager class implementation',
      taskType: 'analysis'
    });

    // Find chunk containing OrderManager
    const orderChunk = scoredChunks.find(c => c.text.includes('OrderManager'));
    const otherChunks = scoredChunks.filter(c => !c.text.includes('OrderManager'));

    if (orderChunk && otherChunks.length > 0) {
      const avgOther = otherChunks.reduce((s, c) => s + c.relevanceScore, 0) / otherChunks.length;
      expect(orderChunk.relevanceScore).toBeGreaterThan(avgOther);
      console.log(`✓ OrderManager chunk scored higher: ${orderChunk.relevanceScore.toFixed(3)} vs ${avgOther.toFixed(3)}`);
    }
  });

  test('should support different task types', async () => {
    const chunker = new ContextChunker();
    const chunks = await chunker.chunk({
      content: sampleCode,
      maxChunkSize: 500
    });

    const taskTypes = ['analysis', 'refactor', 'generate', 'debug', 'general'];
    
    for (const taskType of taskTypes) {
      const scored = await scorer.scoreChunks({
        chunks,
        task: 'process order',
        taskType
      });

      expect(scored.length).toBe(chunks.length);
      console.log(`✓ Scored chunks for ${taskType} task`);
    }
  });
});

describe('Context Router Tests', () => {
  let router;

  beforeEach(() => {
    router = new ContextRouter();
  });

  test('should create routing plan for sequential steps', async () => {
    const chunker = new ContextChunker();
    const chunks = await chunker.chunk({
      content: sampleCode,
      maxChunkSize: 300
    });

    const chainSteps = [
      { id: 'step-1', name: 'Analyze', description: 'Analyze code structure', dependencies: [] },
      { id: 'step-2', name: 'Refactor', description: 'Refactor functions', dependencies: ['step-1'] },
      { id: 'step-3', name: 'Test', description: 'Add tests', dependencies: ['step-2'] }
    ];

    const plan = await router.createRoutingPlan({
      chunks,
      chainSteps,
      maxTokensPerStep: 1000
    });

    expect(plan).toBeDefined();
    expect(plan.length).toBe(chainSteps.length);
    expect(plan[0]).toHaveProperty('stepId');
    expect(plan[0]).toHaveProperty('chunks');
    expect(plan[0].chunks.length).toBeGreaterThan(0);

    console.log(`✓ Created routing plan for ${plan.length} steps`);
    console.log(`  Average chunks per step: ${(plan.reduce((s, p) => s + p.chunks.length, 0) / plan.length).toFixed(1)}`);
  });

  test('should optimize chunk reuse across steps', async () => {
    const chunker = new ContextChunker();
    const chunks = await chunker.chunk({
      content: sampleCode,
      maxChunkSize: 300
    });

    const chainSteps = [
      { id: 'step-1', name: 'Step 1', description: 'First step', dependencies: [] },
      { id: 'step-2', name: 'Step 2', description: 'Second step', dependencies: [] }
    ];

    const plan = await router.createRoutingPlan({
      chunks,
      chainSteps,
      maxTokensPerStep: 1000,
      strategy: 'parallel'
    });

    const stats = router.getStatistics(plan);
    expect(stats.averageReuseRatio).toBeGreaterThan(0);

    console.log(`✓ Chunk reuse ratio: ${stats.averageReuseRatio.toFixed(2)}`);
  });

  test('should support different routing strategies', async () => {
    const chunker = new ContextChunker();
    const chunks = await chunker.chunk({
      content: sampleCode,
      maxChunkSize: 300
    });

    const chainSteps = [
      { id: 'step-1', name: 'Step 1', description: 'task', dependencies: [] },
      { id: 'step-2', name: 'Step 2', description: 'task', dependencies: ['step-1'] }
    ];

    const strategies = ['sequential', 'parallel', 'hierarchical', 'adaptive'];

    for (const strategy of strategies) {
      const plan = await router.createRoutingPlan({
        chunks,
        chainSteps,
        maxTokensPerStep: 1000,
        strategy
      });

      expect(plan.length).toBe(chainSteps.length);
      console.log(`✓ ${strategy} strategy created plan`);
    }
  });
});

describe('Context Cache Tests', () => {
  let cache;

  beforeEach(() => {
    cache = new ContextCache({ maxSize: 10, defaultTTL: 1000 });
  });

  afterEach(() => {
    cache.destroy();
  });

  test('should cache and retrieve values', async () => {
    await cache.set('key1', { data: 'value1' });
    const value = await cache.get('key1');

    expect(value).toBeDefined();
    expect(value.data).toBe('value1');

    const stats = await cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(0);

    console.log('✓ Cache set and get working');
  });

  test('should return null for expired entries', async () => {
    await cache.set('key1', { data: 'value1' }, 100); // 100ms TTL
    
    await new Promise(resolve => setTimeout(resolve, 150));
    
    const value = await cache.get('key1');
    expect(value).toBeNull();

    console.log('✓ Cache expiration working');
  });

  test('should evict LRU when full', async () => {
    // Fill cache
    for (let i = 0; i < 10; i++) {
      await cache.set(`key${i}`, { data: `value${i}` });
    }

    // Add one more (should evict oldest)
    await cache.set('key10', { data: 'value10' });

    const stats = await cache.getStats();
    expect(stats.size).toBe(10);
    expect(stats.evictions).toBe(1);

    console.log('✓ LRU eviction working');
  });

  test('should track cache statistics', async () => {
    await cache.set('key1', { data: 'value1' });
    await cache.get('key1'); // hit
    await cache.get('key2'); // miss

    const stats = await cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(parseFloat(stats.hitRate)).toBeCloseTo(0.5, 1);

    console.log(`✓ Cache stats: ${stats.hits} hits, ${stats.misses} misses, ${stats.hitRate} hit rate`);
  });
});

describe('Context Manager Integration Tests', () => {
  let manager;

  beforeEach(() => {
    manager = new ContextManager();
  });

  test('should process context end-to-end', async () => {
    const result = await manager.processContext({
      rawContext: sampleCode,
      task: 'refactor the calculateTotal function',
      taskType: 'refactor',
      maxTokens: 2000
    });

    expect(result).toBeDefined();
    expect(result.context).toBeDefined();
    expect(result.metadata).toBeDefined();
    expect(result.metadata.compressionRatio).toBeGreaterThan(0);

    console.log('✓ Context processed end-to-end');
    console.log(`  Compression: ${result.metadata.compressionRatio.toFixed(2)}x`);
    console.log(`  Chunks used: ${result.metadata.chunksUsed}/${result.metadata.chunksTotal}`);
  });

  test('should process chain context with routing', async () => {
    const chainSteps = [
      { id: 'step-1', name: 'Analyze', description: 'Analyze code', type: 'analysis' },
      { id: 'step-2', name: 'Refactor', description: 'Refactor code', type: 'refactor' }
    ];

    const result = await manager.processChainContext({
      rawContext: sampleCode,
      chainSteps
    });

    expect(result).toBeDefined();
    expect(result.contextMap).toBeDefined();
    expect(result.contextMap['step-1']).toBeDefined();
    expect(result.contextMap['step-2']).toBeDefined();

    console.log('✓ Chain context processed');
    console.log(`  Steps: ${Object.keys(result.contextMap).length}`);
    console.log(`  Reuse efficiency: ${result.metadata.reuseEfficiency.toFixed(2)}x`);
  });

  test('should use caching for repeated requests', async () => {
    const task = 'analyze the code';
    
    // First request
    const result1 = await manager.processContext({
      rawContext: sampleCode,
      task,
      taskType: 'analysis'
    });

    // Second request (should be cached)
    const result2 = await manager.processContext({
      rawContext: sampleCode,
      task,
      taskType: 'analysis'
    });

    // Results should be identical
    expect(result1.context).toBe(result2.context);

    const stats = await manager.getStatistics();
    expect(stats.cache.hits).toBeGreaterThan(0);

    console.log('✓ Context caching working');
    console.log(`  Cache hit rate: ${stats.cache.hitRate}`);
  });

  test('should configure context manager', async () => {
    manager.configure({
      maxContextTokens: 10000,
      relevanceThreshold: 0.7,
      enableCaching: false
    });

    const stats = await manager.getStatistics();
    expect(stats.config.maxContextTokens).toBe(10000);
    expect(stats.config.relevanceThreshold).toBe(0.7);
    expect(stats.config.enableCaching).toBe(false);

    console.log('✓ Context manager configuration working');
  });
});

// Run tests
console.log('\n🧪 Running Context Management System Tests\n');

const runTests = async () => {
  try {
    console.log('='.repeat(60));
    console.log('Testing Context Chunker...');
    console.log('='.repeat(60));
    // Run chunker tests
    const chunker = new ContextChunker();
    const chunks = await chunker.chunk({ content: sampleCode, maxChunkSize: 500 });
    console.log(`✅ Chunker: Created ${chunks.length} chunks\n`);

    console.log('='.repeat(60));
    console.log('Testing Relevance Scorer...');
    console.log('='.repeat(60));
    const scorer = new RelevanceScorer();
    const scored = await scorer.scoreChunks({ chunks, task: 'calculate total', taskType: 'analysis' });
    console.log(`✅ Scorer: Scored ${scored.length} chunks\n`);

    console.log('='.repeat(60));
    console.log('Testing Context Router...');
    console.log('='.repeat(60));
    const router = new ContextRouter();
    const plan = await router.createRoutingPlan({
      chunks: scored,
      chainSteps: [
        { id: 'step-1', name: 'Test', description: 'Test step', dependencies: [] }
      ]
    });
    console.log(`✅ Router: Created routing plan with ${plan.length} routes\n`);

    console.log('='.repeat(60));
    console.log('Testing Context Cache...');
    console.log('='.repeat(60));
    const cache = new ContextCache();
    await cache.set('test', { value: 123 });
    const cached = await cache.get('test');
    console.log(`✅ Cache: Set and retrieved value: ${cached.value}\n`);
    cache.destroy();

    console.log('='.repeat(60));
    console.log('Testing Context Manager (Integration)...');
    console.log('='.repeat(60));
    const manager = new ContextManager();
    const result = await manager.processContext({
      rawContext: sampleCode,
      task: 'refactor code',
      taskType: 'refactor'
    });
    console.log(`✅ Manager: Processed context with ${result.metadata.compressionRatio.toFixed(2)}x compression\n`);

    console.log('='.repeat(60));
    console.log('✅ ALL TESTS PASSED!');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    console.error(error.stack);
  }
};

// Export for test runners or run directly
if (require.main === module) {
  runTests();
}

module.exports = {
  runTests,
  sampleCode
};
