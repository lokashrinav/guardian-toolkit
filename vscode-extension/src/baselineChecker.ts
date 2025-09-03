import axios from 'axios';

export interface BaselineResult {
    found: boolean;
    feature: string;
    name?: string;
    description?: string;
    safety: 'safe' | 'caution' | 'unsafe';
    baseline?: string;
    baselineLowDate?: string;
    baselineHighDate?: string;
    support?: { [browser: string]: string };
    recommendation?: string;
    spec?: string;
    group?: string;
    suggestions?: string[];
}

export class BaselineChecker {
    private apiEndpoint: string;
    private cache: Map<string, BaselineResult> = new Map();
    private cacheTimeout = 5 * 60 * 1000; // 5 minutes

    constructor(apiEndpoint: string) {
        this.apiEndpoint = apiEndpoint;
    }

    async checkFeature(featureName: string): Promise<BaselineResult> {
        const normalizedName = featureName.toLowerCase().trim();
        
        // Check cache first
        const cached = this.cache.get(normalizedName);
        if (cached) {
            return cached;
        }

        try {
            const response = await axios.post(
                `${this.apiEndpoint}/isSafe`,
                { feature: normalizedName },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000
                }
            );

            const result: BaselineResult = {
                found: response.data.found,
                feature: response.data.feature,
                name: response.data.name,
                description: response.data.description,
                safety: response.data.safety,
                baseline: response.data.baseline,
                baselineLowDate: response.data.baselineLowDate,
                baselineHighDate: response.data.baselineHighDate,
                support: response.data.support,
                recommendation: response.data.recommendation,
                spec: response.data.spec,
                group: response.data.group,
                suggestions: response.data.suggestions
            };

            // Cache the result
            this.cache.set(normalizedName, result);
            setTimeout(() => {
                this.cache.delete(normalizedName);
            }, this.cacheTimeout);

            return result;

        } catch (error) {
            console.error(`Error checking feature ${featureName}:`, error);
            
            // Return fallback result
            return {
                found: false,
                feature: normalizedName,
                safety: 'unsafe',
                recommendation: 'Unable to verify feature safety - connection error'
            };
        }
    }

    async batchCheckFeatures(features: string[]): Promise<BaselineResult[]> {
        const results = await Promise.all(
            features.map(feature => this.checkFeature(feature))
        );
        return results;
    }

    clearCache(): void {
        this.cache.clear();
    }

    getCacheSize(): number {
        return this.cache.size;
    }
}