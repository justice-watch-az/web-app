const Redis = require('ioredis');

class CacheManager {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB || 0,
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });
    
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
    };
    
    this.redis.on('error', (err) => {
      console.error('Redis connection error:', err);
    });
  }
  
  // Generate cache key
  generateKey(prefix, params) {
    const paramStr = Object.keys(params)
      .sort()
      .map(k => `${k}:${params[k]}`)
      .join(':');
    return `justice:${prefix}:${paramStr}`;
  }
  
  // Get with automatic JSON parsing
  async get(key) {
    try {
      const value = await this.redis.get(key);
      if (value) {
        this.stats.hits++;
        return JSON.parse(value);
      } else {
        this.stats.misses++;
        return null;
      }
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }
  
  // Set with automatic JSON stringification
  async set(key, value, ttl = 300) {
    try {
      const stringValue = JSON.stringify(value);
      if (ttl) {
        await this.redis.setex(key, ttl, stringValue);
      } else {
        await this.redis.set(key, stringValue);
      }
      this.stats.sets++;
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }
  
  // Delete keys by pattern
  async invalidate(pattern) {
    const stream = this.redis.scanStream({
      match: `justice:${pattern}*`,
      count: 100
    });
    
    const pipeline = this.redis.pipeline();
    
    stream.on('data', (keys) => {
      if (keys.length) {
        keys.forEach(key => pipeline.del(key));
      }
    });
    
    return new Promise((resolve) => {
      stream.on('end', async () => {
        const results = await pipeline.exec();
        resolve(results.length);
      });
    });
  }
  
  // Cache wrapper for database queries
  async withCache(key, ttl, dbQuery) {
    // Try cache first
    const cached = await this.get(key);
    if (cached) {
      return { data: cached, fromCache: true };
    }
    
    // Execute database query
    const result = await dbQuery();
    
    // Cache the result
    await this.set(key, result, ttl);
    
    return { data: result, fromCache: false };
  }
  
  // Get hit rate
  getHitRate() {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? (this.stats.hits / total * 100).toFixed(2) : 0;
  }
}

module.exports = new CacheManager();