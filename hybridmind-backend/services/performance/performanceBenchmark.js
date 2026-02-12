/**
 * Performance Benchmarking System
 * 
 * Measures latency across all operations:
 * - Model API calls (TTFB, total time, tokens/sec)
 * - Agent execution (thinking, action, completion)
 * - Workflow steps (sequential vs parallel)
 * - Tool calls
 * - Database operations
 * 
 * Tracks P50, P95, P99 percentiles for SLA monitoring.
 */

const logger = require('../../utils/logger');

class PerformanceBenchmark {
  constructor() {
    this.benchmarks = new Map(); // operationType -> measurements
    this.activeMeasurements = new Map(); // measurementId -> startData
    
    this.stats = {
      totalMeasurements: 0,
      byOperation: {},
      byProvider: {},
      byModel: {}
    };
  }

  /**
   * Start measuring an operation
   */
  startMeasurement({
    operationType,
    provider = null,
    model = null,
    metadata = {}
  }) {
    const measurementId = `${operationType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const measurement = {
      measurementId,
      operationType,
      provider,
      model,
      metadata,
      startTime: Date.now(),
      startHrTime: process.hrtime.bigint(),
      endTime: null,
      duration: null,
      ttfb: null, // Time to first byte
      success: null,
      error: null
    };

    this.activeMeasurements.set(measurementId, measurement);

    return measurementId;
  }

  /**
   * Mark first byte received (for streaming)
   */
  markFirstByte(measurementId) {
    const measurement = this.activeMeasurements.get(measurementId);
    
    if (measurement && !measurement.ttfb) {
      measurement.ttfb = Date.now() - measurement.startTime;
    }
  }

  /**
   * End measurement
   */
  endMeasurement(measurementId, {
    success = true,
    error = null,
    tokensInput = 0,
    tokensOutput = 0,
    cost = 0,
    metadata = {}
  } = {}) {
    const measurement = this.activeMeasurements.get(measurementId);
    
    if (!measurement) {
      logger.warn(`Measurement not found: ${measurementId}`);
      return null;
    }

    const endHrTime = process.hrtime.bigint();
    measurement.endTime = Date.now();
    measurement.duration = Number(endHrTime - measurement.startHrTime) / 1_000_000; // Convert to ms
    measurement.success = success;
    measurement.error = error;
    measurement.tokensInput = tokensInput;
    measurement.tokensOutput = tokensOutput;
    measurement.cost = cost;
    measurement.metadata = { ...measurement.metadata, ...metadata };

    // Calculate tokens per second
    if (tokensOutput > 0 && measurement.duration > 0) {
      measurement.tokensPerSecond = (tokensOutput / measurement.duration) * 1000;
    }

    // Store in benchmarks
    if (!this.benchmarks.has(measurement.operationType)) {
      this.benchmarks.set(measurement.operationType, []);
    }
    this.benchmarks.get(measurement.operationType).push(measurement);

    // Keep only last 10,000 measurements per operation
    const opBenchmarks = this.benchmarks.get(measurement.operationType);
    if (opBenchmarks.length > 10000) {
      this.benchmarks.set(measurement.operationType, opBenchmarks.slice(-10000));
    }

    // Update stats
    this.stats.totalMeasurements++;
    this.stats.byOperation[measurement.operationType] = 
      (this.stats.byOperation[measurement.operationType] || 0) + 1;
    
    if (measurement.provider) {
      this.stats.byProvider[measurement.provider] = 
        (this.stats.byProvider[measurement.provider] || 0) + 1;
    }
    
    if (measurement.model) {
      this.stats.byModel[measurement.model] = 
        (this.stats.byModel[measurement.model] || 0) + 1;
    }

    // Remove from active
    this.activeMeasurements.delete(measurementId);

    logger.debug(`Benchmark: ${measurement.operationType} - ${measurement.duration.toFixed(2)}ms`);

    return measurement;
  }

  /**
   * Get percentile statistics
   */
  getPercentiles(operationType = null, filters = {}) {
    let measurements = [];

    if (operationType) {
      measurements = this.benchmarks.get(operationType) || [];
    } else {
      // All measurements
      for (const opMeasurements of this.benchmarks.values()) {
        measurements = measurements.concat(opMeasurements);
      }
    }

    // Apply filters
    if (filters.provider) {
      measurements = measurements.filter(m => m.provider === filters.provider);
    }
    if (filters.model) {
      measurements = measurements.filter(m => m.model === filters.model);
    }
    if (filters.success !== undefined) {
      measurements = measurements.filter(m => m.success === filters.success);
    }
    if (filters.startTime) {
      measurements = measurements.filter(m => m.startTime >= filters.startTime);
    }
    if (filters.endTime) {
      measurements = measurements.filter(m => m.endTime <= filters.endTime);
    }

    if (measurements.length === 0) {
      return null;
    }

    // Extract durations and sort
    const durations = measurements.map(m => m.duration).sort((a, b) => a - b);
    const ttfbs = measurements.filter(m => m.ttfb).map(m => m.ttfb).sort((a, b) => a - b);
    const costs = measurements.map(m => m.cost || 0);
    const tokensPerSec = measurements.filter(m => m.tokensPerSecond).map(m => m.tokensPerSecond);

    return {
      count: measurements.length,
      duration: {
        min: Math.min(...durations),
        max: Math.max(...durations),
        mean: durations.reduce((a, b) => a + b, 0) / durations.length,
        median: this._percentile(durations, 50),
        p50: this._percentile(durations, 50),
        p75: this._percentile(durations, 75),
        p90: this._percentile(durations, 90),
        p95: this._percentile(durations, 95),
        p99: this._percentile(durations, 99)
      },
      ttfb: ttfbs.length > 0 ? {
        min: Math.min(...ttfbs),
        max: Math.max(...ttfbs),
        mean: ttfbs.reduce((a, b) => a + b, 0) / ttfbs.length,
        median: this._percentile(ttfbs, 50),
        p95: this._percentile(ttfbs, 95)
      } : null,
      cost: {
        total: costs.reduce((a, b) => a + b, 0),
        mean: costs.reduce((a, b) => a + b, 0) / costs.length,
        min: Math.min(...costs),
        max: Math.max(...costs)
      },
      tokensPerSecond: tokensPerSec.length > 0 ? {
        mean: tokensPerSec.reduce((a, b) => a + b, 0) / tokensPerSec.length,
        min: Math.min(...tokensPerSec),
        max: Math.max(...tokensPerSec)
      } : null,
      successRate: measurements.filter(m => m.success).length / measurements.length
    };
  }

  /**
   * Calculate percentile
   */
  _percentile(sorted, percentile) {
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get operation types
   */
  getOperationTypes() {
    return Array.from(this.benchmarks.keys());
  }

  /**
   * Get detailed report
   */
  getReport(filters = {}) {
    const report = {
      timestamp: new Date(),
      filters,
      operations: {}
    };

    const operationTypes = filters.operationType 
      ? [filters.operationType]
      : this.getOperationTypes();

    for (const opType of operationTypes) {
      const percentiles = this.getPercentiles(opType, filters);
      
      if (percentiles) {
        report.operations[opType] = percentiles;
      }
    }

    report.summary = {
      totalOperations: this.stats.totalMeasurements,
      operationTypes: Object.keys(this.stats.byOperation).length,
      providers: Object.keys(this.stats.byProvider).length,
      models: Object.keys(this.stats.byModel).length
    };

    return report;
  }

  /**
   * Compare providers
   */
  compareProviders(operationType = null) {
    const providers = {};

    const measurements = operationType 
      ? this.benchmarks.get(operationType) || []
      : Array.from(this.benchmarks.values()).flat();

    for (const measurement of measurements) {
      if (!measurement.provider) continue;

      if (!providers[measurement.provider]) {
        providers[measurement.provider] = {
          measurements: [],
          totalCost: 0,
          successCount: 0,
          failureCount: 0
        };
      }

      providers[measurement.provider].measurements.push(measurement);
      providers[measurement.provider].totalCost += measurement.cost || 0;
      
      if (measurement.success) {
        providers[measurement.provider].successCount++;
      } else {
        providers[measurement.provider].failureCount++;
      }
    }

    // Calculate stats for each provider
    const comparison = [];
    
    for (const [provider, data] of Object.entries(providers)) {
      const durations = data.measurements.map(m => m.duration).sort((a, b) => a - b);
      const tokensPerSec = data.measurements
        .filter(m => m.tokensPerSecond)
        .map(m => m.tokensPerSecond);

      comparison.push({
        provider,
        count: data.measurements.length,
        successRate: data.successCount / data.measurements.length,
        avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        p50Duration: this._percentile(durations, 50),
        p95Duration: this._percentile(durations, 95),
        avgTokensPerSec: tokensPerSec.length > 0 
          ? tokensPerSec.reduce((a, b) => a + b, 0) / tokensPerSec.length 
          : null,
        totalCost: data.totalCost,
        avgCost: data.totalCost / data.measurements.length
      });
    }

    // Sort by average duration (fastest first)
    comparison.sort((a, b) => a.avgDuration - b.avgDuration);

    return comparison;
  }

  /**
   * Compare models
   */
  compareModels(operationType = null) {
    const models = {};

    const measurements = operationType 
      ? this.benchmarks.get(operationType) || []
      : Array.from(this.benchmarks.values()).flat();

    for (const measurement of measurements) {
      if (!measurement.model) continue;

      if (!models[measurement.model]) {
        models[measurement.model] = {
          measurements: [],
          totalCost: 0,
          successCount: 0
        };
      }

      models[measurement.model].measurements.push(measurement);
      models[measurement.model].totalCost += measurement.cost || 0;
      
      if (measurement.success) {
        models[measurement.model].successCount++;
      }
    }

    const comparison = [];
    
    for (const [model, data] of Object.entries(models)) {
      const durations = data.measurements.map(m => m.duration).sort((a, b) => a - b);
      const tokensPerSec = data.measurements
        .filter(m => m.tokensPerSecond)
        .map(m => m.tokensPerSecond);

      comparison.push({
        model,
        count: data.measurements.length,
        successRate: data.successCount / data.measurements.length,
        avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        p50Duration: this._percentile(durations, 50),
        p95Duration: this._percentile(durations, 95),
        avgTokensPerSec: tokensPerSec.length > 0 
          ? tokensPerSec.reduce((a, b) => a + b, 0) / tokensPerSec.length 
          : null,
        totalCost: data.totalCost,
        avgCost: data.totalCost / data.measurements.length,
        costPerSuccess: data.totalCost / data.successCount
      });
    }

    comparison.sort((a, b) => a.avgDuration - b.avgDuration);

    return comparison;
  }

  /**
   * Get slowest operations
   */
  getSlowest(limit = 10, operationType = null) {
    let measurements = [];

    if (operationType) {
      measurements = this.benchmarks.get(operationType) || [];
    } else {
      for (const opMeasurements of this.benchmarks.values()) {
        measurements = measurements.concat(opMeasurements);
      }
    }

    return measurements
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit)
      .map(m => ({
        measurementId: m.measurementId,
        operationType: m.operationType,
        provider: m.provider,
        model: m.model,
        duration: m.duration,
        ttfb: m.ttfb,
        success: m.success,
        metadata: m.metadata
      }));
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeMeasurements: this.activeMeasurements.size,
      totalBenchmarks: Array.from(this.benchmarks.values())
        .reduce((sum, arr) => sum + arr.length, 0)
    };
  }

  /**
   * Clear old benchmarks
   */
  clearOld(olderThan = 86400000) { // 24 hours
    const cutoff = Date.now() - olderThan;
    let cleared = 0;

    for (const [opType, measurements] of this.benchmarks.entries()) {
      const filtered = measurements.filter(m => m.startTime > cutoff);
      cleared += measurements.length - filtered.length;
      this.benchmarks.set(opType, filtered);
    }

    logger.info(`Cleared ${cleared} old benchmarks`);
    return cleared;
  }

  /**
   * Export benchmarks
   */
  export(operationType = null, format = 'json') {
    let measurements = [];

    if (operationType) {
      measurements = this.benchmarks.get(operationType) || [];
    } else {
      for (const opMeasurements of this.benchmarks.values()) {
        measurements = measurements.concat(opMeasurements);
      }
    }

    if (format === 'csv') {
      return this._exportCSV(measurements);
    }

    return measurements;
  }

  /**
   * Export to CSV
   */
  _exportCSV(measurements) {
    const headers = ['timestamp', 'operationType', 'provider', 'model', 'duration', 'ttfb', 'tokensPerSecond', 'cost', 'success'];
    const rows = [headers.join(',')];

    for (const m of measurements) {
      const row = [
        new Date(m.startTime).toISOString(),
        m.operationType,
        m.provider || '',
        m.model || '',
        m.duration.toFixed(2),
        m.ttfb || '',
        m.tokensPerSecond ? m.tokensPerSecond.toFixed(2) : '',
        m.cost || '',
        m.success
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }
}

// Singleton instance
module.exports = new PerformanceBenchmark();
