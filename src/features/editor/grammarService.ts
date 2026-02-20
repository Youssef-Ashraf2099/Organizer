/**
 * Grammar and Spell Checking Service
 * Provides text suggestions, grammar corrections, and autocomplete
 */

export interface GrammarSuggestion {
  type: "spelling" | "grammar" | "style";
  message: string;
  replacements: string[];
  offset: number;
  length: number;
  context: string;
}

export interface AutocompleteSuggestion {
  text: string;
  description?: string;
  category: "word" | "phrase" | "template";
}

class GrammarService {
  private dictionary: Set<string> = new Set([
    "the",
    "be",
    "to",
    "of",
    "and",
    "a",
    "in",
    "that",
    "have",
    "it",
    "for",
    "not",
    "on",
    "with",
    "he",
    "as",
    "you",
    "do",
    "at",
    "this",
    "but",
    "his",
    "by",
    "from",
    "they",
    "we",
    "say",
    "her",
    "she",
    "or",
    "an",
    "will",
    "my",
    "one",
    "all",
    "would",
    "there",
    "their",
    "what",
    "so",
    "up",
    "out",
    "if",
    "about",
    "who",
    "get",
    "which",
    "go",
    "me",
    "when",
    "make",
    "can",
    "like",
    "time",
    "no",
    "just",
    "him",
    "know",
    "take",
    "people",
    "into",
    "year",
    "your",
    "good",
    "some",
    "could",
    "them",
    "see",
    "other",
    "than",
    "then",
    "now",
    "look",
    "only",
    "come",
    "its",
    "over",
    "think",
    "also",
    "back",
    "after",
    "use",
    "two",
    "how",
    "our",
    "work",
    "first",
    "well",
    "way",
    "even",
    "new",
    "want",
    "because",
    "any",
    "these",
    "give",
    "day",
    "most",
    "us",
    "is",
    "was",
    "are",
    "been",
    "has",
    "had",
    "were",
    "said",
    "did",
    "having",
    "may",
    "should",
    "could",
    "would",
    "might",
    "must",
    "can",
    "will",
    "shall",
    "technology",
    "system",
    "security",
    "framework",
    "decentralized",
    "blockchain",
    "autonomous",
    "communication",
    "control",
    "design",
    "implement",
    "proof",
    "concept",
    "identity",
    "management",
    "tangle",
    "enhance",
    "scalability",
    "privacy",
    "resource",
    "constrained",
    "device",
    "paper",
    "research",
    "IoT",
    "solutions",
    "Bitcoin",
    "Ethereum",
    "vulnerabilities",
    "centralized",
    "bottlenecks",
    "exponential",
    "growth",
    "billions",
    "performance",
    "degradation",
    "interaction",
    "establish",
    "trust",
    "spontaneously",
    "unknown",
    "peers",
    "dynamic",
    "environments",
    "external",
    "oversight",
    "pre-established",
    "anchors",
    "introduce",
    "lightweight",
    "fully",
    "fine-grained",
    "access",
    "without",
  ]);

  private commonPhrases: Map<string, string[]> = new Map([
    ["how", ["how to", "however", "how much", "how many", "how are you"]],
    ["what", ["what is", "what are", "whatever", "what if", "what about"]],
    ["when", ["when is", "when are", "whenever", "when will", "when to"]],
    ["where", ["where is", "where are", "wherever", "where to", "where can"]],
    ["why", ["why is", "why are", "why not", "why would", "why do"]],
    ["can", ["can be", "can you", "can we", "cannot", "can I"]],
    [
      "should",
      ["should be", "should have", "should not", "should we", "should I"],
    ],
    [
      "would",
      ["would be", "would have", "would like", "would you", "would not"],
    ],
    ["could", ["could be", "could have", "could you", "could not", "could we"]],
  ]);

