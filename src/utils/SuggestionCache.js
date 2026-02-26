/**
 * Simple LRU cache for AI suggestions to avoid redundant LLM calls
 */
export class SuggestionCache {
    constructor(maxSize = 50) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }
    
    /**
     * Generate a cache key from input context
     */
    generateKey(prompt, context) {
        // Create a simple hash of prompt + context
        return `${prompt.substring(0, 50)}|${context.trim()}`;
    }
    
    /**
     * Get cached suggestions if available
     */
    get(prompt, context) {
        const key = this.generateKey(prompt, context);
        const cached = this.cache.get(key);
        
        if (cached) {
            // Move to end (most recently used)
            this.cache.delete(key);
            this.cache.set(key, cached);
            return cached.suggestions;
        }
        
        return null;
    }
    
    /**
     * Store suggestions in cache
     */
    set(prompt, context, suggestions) {
        const key = this.generateKey(prompt, context);
        
        // Remove oldest entry if at capacity
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, {
            suggestions,
            timestamp: Date.now()
        });
    }
    
    /**
     * Clear the cache
     */
    clear() {
        this.cache.clear();
    }
}
