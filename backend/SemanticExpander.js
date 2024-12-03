class SemanticExpander {
    static async getSynonyms(word, language = 'es') {
      try {
        const response = await fetch(`https://api.datamuse.com/words?ml=${word}&v=es`);
        const synonyms = await response.json();
        
        return synonyms
          .map(syn => syn.word)
          .filter(syn => syn !== word);
      } catch (error) {
        console.error('Error obteniendo sinónimos:', error);
        return [];
      }
    }
  
    static async expandQuery(query) {
      const words = query.split(/\s+/);
      const expandedWords = await Promise.all(
        words.map(async word => ({
          original: word,
          synonyms: await this.getSynonyms(word)
        }))
      );
  
      return {
        originalQuery: query,
        expandedQuery: expandedWords.flatMap(item => 
          [item.original, ...item.synonyms]
        ).join(' ')
      };
    }
  }
  
  module.exports = SemanticExpander;