  private spellingRules: Map<string, string> = new Map([
    // Common misspellings
    ["recieve", "receive"],
    ["occured", "occurred"],
    ["seperate", "separate"],
    ["definately", "definitely"],
    ["occassion", "occasion"],
    ["accomodate", "accommodate"],
    ["acheive", "achieve"],
    ["beleive", "believe"],
    ["existance", "existence"],
    ["goverment", "government"],
    ["independant", "independent"],
    ["minature", "miniature"],
    ["neccessary", "necessary"],
    ["noticable", "noticeable"],
    ["occurance", "occurrence"],
    ["perseverance", "perseverance"],
    ["priviledge", "privilege"],
    ["publically", "publicly"],
    ["reccommend", "recommend"],
    ["refered", "referred"],
    ["relevent", "relevant"],
    ["suprise", "surprise"],
    ["thier", "their"],
    ["wierd", "weird"],
    ["untill", "until"],
    ["succesful", "successful"],
    ["adress", "address"],
    ["appearence", "appearance"],
    ["arguement", "argument"],
    ["begining", "beginning"],
    ["bussiness", "business"],
    ["calender", "calendar"],
    ["catagory", "category"],
    ["cemetary", "cemetery"],
    ["changable", "changeable"],
    ["collegue", "colleague"],
    ["comming", "coming"],
    ["committment", "commitment"],
    ["concious", "conscious"],
    ["definate", "definite"],
    ["discription", "description"],
    ["embarass", "embarrass"],
    ["enviroment", "environment"],
    ["exagerate", "exaggerate"],
    ["experiance", "experience"],
    ["familar", "familiar"],
    ["finaly", "finally"],
    ["foriegn", "foreign"],
    ["fourty", "forty"],
    ["freind", "friend"],
    ["gratefull", "grateful"],
    ["gaurd", "guard"],
    ["harrass", "harass"],
    ["heirarchy", "hierarchy"],
    ["humourous", "humorous"],
    ["immediatly", "immediately"],
    ["incidently", "incidentally"],
    ["independance", "independence"],
    ["interupt", "interrupt"],
    ["jewellry", "jewelry"],
    ["judgement", "judgment"],
    ["liason", "liaison"],
    ["libary", "library"],
    ["lisence", "license"],
    ["maintainance", "maintenance"],
    ["medecine", "medicine"],
    ["millenium", "millennium"],
    ["mischievious", "mischievous"],
    ["occured", "occurred"],
  ]);

