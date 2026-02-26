// src/services/RegistryManager.js

/**
 * Global Registry Manager - Singleton to manage shared game resources
 * Provides centralized access to resources like the llmEngine with robust recovery mechanisms
 */
class RegistryManager {
    constructor() {
        this.resources = new Map();
        
        // Flag to track if the manager has been initialized
        this._initialized = false;
    }

    /**
     * Initialize with any game-wide registry references
     * @param {Phaser.Registry} registry - The game's registry object
     */
    init(registry) {
        if (this._initialized) return;
        
        // Store registry reference for any scene-based operations
        this._registry = registry;
        
        // Try to load engine from window/registry 
        if (window.llmEngine) {
            this.set('llmEngine', window.llmEngine);
            console.log("Registry Manager: Loaded llmEngine from window");
        } else if (registry && registry.get('llmEngine')) {
            this.set('llmEngine', registry.get('llmEngine'));
            console.log("Registry Manager: Loaded llmEngine from registry");
        }
        
        this._initialized = true;
        console.log("Registry Manager initialized");
    }

    /**
     * Get a resource with fallback/recovery options
     * @param {string} key - The resource key
     * @param {*} fallbackValue - Optional fallback value if resource is not found
     * @returns {*} The requested resource or fallback value
     */
    get(key, fallbackValue = null) {
        // First check our internal map
        if (this.resources.has(key)) {
            return this.resources.get(key);
        }

        // Try to recover engine if that's what's being requested
        if (key === 'llmEngine') {
            return this.recoverEngine() || fallbackValue;
        }

        return fallbackValue;
    }

    /**
     * Create or get the LLM engine (async).
     * If already loaded, returns it. Otherwise, loads and stores it.
     * Uses WebLLM on desktop (throws error if fails), Transformers.js on mobile (fallback).
     * @returns {Promise<Object>} The LLM engine instance
     */
    async createOrGetEngine() {
        if (this.resources.has('llmEngine')) {
            return this.resources.get('llmEngine');
        }
        if (this._enginePromise) {
            return this._enginePromise;
        }
        this._enginePromise = (async () => {
            // Detect mobile device
            const isMobile = /android|iphone|ipad|ipod|mobile|blackberry|iemobile|opera mini/i.test(navigator.userAgent) 
                           || window.screen.width < 900;
            
            if (!isMobile) {
                // Desktop: ALWAYS use WebLLM (throw error if it fails)
                console.log("Desktop detected - loading WebLLM (required)");
                return await this._loadWebLLMEngine();
            } else {
                // Mobile: Use Transformers.js as fallback
                console.log("Mobile detected - loading Transformers.js for compatibility");
                return await this._loadTransformersJSEngine();
            }
        })();
        return this._enginePromise;
    }
    
    /**
     * Load WebLLM engine (requires WebGPU)
     * @private
     */
    async _loadWebLLMEngine() {
        const WebLLM = await import('https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm');
        const { CreateMLCEngine } = WebLLM;
        
        // Use Qwen2.5-1.5B-Instruct - a larger model (3x the size of 0.5B)
        // Using the pre-configured model from WebLLM's model list
        //const model_id = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";
        const model_id = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
        
        const llmEngine = await CreateMLCEngine(model_id, {
            logLevel: "INFO",
        });
        console.log("WebLLM engine loaded successfully");
        this.set('llmEngine', llmEngine);
        return llmEngine;
    }
    
