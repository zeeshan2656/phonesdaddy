/**
 * PhonesDaddy - Ultra-Fast In-Memory Cache
 * Tailored for Hostinger Business Shared Hosting (Zero Redis/Docker dependency, microsecond latency)
 */

class MemoryCache {
  constructor(maxSize = 1500) {
    this.maxSize = maxSize;
    this.store = new Map(); // key -> { value, expiresAt, tags: Set }
    this.tagIndex = new Map(); // tag -> Set of keys
    this.hits = 0;
    this.misses = 0;

    // Periodic sweep to clean up expired keys every 2 minutes
    this.cleanupInterval = setInterval(() => this.sweep(), 2 * 60 * 1000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Set a key with TTL (in seconds) and optional tags
   */
  set(key, value, ttlSeconds = 300, tags = []) {
    // If size exceeds limit, evict oldest entry (LRU via Map key iteration)
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) {
        this.del(oldestKey);
      }
    }

    const expiresAt = Date.now() + Math.max(1, ttlSeconds) * 1000;
    const tagSet = new Set(Array.isArray(tags) ? tags : [tags].filter(Boolean));

    // Remove any previous tag mappings for this key
    if (this.store.has(key)) {
      this._removeKeyFromTags(key);
    }

    this.store.set(key, { value, expiresAt, tags: tagSet });

    // Index key under each tag for instant group invalidation
    for (const tag of tagSet) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag).add(key);
    }

    return true;
  }

  /**
   * Get value by key. Returns null if not found or expired.
   */
  get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.del(key);
      this.misses++;
      return null;
    }

    // Refresh position for LRU
    this.store.delete(key);
    this.store.set(key, entry);

    this.hits++;
    return entry.value;
  }

  /**
   * Check if valid key exists
   */
  has(key) {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.del(key);
      return false;
    }
    return true;
  }

  /**
   * Delete single key
   */
  del(key) {
    this._removeKeyFromTags(key);
    return this.store.delete(key);
  }

  /**
   * Invalidate all keys associated with one or more tags
   */
  invalidateTags(tags) {
    const tagList = Array.isArray(tags) ? tags : [tags];
    let removedCount = 0;

    for (const tag of tagList) {
      const keySet = this.tagIndex.get(tag);
      if (keySet) {
        for (const key of keySet) {
          this.store.delete(key);
          removedCount++;
        }
        this.tagIndex.delete(tag);
      }
    }

    return removedCount;
  }

  /**
   * Helper: cache wrap function
   */
  async wrap(key, fetchFn, ttlSeconds = 300, tags = []) {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const fresh = await fetchFn();
    if (fresh !== undefined && fresh !== null) {
      this.set(key, fresh, ttlSeconds, tags);
    }
    return fresh;
  }

  /**
   * Internal helper to clean up tag mappings
   */
  _removeKeyFromTags(key) {
    const entry = this.store.get(key);
    if (entry && entry.tags) {
      for (const tag of entry.tags) {
        const set = this.tagIndex.get(tag);
        if (set) {
          set.delete(key);
          if (set.size === 0) {
            this.tagIndex.delete(tag);
          }
        }
      }
    }
  }

  /**
   * Sweep and delete expired items
   */
  sweep() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.del(key);
      }
    }
  }

  /**
   * Clear all items
   */
  clear() {
    this.store.clear();
    this.tagIndex.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Cache telemetry
   */
  stats() {
    return {
      size: this.store.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRatio: this.hits + this.misses > 0 ? (this.hits / (this.hits + this.misses)).toFixed(3) : 0,
      tagsCount: this.tagIndex.size
    };
  }
}

// Global cache singleton
const cache = new MemoryCache(1500);

/**
 * Express middleware for caching JSON API responses
 * @param {number} ttlSeconds - Duration to cache in seconds
 * @param {string|string[]} tags - Tag(s) for automatic invalidation
 */
function cacheMiddleware(ttlSeconds = 300, tags = []) {
  return (req, res, next) => {
    // Only cache safe GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip cache for logged-in admin requests
    if (req.session && req.session.admin) {
      return next();
    }

    const key = `route:${req.originalUrl}`;
    const cached = cache.get(key);

    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}, stale-while-revalidate=60`);
      return res.status(cached.status || 200).json(cached.body);
    }

    res.setHeader('X-Cache', 'MISS');

    // Intercept res.json
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Only cache successful 200 responses
      if (res.statusCode >= 200 && res.statusCode < 300 && body && body.success !== false) {
        cache.set(key, { status: res.statusCode, body }, ttlSeconds, tags);
        res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}, stale-while-revalidate=60`);
      }
      return originalJson(body);
    };

    next();
  };
}

module.exports = {
  cache,
  cacheMiddleware
};
