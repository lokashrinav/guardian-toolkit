import axios from 'axios';
import { marked } from 'marked';

export interface KnowledgeItem {
  id: string;
  content: string;
  source: string;
  feature?: string;
  category: 'spec' | 'guide' | 'compatibility' | 'example';
  lastUpdated: Date;
  embeddings?: number[]; // Would normally use a vector database
}

export class RAGKnowledgeBase {
  private knowledge: KnowledgeItem[] = [];
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('📚 Initializing Baseline knowledge base...');
    
    // Load core Baseline knowledge
    await this.loadBaselineKnowledge();
    
    // Load web feature documentation
    await this.loadWebFeaturesDocs();
    
    // Load compatibility examples
    await this.loadCompatibilityExamples();
    
    this.initialized = true;
    console.log(`✅ Knowledge base initialized with ${this.knowledge.length} items`);
  }

  async queryKnowledge(query: string, limit = 5): Promise<KnowledgeItem[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Simple keyword-based search (in production would use vector similarity)
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(' ').filter(word => word.length > 2);
    
    const scored = this.knowledge.map(item => {
      const contentLower = item.content.toLowerCase();
      let score = 0;
      
      // Score based on keyword matches
      keywords.forEach(keyword => {
        const matches = (contentLower.match(new RegExp(keyword, 'g')) || []).length;
        score += matches;
        
        // Bonus for feature matches
        if (item.feature && item.feature.toLowerCase().includes(keyword)) {
          score += 5;
        }
        
        // Bonus for exact phrase matches
        if (contentLower.includes(queryLower)) {
          score += 10;
        }
      });
      
      return { item, score };
    });
    
    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.item);
  }

  private async loadBaselineKnowledge(): Promise<void> {
    const baselineKnowledge: Omit<KnowledgeItem, 'id' | 'lastUpdated'>[] = [
      {
        content: `Baseline is a web compatibility initiative that helps developers understand when web platform features are safe to use. A feature is considered "Baseline" when it's supported across all major browsers with good interoperability.

        Key concepts:
        - Baseline "low": Feature is newly available across all major browsers
        - Baseline "high": Feature has been widely available for 30+ months
        - Non-Baseline: Feature lacks consistent support across browsers`,
        source: 'Baseline Definition',
        category: 'guide',
        feature: 'baseline'
      },
      
      {
        content: `CSS Grid Layout provides a two-dimensional grid-based layout system. It has Baseline "high" support, meaning it's safe to use in production.

        Browser support:
        - Chrome: 57+ (2017)
        - Firefox: 52+ (2017) 
        - Safari: 10.1+ (2017)
        - Edge: 16+ (2017)

        Best practices:
        - Use grid for complex layouts
        - Consider flexbox fallback for older browsers if needed
        - Test with CSS Grid Inspector tools`,
        source: 'CSS Grid Documentation',
        category: 'spec',
        feature: 'grid'
      },

      {
        content: `The Fetch API provides a modern interface for making HTTP requests. It has Baseline "high" support but may need polyfills for older environments.

        Browser support:
        - Chrome: 42+ (2015)
        - Firefox: 39+ (2015)
        - Safari: 10.1+ (2017)
        - Edge: 14+ (2016)

        Fallback strategies:
        - Check for fetch availability: typeof fetch !== 'undefined'
        - Use XMLHttpRequest as fallback
        - Consider fetch polyfill for older browsers`,
        source: 'Fetch API Documentation',
        category: 'spec',
        feature: 'fetch'
      },

      {
        content: `Container Queries allow you to style elements based on their container's size rather than the viewport. This feature has recently achieved Baseline "high" status.

        Browser support:
        - Chrome: 105+ (2022)
        - Firefox: 110+ (2023)
        - Safari: 16+ (2022)
        - Edge: 105+ (2022)

        Usage:
        .container {
          container-type: inline-size;
        }
        
        @container (min-width: 300px) {
          .element { /* styles */ }
        }`,
        source: 'Container Queries Guide',
        category: 'guide',
        feature: 'container-queries'
      },

      {
        content: `The :has() CSS pseudo-class selects elements that contain elements matching a given selector. This is a powerful but newer feature.

        Current status: Baseline "low" (newly available)
        
        Browser support:
        - Chrome: 105+ (2022)
        - Firefox: 121+ (2023)  
        - Safari: 15.4+ (2022)
        - Edge: 105+ (2022)

        Considerations:
        - Performance: :has() can be expensive, use judiciously
        - Fallbacks: Consider JavaScript alternatives for older browsers
        - Progressive enhancement: Use @supports rule when possible`,
        source: ':has() Selector Guide',
        category: 'guide',
        feature: 'has-selector'
      }
    ];

    baselineKnowledge.forEach(kb => {
      this.knowledge.push({
        ...kb,
        id: this.generateId(),
        lastUpdated: new Date()
      });
    });
  }

  private async loadWebFeaturesDocs(): Promise<void> {
    // In production, this would fetch from web-features or MDN API
    const webFeatures = [
      {
        content: `Flexbox (Flexible Box Layout) is a one-dimensional layout method for arranging items in rows or columns. It has excellent Baseline support.

        Key properties:
        - display: flex | inline-flex
        - flex-direction: row | column | row-reverse | column-reverse
        - justify-content: flex-start | center | space-between | space-around
        - align-items: stretch | center | flex-start | flex-end
        
        Browser support: Universal (Baseline "high" since 2018)`,
        source: 'Flexbox Documentation',
        category: 'spec',
        feature: 'flexbox'
      },
      
      {
        content: `The HTML dialog element represents a dialog box or other interactive component. It's now Baseline with good browser support.

        Browser support:
        - Chrome: 37+ (2014)
        - Firefox: 98+ (2022)
        - Safari: 15.4+ (2022)
        - Edge: 79+ (2020)

        Usage:
        <dialog id="myDialog">
          <p>Dialog content</p>
          <button onclick="document.getElementById('myDialog').close()">Close</button>
        </dialog>

        JavaScript:
        dialog.showModal(); // Show as modal
        dialog.show(); // Show as non-modal`,
        source: 'Dialog Element Guide',
        category: 'spec',
        feature: 'dialog'
      }
    ];

    webFeatures.forEach(feature => {
      this.knowledge.push({
        ...feature,
        id: this.generateId(),
        lastUpdated: new Date()
      });
    });
  }

  private async loadCompatibilityExamples(): Promise<void> {
    const examples = [
      {
        content: `Progressive Enhancement Example for CSS Grid:

        /* Start with flexbox fallback */
        .layout {
          display: flex;
          flex-wrap: wrap;
        }

        /* Enhance with grid where supported */
        @supports (display: grid) {
          .layout {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
          }
        }

        This approach ensures the layout works everywhere while providing the best experience in modern browsers.`,
        source: 'Progressive Enhancement Examples',
        category: 'example',
        feature: 'grid'
      },

      {
        content: `Fetch API with Fallback:

        function makeRequest(url) {
          if (typeof fetch !== 'undefined') {
            return fetch(url).then(response => response.json());
          } else {
            // XMLHttpRequest fallback
            return new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('GET', url);
              xhr.onload = () => resolve(JSON.parse(xhr.responseText));
              xhr.onerror = () => reject(xhr.statusText);
              xhr.send();
            });
          }
        }

        This pattern ensures network requests work across all browsers.`,
        source: 'Fetch Fallback Examples',
        category: 'example',
        feature: 'fetch'
      },

      {
        content: `Container Queries with Feature Detection:

        .card {
          /* Base styles */
          padding: 1rem;
        }

        /* Only apply container queries if supported */
        @supports (container-type: inline-size) {
          .container {
            container-type: inline-size;
          }
          
          @container (min-width: 300px) {
            .card {
              padding: 2rem;
              display: flex;
            }
          }
        }

        Always wrap container queries in @supports for better compatibility.`,
        source: 'Container Queries Examples',
        category: 'example',
        feature: 'container-queries'
      }
    ];

    examples.forEach(example => {
      this.knowledge.push({
        ...example,
        id: this.generateId(),
        lastUpdated: new Date()
      });
    });
  }

  async updateKnowledgeBase(): Promise<void> {
    console.log('🔄 Updating knowledge base...');
    
    // In production, this would fetch latest data from:
    // - web-features npm package
    // - MDN API
    // - Can I Use API
    // - Baseline status updates
    
    // For now, we'll just refresh the timestamp
    this.knowledge.forEach(item => {
      item.lastUpdated = new Date();
    });
    
    console.log('✅ Knowledge base updated');
  }

  getKnowledgeSummary() {
    const summary = {
      totalItems: this.knowledge.length,
      categories: {} as Record<string, number>,
      features: {} as Record<string, number>,
      lastUpdated: new Date()
    };

    this.knowledge.forEach(item => {
      summary.categories[item.category] = (summary.categories[item.category] || 0) + 1;
      if (item.feature) {
        summary.features[item.feature] = (summary.features[item.feature] || 0) + 1;
      }
    });

    return summary;
  }

  private generateId(): string {
    return `kb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // For testing - add custom knowledge
  addKnowledge(item: Omit<KnowledgeItem, 'id' | 'lastUpdated'>): void {
    this.knowledge.push({
      ...item,
      id: this.generateId(),
      lastUpdated: new Date()
    });
  }

  // For testing - clear knowledge base
  clearKnowledge(): void {
    this.knowledge = [];
  }
}