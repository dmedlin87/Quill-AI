/**
 * Style Analyzer
 * 
 * Deterministic writing quality metrics:
 * - Vocabulary analysis (diversity, overuse, rare words)
 * - Syntax patterns (sentence length, structure variety)
 * - Rhythm metrics (syllables, punctuation density)
 * - Style flags (passive voice, adverbs, filter words, clichés)
 */

import {
  VocabularyMetrics,
  SyntaxMetrics,
  RhythmMetrics,
  StyleFlags,
  StyleFingerprint,
} from '../../types/intelligence';

// ─────────────────────────────────────────────────────────────────────────────
// LEXICONS
// ─────────────────────────────────────────────────────────────────────────────

// Common words to exclude from "overused" detection
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
  'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your',
  'his', 'her', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs',
  'what', 'which', 'who', 'whom', 'whose', 'when', 'where', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'not', 'only', 'same', 'so', 'than', 'too', 'very', 'just',
  'also', 'now', 'here', 'there', 'then', 'once', 'if', 'because', 'until',
  'while', 'although', 'though', 'after', 'before', 'since', 'unless',
]);

// Adverbs to flag (especially "-ly" adverbs)
const FLAGGED_ADVERBS = [
  'really', 'very', 'actually', 'basically', 'literally', 'definitely',
  'absolutely', 'completely', 'totally', 'entirely', 'utterly', 'perfectly',
  'extremely', 'incredibly', 'amazingly', 'surprisingly', 'suddenly',
  'quickly', 'slowly', 'quietly', 'loudly', 'softly', 'gently', 'roughly',
  'immediately', 'eventually', 'finally', 'certainly', 'probably', 'possibly',
  'seemingly', 'apparently', 'obviously', 'clearly', 'simply', 'merely',
];

// Filter words (telling instead of showing)
const FILTER_WORDS = [
  'felt', 'feel', 'feeling', 'feels',
  'saw', 'see', 'seeing', 'sees', 'seen',
  'heard', 'hear', 'hearing', 'hears',
  'thought', 'think', 'thinking', 'thinks',
  'knew', 'know', 'knowing', 'knows', 'known',
  'noticed', 'notice', 'noticing', 'notices',
  'realized', 'realize', 'realizing', 'realizes',
  'wondered', 'wonder', 'wondering', 'wonders',
  'seemed', 'seem', 'seeming', 'seems',
  'appeared', 'appear', 'appearing', 'appears',
  'watched', 'watch', 'watching', 'watches',
  'decided', 'decide', 'deciding', 'decides',
  'wanted', 'want', 'wanting', 'wants',
];

// Common clichés
const CLICHES = [
  'dead as a doornail',
  'at the end of the day',
  'it was a dark and stormy night',
  'once upon a time',
  'in the nick of time',
  'when all was said and done',
  'his heart skipped a beat',
  'her heart sank',
  'a chill ran down',
  'time stood still',
  'like a ton of bricks',
  'sharp as a tack',
  'crystal clear',
  'in the blink of an eye',
  'beyond the shadow of a doubt',
  'avoid like the plague',
  'beat around the bush',
  'better late than never',
  'bite the bullet',
  'break the ice',
  'calm before the storm',
  'cut to the chase',
  'easier said than done',
  'hit the nail on the head',
  'last but not least',
  'needle in a haystack',
  'once in a blue moon',
  'piece of cake',
  'play it by ear',
  'read between the lines',
  'raining cats and dogs',
  'sick as a dog',
  'sleep like a log',
  'tip of the iceberg',
  'under the weather',
  'up in the air',
  'whole nine yards',
];

// Passive voice patterns
const PASSIVE_PATTERNS = [
  /\b(was|were|is|are|been|being)\s+(\w+ed|written|taken|given|done|made|seen|told|found|thought|known|become|begun|broken|brought|built|bought|caught|chosen|come|drawn|drunk|driven|eaten|fallen|felt|fought|flown|forgotten|frozen|gotten|gone|grown|heard|hidden|hit|held|hurt|kept|laid|led|left|lent|lain|lost|meant|met|paid|put|read|ridden|rung|risen|run|said|sat|sold|sent|set|shaken|shone|shot|shown|shut|sung|sunk|slept|slid|spoken|spent|spun|spread|stood|stolen|stuck|stung|struck|sworn|swept|swum|swung|taught|torn|thrown|understood|woken|worn|won|wound|written)\b/gi,
];

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

