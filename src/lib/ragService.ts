import { supabase } from './supabaseClient';

export interface Product {
  name: string;
  description: string;
  category: string;
  price: number;
  in_stock: boolean;
}

export interface RetrievalResult {
  products: Product[];
  searchTerms: string[];
  retrievalStrategy: string;
}

export interface RAGConfig {
  maxResults: number;
  minTermLength: number;
  maxTerms: number;
  enableSemanticSearch: boolean;
  contextWindowSize: number;
}

const DEFAULT_CONFIG: RAGConfig = {
  maxResults: 10,
  minTermLength: 2,
  maxTerms: 10,
  enableSemanticSearch: false, // Can be enhanced with embeddings later
  contextWindowSize: 4000, // Approximate token limit for context
};

export class RAGService {
  private config: RAGConfig;

  constructor(config: Partial<RAGConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Enhanced query preprocessing with intent detection
   */
  private preprocessQuery(query: string): {
    searchTerms: string[];
    intent: 'product_search' | 'comparison' | 'availability' | 'pricing' | 'general';
    entities: string[];
  } {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Extract search terms
    const searchTerms = normalizedQuery
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length >= this.config.minTermLength)
      .filter(term => !this.isStopWord(term))
      .slice(0, this.config.maxTerms);

    // Simple intent detection
    let intent: 'product_search' | 'comparison' | 'availability' | 'pricing' | 'general' = 'general';
    
    if (normalizedQuery.includes('compare') || normalizedQuery.includes('vs') || normalizedQuery.includes('versus')) {
      intent = 'comparison';
    } else if (normalizedQuery.includes('price') || normalizedQuery.includes('cost') || normalizedQuery.includes('$')) {
      intent = 'pricing';
    } else if (normalizedQuery.includes('available') || normalizedQuery.includes('stock') || normalizedQuery.includes('in stock')) {
      intent = 'availability';
    } else if (searchTerms.length > 0) {
      intent = 'product_search';
    }

    // Extract potential product entities (simple approach)
    const entities = searchTerms.filter(term => term.length > 3);

    return { searchTerms, intent, entities };
  }

  /**
   * Basic stop word filtering
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'what', 'where', 'when', 'why', 'how'
    ]);
    return stopWords.has(word);
  }

  /**
   * Multi-strategy retrieval with fallback mechanisms
   */
  async retrieveRelevantProducts(query: string): Promise<RetrievalResult> {
    const { searchTerms, intent, entities } = this.preprocessQuery(query);
    
    if (searchTerms.length === 0) {
      return {
        products: [],
        searchTerms: [],
        retrievalStrategy: 'no_terms'
      };
    }

    // Strategy 1: Exact phrase matching (highest priority)
    let products = await this.exactPhraseSearch(query);
    if (products.length > 0) {
      return {
        products: products.slice(0, this.config.maxResults),
        searchTerms,
        retrievalStrategy: 'exact_phrase'
      };
    }

    // Strategy 2: Multi-term OR search
    products = await this.multiTermSearch(searchTerms);
    if (products.length > 0) {
      return {
        products: products.slice(0, this.config.maxResults),
        searchTerms,
        retrievalStrategy: 'multi_term'
      };
    }

    // Strategy 3: Single term fallback
    products = await this.singleTermFallback(searchTerms);
    return {
      products: products.slice(0, this.config.maxResults),
      searchTerms,
      retrievalStrategy: 'single_term_fallback'
    };
  }

  /**
   * Exact phrase search for high precision
   */
  private async exactPhraseSearch(query: string): Promise<Product[]> {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('name, description, category, price, in_stock')
        .textSearch('fts', `"${query}"`)
        .limit(this.config.maxResults);

      if (error) {
        console.error('Exact phrase search error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Exact phrase search exception:', error);
      return [];
    }
  }

  /**
   * Multi-term OR search for broader coverage
   */
  private async multiTermSearch(searchTerms: string[]): Promise<Product[]> {
    try {
      const searchQuery = searchTerms.join(' | ');
      
      const { data, error } = await supabase
        .from('products')
        .select('name, description, category, price, in_stock')
        .textSearch('fts', searchQuery)
        .limit(this.config.maxResults * 2); // Get more for ranking

      if (error) {
        console.error('Multi-term search error:', error);
        return [];
      }

      // Simple relevance scoring based on term matches
      const scoredProducts = (data || []).map(product => {
        const productText = `${product.name} ${product.description} ${product.category}`.toLowerCase();
        const matchCount = searchTerms.filter(term => productText.includes(term)).length;
        return { ...product, relevanceScore: matchCount };
      });

      // Sort by relevance and return
      return scoredProducts
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .map(({ relevanceScore, ...product }) => product);
    } catch (error) {
      console.error('Multi-term search exception:', error);
      return [];
    }
  }

  /**
   * Single term fallback for maximum recall
   */
  private async singleTermFallback(searchTerms: string[]): Promise<Product[]> {
    try {
      // Try each term individually and combine results
      const allResults: Product[] = [];
      
      for (const term of searchTerms.slice(0, 3)) { // Limit to first 3 terms
        const { data, error } = await supabase
          .from('products')
          .select('name, description, category, price, in_stock')
          .textSearch('fts', term)
          .limit(5);

        if (!error && data) {
          allResults.push(...data);
        }
      }

      // Remove duplicates based on name
      const uniqueProducts = allResults.filter((product, index, self) =>
        index === self.findIndex(p => p.name === product.name)
      );

      return uniqueProducts;
    } catch (error) {
      console.error('Single term fallback exception:', error);
      return [];
    }
  }

  /**
   * Format products for context injection with token management
   */
  formatProductsForContext(products: Product[]): string {
    if (!products || products.length === 0) {
      return '';
    }

    let context = '\n**Available Product Information:**\n';
    let currentLength = context.length;
    const maxLength = this.config.contextWindowSize;

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const productText = `${i + 1}. **${product.name}**
   - Description: ${product.description}
   - Category: ${product.category}
   - Price: $${product.price}
   - In Stock: ${product.in_stock ? 'Yes' : 'No'}\n\n`;

      if (currentLength + productText.length > maxLength) {
        context += `... (${products.length - i} more products available)\n`;
        break;
      }

      context += productText;
      currentLength += productText.length;
    }

    return context + '---\n';
  }

  /**
   * Get retrieval analytics for monitoring
   */
  getRetrievalAnalytics(result: RetrievalResult): {
    productCount: number;
    strategy: string;
    searchTermCount: number;
    hasResults: boolean;
  } {
    return {
      productCount: result.products.length,
      strategy: result.retrievalStrategy,
      searchTermCount: result.searchTerms.length,
      hasResults: result.products.length > 0
    };
  }
}

// Export singleton instance
export const ragService = new RAGService();