    /**
     * Load Transformers.js engine (WASM fallback, no WebGPU required)
     * @private
     */
    async _loadTransformersJSEngine() {
        // Import Transformers.js
        const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
        
        // Configure environment for WASM
        env.allowLocalModels = false;
        env.allowRemoteModels = true;
        env.backends.onnx.wasm.numThreads = 4;
        env.backends.onnx.wasm.simd = true;
        
        // Load Qwen model
        console.log("Loading Qwen2-1.5B-Instruct model with Transformers.js...");
        const generator = await pipeline(
            'text-generation',
            'Xenova/Qwen2-1.5B-Instruct',
            { quantized: true }
        );
        
        console.log("Transformers.js engine loaded successfully");
        
        // Create a wrapper to match the expected API
        const llmEngine = {
            chat: {
                completions: {
                    create: async (options) => {
                        const { 
                            messages, 
                            max_tokens = 5, 
                            temperature = 0.2,
                            top_logprobs = 5
                        } = options;
                        
                        // Extract the last user message
                        const userMessage = messages.find(m => m.role === 'user')?.content || '';
                        
                        // Generate text
                        const result = await generator(userMessage, {
                            max_new_tokens: max_tokens,
                            temperature: temperature,
                            do_sample: temperature > 0,
                            return_full_text: false,
                            num_return_sequences: 1
                        });
                        
                        // Extract generated text
                        const generatedText = result[0].generated_text.trim();
                        
                        // Split into words and create logprobs structure
                        const words = generatedText.split(/\s+/).filter(w => w.length > 0);
                        const topWords = words.slice(0, top_logprobs);
                        
                        // Create a response structure that matches the expected format
                        return {
                            choices: [{
                                logprobs: {
                                    content: [{
                                        top_logprobs: topWords.map((token, index) => ({
                                            token: token,
                                            logprob: -0.1 - (index * 0.05)
                                        }))
                                    }]
                                }
                            }]
                        };
                    }
                }
            },
            // Store the pipeline for direct access if needed
            pipeline: generator
        };
        
        this.set('llmEngine', llmEngine);
        return llmEngine;
    }

    /**
     * Set a resource value
     * @param {string} key - The resource key
     * @param {*} value - The resource value
     * @returns {*} The value that was set
     */
    set(key, value) {
        this.resources.set(key, value);

        // Also set in Phaser registry if possible
        if (this._registry && key === 'llmEngine') {
            this._registry.set(key, value);
        }

        return value;
    }

    /**
     * Special method for engine recovery
     * @returns {Object|null} The recovered engine or null
     */
    recoverEngine() {
        // Try Phaser registry
        if (this._registry && this._registry.get('llmEngine')) {
            console.log("Registry Manager: Recovered llmEngine from registry");
            this.set('llmEngine', this._registry.get('llmEngine'));
            return this._registry.get('llmEngine');
        }

        console.warn("Registry Manager: Engine recovery failed - no backup found");
        return null;
    }

    /**
     * Attempt to reinitialize the engine specifically
     * @param {Function} callback - Optional callback when recovery succeeds
     */
    attemptEngineRecovery(callback) {
        console.log("Registry Manager: Attempting engine recovery...");
        
        // Try immediate recovery
        const engine = this.recoverEngine();
        if (engine && typeof engine === 'function') {
            console.log("Registry Manager: Immediate recovery successful");
            if (callback && typeof callback === 'function') {
                try {
                    callback(engine);
                } catch (error) {
                    console.error("Registry Manager: Error in recovery callback:", error);
                }
            }
            return engine;
        }
        
        // Set up retries with better timing
        const maxRetries = 5;
        let currentRetry = 0;
        
        const attemptRecovery = () => {
            currentRetry++;
            console.log(`Registry Manager: Recovery attempt ${currentRetry}/${maxRetries}`);
            
            const recoveredEngine = this.recoverEngine();
            
            if (recoveredEngine && typeof recoveredEngine === 'function') {
                console.log("Registry Manager: Engine recovery successful on attempt", currentRetry);
                if (callback && typeof callback === 'function') {
                    try {
                        setTimeout(() => {
                            callback(recoveredEngine);
                        }, 10);
                    } catch (error) {
                        console.error("Registry Manager: Error in recovery callback:", error);
                    }
                }
                return recoveredEngine;
            }
            
            if (currentRetry >= maxRetries) {
                console.error("Registry Manager: Engine recovery failed after", maxRetries, "attempts");
                return null;
            }
            
            const delay = Math.min(100 * Math.pow(2, currentRetry - 1), 1600);
            console.log(`Registry Manager: Retrying in ${delay}ms...`);
            setTimeout(attemptRecovery, delay);
            return null;
        };
        
        setTimeout(attemptRecovery, 100);
        return null;
    }

    /**
     * Clear a specific resource or all resources
     * @param {string|null} key - The resource key to clear, or null to clear all
     */
    clear(key = null) {
        if (key) {
            this.resources.delete(key);
        } else {
            this.resources.clear();
        }
    }
}

// Create and export the singleton instance
const registryManager = new RegistryManager();
export default registryManager;