const tokenize = (text: string): string[] => {
  return text.toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);
};

const extractSentences = (text: string): string[] => {
  return text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
};

const countWords = (text: string): number => tokenize(text).length;

const countSyllables = (word: string): number => {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  
  // Count vowel groups
  const vowelGroups = word.match(/[aeiouy]+/g);
  if (!vowelGroups) return 1;
  
  let count = vowelGroups.length;
  
  // Adjustments
  if (word.endsWith('e') && !word.endsWith('le')) count--;
  if (word.endsWith('es') || word.endsWith('ed')) count--;
  if (count < 1) count = 1;
  
  return count;
};

// ─────────────────────────────────────────────────────────────────────────────
// VOCABULARY ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

export const analyzeVocabulary = (text: string): VocabularyMetrics => {
  const words = tokenize(text);
  const wordCounts = new Map<string, number>();
  
  for (const word of words) {
    if (word.length >= 2) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  }
  
  // Calculate metrics
  const uniqueWords = wordCounts.size;
  const totalWords = words.length;
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / (words.length || 1);
  const lexicalDiversity = totalWords > 0 ? uniqueWords / totalWords : 0;
  
  // Find top words (excluding stop words)
  const sortedWords = Array.from(wordCounts.entries())
    .filter(([word]) => !STOP_WORDS.has(word))
    .sort((a, b) => b[1] - a[1]);
  
  const topWords = sortedWords.slice(0, 20).map(([word, count]) => ({ word, count }));
  
  // Find overused words (appearing more than expected)
  const threshold = Math.max(5, totalWords * 0.005); // 0.5% of text or 5, whichever is greater
  const overusedWords = sortedWords
    .filter(([word, count]) => count > threshold && word.length > 3)
    .slice(0, 10)
    .map(([word]) => word);
  
  // Find rare/sophisticated words (long words used sparingly)
  const rareWords = Array.from(wordCounts.entries())
    .filter(([word, count]) => word.length >= 8 && count <= 2 && !STOP_WORDS.has(word))
    .slice(0, 20)
    .map(([word]) => word);
  
  return {
    uniqueWords,
    totalWords,
    avgWordLength,
    lexicalDiversity,
    topWords,
    overusedWords,
    rareWords,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// SYNTAX ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

export const analyzeSyntax = (text: string): SyntaxMetrics => {
  const sentences = extractSentences(text);
  const sentenceLengths = sentences.map(s => countWords(s));
  
  // Sentence length stats
  const avgSentenceLength = sentenceLengths.length > 0
    ? sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length
    : 0;
  
  const variance = sentenceLengths.length > 0
    ? sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgSentenceLength, 2), 0) / sentenceLengths.length
    : 0;
  
  const minSentenceLength = sentenceLengths.length > 0 ? Math.min(...sentenceLengths) : 0;
  const maxSentenceLength = sentenceLengths.length > 0 ? Math.max(...sentenceLengths) : 0;
  
  // Paragraph analysis
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const paragraphLengths = paragraphs.map(p => countWords(p));
  const paragraphLengthAvg = paragraphLengths.length > 0
    ? paragraphLengths.reduce((a, b) => a + b, 0) / paragraphLengths.length
    : 0;
  
  // Dialogue ratio
  const dialogueMatches: string[] = text.match(/"[^"]+"/g) || [];
  let dialogueWords = 0;
  for (const d of dialogueMatches) {
    dialogueWords += countWords(d);
  }
  const totalWords = countWords(text);
  const dialogueToNarrativeRatio = totalWords > 0 ? dialogueWords / totalWords : 0;
  
  // Question and exclamation ratios
  const questions = sentences.filter(s => s.trim().endsWith('?')).length;
  const exclamations = sentences.filter(s => s.trim().endsWith('!')).length;
  const questionRatio = sentences.length > 0 ? questions / sentences.length : 0;
  const exclamationRatio = sentences.length > 0 ? exclamations / sentences.length : 0;
  
  return {
    avgSentenceLength,
    sentenceLengthVariance: Math.sqrt(variance),
    minSentenceLength,
    maxSentenceLength,
    paragraphLengthAvg,
    dialogueToNarrativeRatio,
    questionRatio,
    exclamationRatio,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// RHYTHM ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

export const analyzeRhythm = (text: string): RhythmMetrics => {
  const sentences = extractSentences(text);
  
  // Syllable pattern (rolling average of syllables per sentence)
  const syllablePattern: number[] = [];
  const windowSize = 5;
  
  for (let i = 0; i < sentences.length; i++) {
    const words = tokenize(sentences[i]);
    const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
    syllablePattern.push(syllables);
  }
  
  // Smooth the pattern
  const smoothedPattern: number[] = [];
  for (let i = 0; i < syllablePattern.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(syllablePattern.length, i + Math.floor(windowSize / 2) + 1);
    const window = syllablePattern.slice(start, end);
    const avg = window.reduce((a, b) => a + b, 0) / window.length;
    smoothedPattern.push(Math.round(avg * 10) / 10);
  }
  
  // Punctuation density
  const punctuation = (text.match(/[,;:—–\-()]/g) || []).length;
  const words = countWords(text);
  const punctuationDensity = words > 0 ? (punctuation / words) * 100 : 0;
  
  // Average clause count (approximated by commas and semicolons per sentence)
  const clauseMarkers = sentences.map(s => (s.match(/[,;]/g) || []).length + 1);
  const avgClauseCount = clauseMarkers.length > 0
    ? clauseMarkers.reduce((a, b) => a + b, 0) / clauseMarkers.length
    : 1;
  
  return {
    syllablePattern: smoothedPattern.slice(0, 50), // Limit to first 50 sentences
    punctuationDensity,
    avgClauseCount,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// STYLE FLAGS
// ─────────────────────────────────────────────────────────────────────────────

export const analyzeStyleFlags = (text: string): StyleFlags => {
  const words = tokenize(text);
  const totalWords = words.length;
  
  // Passive voice detection
  const passiveVoiceInstances: Array<{ quote: string; offset: number }> = [];
  for (const pattern of PASSIVE_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      passiveVoiceInstances.push({
        quote: text.slice(Math.max(0, match.index - 10), match.index + match[0].length + 10).trim(),
        offset: match.index,
      });
    }
  }
  const passiveVoiceRatio = totalWords > 0 ? passiveVoiceInstances.length / (totalWords / 100) : 0;
  
  // Adverb detection
  const adverbInstances: Array<{ word: string; offset: number }> = [];
  const lyAdverbPattern = /\b(\w+ly)\b/gi;
  let match;
  while ((match = lyAdverbPattern.exec(text)) !== null) {
    const word = match[1].toLowerCase();
    if (FLAGGED_ADVERBS.includes(word) || word.endsWith('ly')) {
      adverbInstances.push({ word, offset: match.index });
    }
  }
  const adverbDensity = totalWords > 0 ? adverbInstances.length / (totalWords / 100) : 0;
  
  // Filter word detection
  const filterWordInstances: Array<{ word: string; offset: number }> = [];
  for (const filterWord of FILTER_WORDS) {
    const pattern = new RegExp(`\\b${filterWord}\\b`, 'gi');
    while ((match = pattern.exec(text)) !== null) {
      filterWordInstances.push({ word: filterWord, offset: match.index });
    }
  }
  const filterWordDensity = totalWords > 0 ? filterWordInstances.length / (totalWords / 100) : 0;
  
  // Cliché detection
  const clicheInstances: Array<{ phrase: string; offset: number }> = [];
  for (const cliche of CLICHES) {
    const pattern = new RegExp(cliche.replace(/\s+/g, '\\s+'), 'gi');
    while ((match = pattern.exec(text)) !== null) {
      clicheInstances.push({ phrase: cliche, offset: match.index });
    }
  }
  
  // Repeated phrases (n-grams appearing more than once)
  const repeatedPhrases = findRepeatedPhrases(text);
  
  return {
    passiveVoiceRatio,
    passiveVoiceInstances: passiveVoiceInstances.slice(0, 20),
    adverbDensity,
    adverbInstances: adverbInstances.slice(0, 30),
    filterWordDensity,
    filterWordInstances: filterWordInstances.slice(0, 30),
    clicheCount: clicheInstances.length,
    clicheInstances: clicheInstances.slice(0, 10),
    repeatedPhrases,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// REPEATED PHRASE DETECTION
// ─────────────────────────────────────────────────────────────────────────────

const findRepeatedPhrases = (text: string): Array<{ phrase: string; count: number; offsets: number[] }> => {
  const words = tokenize(text);
  const phraseMap = new Map<string, number[]>();
  
  // Find 3-grams and 4-grams
  for (let n = 3; n <= 4; n++) {
    for (let i = 0; i <= words.length - n; i++) {
      const phrase = words.slice(i, i + n).join(' ');
      
      // Skip if it's mostly stop words
      const nonStopWords = words.slice(i, i + n).filter(w => !STOP_WORDS.has(w));
      if (nonStopWords.length < 2) continue;
      
      if (phraseMap.has(phrase)) {
        phraseMap.get(phrase)!.push(i);
      } else {
        phraseMap.set(phrase, [i]);
      }
    }
  }
  
  // Filter to only repeated phrases
  const repeated = Array.from(phraseMap.entries())
    .filter(([_, offsets]) => offsets.length >= 2)
    .map(([phrase, offsets]) => ({
      phrase,
      count: offsets.length,
      offsets,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
  
  return repeated;
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export const analyzeStyle = (text: string): StyleFingerprint => {
  return {
    vocabulary: analyzeVocabulary(text),
    syntax: analyzeSyntax(text),
    rhythm: analyzeRhythm(text),
    flags: analyzeStyleFlags(text),
    processedAt: Date.now(),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPARISON HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export interface StyleComparison {
  vocabularyChange: number;      // Positive = more diverse
  sentenceLengthChange: number;  // Change in avg length
  passiveVoiceChange: number;    // Positive = more passive
  adverbChange: number;          // Positive = more adverbs
}

export const compareStyles = (
  before: StyleFingerprint,
  after: StyleFingerprint
): StyleComparison => {
  return {
    vocabularyChange: after.vocabulary.lexicalDiversity - before.vocabulary.lexicalDiversity,
    sentenceLengthChange: after.syntax.avgSentenceLength - before.syntax.avgSentenceLength,
    passiveVoiceChange: after.flags.passiveVoiceRatio - before.flags.passiveVoiceRatio,
    adverbChange: after.flags.adverbDensity - before.flags.adverbDensity,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// READABILITY SCORES
// ─────────────────────────────────────────────────────────────────────────────

export const calculateReadability = (text: string): { 
  fleschKincaid: number; 
  readingTime: number;
  gradeLevel: string;
} => {
  const words = countWords(text);
  const sentences = extractSentences(text).length;
  const syllables = tokenize(text).reduce((sum, w) => sum + countSyllables(w), 0);
  
  // Flesch-Kincaid Grade Level
  const fk = sentences > 0 && words > 0
    ? 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59
    : 0;
  
  // Reading time (average 200 words per minute)
  const readingTime = Math.ceil(words / 200);
  
  // Grade level label
  let gradeLevel = 'Professional';
  if (fk < 6) gradeLevel = 'Elementary';
  else if (fk < 9) gradeLevel = 'Middle School';
  else if (fk < 12) gradeLevel = 'High School';
  else if (fk < 16) gradeLevel = 'College';
  
  return {
    fleschKincaid: Math.round(fk * 10) / 10,
    readingTime,
    gradeLevel,
  };
};