  private grammarPatterns: Array<{
    pattern: RegExp;
    message: string;
    suggestion?: string;
    replacements?: (match: RegExpMatchArray) => string[];
  }> = [
    // Capitalization
    {
      pattern: /(?:^|[.!?]\s+)([a-z])/g,
      message: "Sentence should start with a capital letter",
      replacements: (match) => [match[1].toUpperCase()],
    },
    {
      pattern: /\bi\b(?!\s*['']m|\s*['']ll|\s*['']ve|\s*['']d)/g,
      message: "The pronoun 'I' should be capitalized",
      suggestion: "I",
    },

    // Article errors (a/an)
    {
      pattern: /\b(a)\s+([aeiouAEIOU])/g,
      message: "Use 'an' before words starting with a vowel sound",
      replacements: (match) => [`an ${match[2]}`],
    },
    {
      pattern:
        /\b(an)\s+([bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ](?!hour|honest|honor))/g,
      message: "Use 'a' before words starting with a consonant sound",
      replacements: (match) => [`a ${match[2]}`],
    },

    // Common confusions
    {
      pattern: /\b(your)\s+(going|welcome|the|best|right|wrong|sure|ready)\b/gi,
      message:
        "Did you mean 'you're' (you are) instead of 'your' (possessive)?",
      replacements: (match) => ["you're " + match[2]],
    },
    {
      pattern:
        /\b(you're)\s+(car|house|book|name|friend|idea|problem|work|job|life)\b/gi,
      message:
        "Did you mean 'your' (possessive) instead of 'you're' (you are)?",
      replacements: (match) => ["your " + match[2]],
    },
    {
      pattern: /\b(its)\s+(a|the|been|going|not|very|important)\b/gi,
      message: "Did you mean 'it's' (it is/has) instead of 'its' (possessive)?",
      replacements: (match) => ["it's " + match[2]],
    },
    {
      pattern: /\b(it's)\s+(own|purpose|meaning|value|function|role)\b/gi,
      message: "Did you mean 'its' (possessive) instead of 'it's' (it is/has)?",
      replacements: (match) => ["its " + match[2]],
    },
    {
      pattern: /\b(their)\s+(is|are|was|were|has|have|going)\b/gi,
      message: "Did you mean 'there' (location) or 'they're' (they are)?",
      replacements: (match) => {
        const verb = match[2].toLowerCase();
        if (["is", "was", "has"].includes(verb)) return ["there " + match[2]];
        if (["are", "were", "have", "going"].includes(verb))
          return ["they're " + match[2], "there " + match[2]];
        return [];
      },
    },
    {
      pattern: /\b(there)\s+(car|house|book|problem|solution|approach)\b/gi,
      message: "Did you mean 'their' (possessive)?",
      replacements: (match) => ["their " + match[2]],
    },

    // Double words
    {
      pattern: /\b(\w+)\s+\1\b/gi,
      message: "Possible duplicate word",
      replacements: (match) => [match[1]],
    },

    // Multiple spaces
    {
      pattern: /\s{2,}/g,
      message: "Multiple consecutive spaces",
      suggestion: " ",
    },

    // Comma splices
    {
      pattern:
        /,\s*(?:however|therefore|moreover|furthermore|nevertheless|thus)\s*,/gi,
      message: "Consider using a semicolon before transitional words",
      replacements: (match) => {
        const word = match[0].split(",")[1].trim().split(",")[0];
        return ["; " + word + ","];
      },
    },

    // Missing comma after introductory phrase
    {
      pattern:
        /^(However|Therefore|Moreover|Furthermore|Nevertheless|Thus|Meanwhile|Additionally)\s+([a-z])/gim,
      message: "Consider adding a comma after introductory word",
      replacements: (match) => [match[1] + ", " + match[2]],
    },

    // Passive voice indicators
    {
      pattern: /\b(is|are|was|were|be|been|being)\s+(\w+ed)\b/gi,
      message: "Consider using active voice for more direct writing",
      replacements: () => [],
    },

    // Could of / should of / would of
    {
      pattern: /\b(could|should|would|might|must)\s+of\b/gi,
      message: "Did you mean 'have' instead of 'of'?",
      replacements: (match) => [match[1] + " have"],
    },

    // Affect vs Effect
    {
      pattern: /\b(affect)\s+(the|this|that|my|your|his|her|its|our|their)\b/gi,
      message: "Did you mean 'effect' (noun) instead of 'affect' (verb)?",
      replacements: (match) => ["effect " + match[2]],
    },

    // Then vs Than
    {
      pattern:
        /\b(better|worse|more|less|greater|smaller|higher|lower)\s+then\b/gi,
      message: "Use 'than' for comparisons",
      replacements: (match) => [match[1] + " than"],
    },
    {
      pattern: /\band\s+then\s+(he|she|it|they|we|I)\b/gi,
      message: "Correct usage of 'then' for time sequence",
      replacements: () => [],
    },

    // Lose vs Loose
    {
      pattern:
        /\b(loose)\s+(the|my|your|his|her|its|our|their)\s+(game|match|race|battle|war|argument)\b/gi,
      message:
        "Did you mean 'lose' (opposite of win) instead of 'loose' (not tight)?",
      replacements: (match) => ["lose " + match[2] + " " + match[3]],
    },

    // Incomplete sentence
    {
      pattern: /^[A-Z][a-z]+\s+[a-z]+\.$/gm,
      message: "This might be a sentence fragment",
      replacements: () => [],
    },

    // Missing apostrophe in contractions
    {
      pattern:
        /\b(dont|doesnt|didnt|wont|cant|shouldnt|wouldnt|couldnt|isnt|arent|wasnt|werent|havent|hasnt|hadnt)\b/gi,
      message: "Missing apostrophe in contraction",
      replacements: (match) => {
        const word = match[0].toLowerCase();
        const corrections: Record<string, string> = {
          dont: "don't",
          doesnt: "doesn't",
          didnt: "didn't",
          wont: "won't",
          cant: "can't",
          shouldnt: "shouldn't",
          wouldnt: "wouldn't",
          couldnt: "couldn't",
          isnt: "isn't",
          arent: "aren't",
          wasnt: "wasn't",
          werent: "weren't",
          havent: "haven't",
          hasnt: "hasn't",
          hadnt: "hadn't",
        };
        return corrections[word] ? [corrections[word]] : [];
      },
    },

    // Too vs To
    {
      pattern:
        /\b(to)\s+(much|many|often|late|early|soon|bad|good|far|close)\b/gi,
      message: "Did you mean 'too' (also/excessive) instead of 'to'?",
      replacements: (match) => ["too " + match[2]],
    },
  ];

  /**
   * Check text for grammar and spelling issues
   */
  async checkGrammar(text: string): Promise<GrammarSuggestion[]> {
    const suggestions: GrammarSuggestion[] = [];

    if (!text || text.length < 3) return suggestions;

    // Check spelling
    const words = text.split(/\b/);
    let offset = 0;

    for (const word of words) {
      const cleanWord = word.replace(/[.,!?;:'"()[\]{}]$/g, "").toLowerCase();

      // Only check words with letters
      if (!/^[a-z]+$/i.test(cleanWord)) {
        offset += word.length;
        continue;
      }

      // Check spelling rules first
      const correction = this.spellingRules.get(cleanWord);
      if (correction) {
        suggestions.push({
          type: "spelling",
          message: `Possible spelling mistake: "${word}"`,
          replacements: [correction],
          offset,
          length: word.length,
          context: text.substring(
            Math.max(0, offset - 30),
            Math.min(text.length, offset + word.length + 30),
          ),
        });
        offset += word.length;
        continue;
      }

      // Check if word is in dictionary (skip very common words to reduce false positives)
      if (cleanWord.length > 3 && !this.dictionary.has(cleanWord)) {
        // Skip technical terms, acronyms, proper nouns (capitalized in middle of sentence)
        const isCapitalized = word[0] === word[0].toUpperCase();
        const isAllCaps = word === word.toUpperCase();
        const hasNumbers = /\d/.test(word);

        if (
          !isCapitalized &&
          !isAllCaps &&
          !hasNumbers &&
          cleanWord.length > 4
        ) {
          // This might be a misspelling, but only flag if it looks suspicious
          const suspiciousPatterns = [
            /(.)\1{2,}/, // repeated characters (e.g., "helllo")
            /[^aeiou]{5,}/i, // too many consonants
            /[aeiou]{4,}/i, // too many vowels
          ];

          if (suspiciousPatterns.some((p) => p.test(cleanWord))) {
            suggestions.push({
              type: "spelling",
              message: `Possible spelling mistake: "${word}"`,
              replacements: [],
              offset,
              length: word.length,
              context: text.substring(
                Math.max(0, offset - 30),
                Math.min(text.length, offset + word.length + 30),
              ),
            });
          }
        }
      }

      offset += word.length;
    }

    // Check grammar patterns
    for (const rule of this.grammarPatterns) {
      const matches = Array.from(text.matchAll(rule.pattern));
      for (const match of matches) {
        if (match.index !== undefined) {
          let replacements: string[] = [];

          if (rule.suggestion) {
            replacements = [rule.suggestion];
          } else if (rule.replacements) {
            replacements = rule.replacements(match);
          }

          suggestions.push({
            type: "grammar",
            message: rule.message,
            replacements,
            offset: match.index,
            length: match[0].length,
            context: text.substring(
              Math.max(0, match.index - 30),
              Math.min(text.length, match.index + match[0].length + 30),
            ),
          });
        }
      }
    }

    // Style suggestions - Passive voice (more sophisticated)
    const passivePattern =
      /\b(am|is|are|was|were|be|been|being)\s+(being\s+)?(\w+ed|gotten|written|taken|given|made|seen|known|shown|found|told|asked|brought|thought|left|felt|kept|held|met|read|heard|become|begun|broken|chosen|done|drawn|driven|eaten|fallen|forgotten|forgiven|frozen|gotten|grown|hidden|known|laid|lain|led|lent|lost|meant|paid|proven|put|ridden|risen|run|said|sold|sent|shaken|shone|shot|shown|shrunk|shut|sung|sunk|slept|slid|spoken|spent|split|spread|stood|stolen|stuck|stung|struck|strung|sworn|swept|swum|swung|taught|torn|thrown|understood|woken|worn|won|wound|written)\b/gi;
    const passiveMatches = Array.from(text.matchAll(passivePattern));

    for (const match of passiveMatches) {
      if (match.index !== undefined) {
        suggestions.push({
          type: "style",
          message:
            "Consider using active voice for more direct, engaging writing",
          replacements: [],
          offset: match.index,
          length: match[0].length,
          context: text.substring(
            Math.max(0, match.index - 30),
            Math.min(text.length, match.index + match[0].length + 30),
          ),
        });
      }
    }

    // Remove duplicates based on offset
    const uniqueSuggestions = suggestions.filter(
      (suggestion, index, self) =>
        index === self.findIndex((s) => s.offset === suggestion.offset),
    );

    return uniqueSuggestions;
  }

  /**
   * Get autocomplete suggestions based on current input
   */
  getAutocompleteSuggestions(
    text: string,
    cursorPosition: number,
  ): AutocompleteSuggestion[] {
    const suggestions: AutocompleteSuggestion[] = [];

    // Get the word being typed
    const beforeCursor = text.substring(0, cursorPosition);
    const words = beforeCursor.split(/\s+/);
    const currentWord = words[words.length - 1].toLowerCase();

    if (currentWord.length < 2) {
      return suggestions;
    }

    // Check for phrase completions
    const phraseMatches = this.commonPhrases.get(currentWord);
    if (phraseMatches) {
      phraseMatches.forEach((phrase) => {
        suggestions.push({
          text: phrase,
          description: "Common phrase",
          category: "phrase",
        });
      });
    }

    // Check for word completions from dictionary
    const wordMatches = Array.from(this.dictionary)
      .filter(
        (word) =>
          word.toLowerCase().startsWith(currentWord) &&
          word.length > currentWord.length,
      )
      .sort((a, b) => a.length - b.length); // Prefer shorter completions

    wordMatches.slice(0, 5).forEach((word) => {
      suggestions.push({
        text: word,
        category: "word",
      });
    });

    // Add custom completions based on context
    if (beforeCursor.endsWith("@")) {
      suggestions.push(
        {
          text: "@mention",
          description: "Mention someone",
          category: "template",
        },
        {
          text: "@date",
          description: "Insert date",
          category: "template",
        },
      );
    }

    return suggestions.slice(0, 8); // Limit to 8 suggestions max
  }

  /**
   * Get smart text suggestions while typing
   */
  getSmartSuggestions(text: string): string[] {
    const suggestions: string[] = [];
    const lastSentence = text.split(/[.!?]/).pop()?.trim() || "";

    // Suggest common continuations
    if (lastSentence.toLowerCase().startsWith("i think")) {
      suggestions.push("I think that", "I think we should", "I think it's");
    } else if (lastSentence.toLowerCase().startsWith("the ")) {
      suggestions.push("The main point is", "The key is to", "The best way to");
    } else if (lastSentence.toLowerCase().startsWith("we ")) {
      suggestions.push("We should", "We need to", "We can", "We will");
    }

    return suggestions;
  }
}

export const grammarService = new GrammarService();
