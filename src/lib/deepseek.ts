import { Settings } from './storage';
import { diff_match_patch } from 'diff-match-patch';

// ---- Shared types ----

export interface Correction {
  type: 'grammar' | 'spelling' | 'clarity' | 'paraphrase' | 'humanize' | 'formal' | 'shorten';
  original: string;
  suggestion: string;
  explanation: string;
  start: number;
  end: number;
  severity: 'error' | 'warning' | 'suggestion';
}

export interface AnalysisResponse {
  corrections: Correction[];
  overallScore: number;
  stats: {
    wordCount: number;
    readabilityScore: number;
  };
}

// The panel's tabs. "grammar" = proofreader (grammar/spelling), "improve" =
// a full-text improvement rewrite, everything else is a distinct rewrite
// style. All rewrite styles return Correction[] so the same diff-panel UI can
// render them uniformly.
export type PanelMode = 'improve' | 'grammar' | 'clarity' | 'paraphrase' | 'shorten' | 'formal' | 'humanize';

export type RewriteTone =
  | 'formal'
  | 'professional'
  | 'casual'
  | 'friendly'
  | 'confident'
  | 'persuasive'
  | 'concise'
  | 'expand'
  | 'simplify'
  | 'empathetic'
  | 'assertive'
  | 'descriptive'
  | 'natural';

export const REWRITE_TONES: { id: RewriteTone; label: string }[] = [
  { id: 'formal', label: 'Formal' },
  { id: 'professional', label: 'Professional' },
  { id: 'casual', label: 'Casual' },
  { id: 'friendly', label: 'Friendly' },
  { id: 'confident', label: 'Confident' },
  { id: 'persuasive', label: 'Persuasive' },
  { id: 'concise', label: 'Concise' },
  { id: 'expand', label: 'Expand' },
  { id: 'simplify', label: 'Simplify' },
  { id: 'empathetic', label: 'Empathetic' },
  { id: 'assertive', label: 'Assertive' },
  { id: 'descriptive', label: 'Descriptive' },
  { id: 'natural', label: 'Natural' },
];

export interface RewriteResponse {
  rewritten: string;
  explanation: string;
}

export interface TranslateResponse {
  translated: string;
  detectedLanguage: string;
}

const DEEPSEEK_ENDPOINT = 'https://dev.s4m1r.ct.ws/api/deepseek/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

// ---- Low-level API call ----

async function callDeepSeek(prompt: string): Promise<string> {
  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      model: DEEPSEEK_MODEL,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// DeepSeek isn't guaranteed to honor a strict "JSON only" instruction, so
// strip markdown code fences / stray text around the JSON object.
function extractJson(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    return fenced[1].trim();
  }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.substring(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

// ---- Proofreader (grammar/spelling) — existing behavior ----

const SYSTEM_PROMPT = `You are a thorough grammar and spelling checker. Find EVERY genuine grammar or spelling error in the text and propose the minimal correction for each.

CRITICAL RULES:
1. Fix actual grammar mistakes (subject-verb agreement, tense errors, article usage, punctuation, pronoun case, double negatives, etc.)
2. Fix spelling mistakes, including commonly confused words (their/there/they're, its/it's, your/you're, to/too/two, then/than, effect/affect, lose/loose, apart/a part)
3. DO NOT rewrite sentences for "clarity" or "style"
4. DO NOT change the meaning or structure of sentences
5. The "suggestion" must be minimal - change ONLY the specific word(s) with errors
6. If a sentence is grammatically correct, DO NOT suggest changes
7. NEVER suggest capitalizing letters WITHIN words - only standalone "i" (the pronoun) should be "I"
8. DO NOT flag individual letters or parts of words - only flag complete words or phrases
9. The lowercase "i" is ONLY wrong when it stands ALONE as the pronoun (e.g., "i think" → "I think")
10. Letters like "i" inside words (like "in", "it", "is", "like", "this") are CORRECT and must NOT be flagged
11. CHECK EVERY SENTENCE carefully. Do not stop after one or two errors - the text may contain many.

IMPORTANT GRAMMAR RULES TO FOLLOW:
- After "doesn't", "don't", "does", "do", "didn't", "can't", "won't", "shouldn't", "couldn't", "wouldn't" → use BASE VERB (no -s/-es)
  Example: "doesn't work" is CORRECT, "doesn't works" is WRONG
- After "he/she/it" without auxiliary → use VERB+S
  Example: "it works" is CORRECT, "it work" is WRONG
- "its" = possessive, "it's" = "it is"; "your" = possessive, "you're" = "you are"
- Standalone "i" (pronoun) → should be "I" (capitalized)
  Example: "i think" is WRONG → "I think" is CORRECT
  But "in", "it", "is" are CORRECT as-is
- Countable/uncountable: "an information", "a advice" → drop the article
- Common errors: "could of" → "could have", "would of" → "would have", "should of" → "should have"
- Double negatives: "I don't have no money" → "I don't have any money"
- Fragment + missing comma after introductory phrases: "After the meeting we left" → "After the meeting, we left"
- Comma splice: "It is late, we should go" → "It is late. We should go" or "It is late; we should go"

Respond ONLY with a JSON object. No markdown.

JSON Structure:
{
  "corrections": [
    {
      "type": "grammar" | "spelling",
      "original": "exact erroneous word or phrase",
      "suggestion": "corrected word or phrase", 
      "explanation": "brief reason",
      "start": number,
      "end": number,
      "severity": "error" | "warning"
    }
  ],
  "overallScore": 0-100,
  "stats": { "wordCount": number, "readabilityScore": 0-10 }
}

Examples:
- "sometimes it work" → "it work" should be "it works" (subject-verb agreement)
- "doesn't works" → "works" should be "work" (base verb after doesn't)
- "recieve" → "receive" (spelling)
- "a apple" → "an apple" (article)
- "its raining" → "its" should be "it's" (contraction)
- "I could of gone" → "I could have gone" (spelling)
- "I don't have no time" → "I don't have any time" (double negative)

DO NOT create correction loops. Analyze the FULL context before suggesting.`;

// Simple in-memory cache for the current session
const analysisCache = new Map<string, { response: AnalysisResponse, timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

const MAX_CHUNK_SIZE = 3000; // characters

export async function analyzeText(text: string, settings: Settings): Promise<AnalysisResponse> {
  if (text.length <= MAX_CHUNK_SIZE) {
    return analyzeChunk(text, settings);
  }

  const chunks = chunkText(text, MAX_CHUNK_SIZE);
  const results = await Promise.all(chunks.map(chunk => analyzeChunk(chunk.text, settings)));

  const merged: AnalysisResponse = {
    corrections: [],
    overallScore: 0,
    stats: { wordCount: 0, readabilityScore: 0 }
  };

  let totalScore = 0;
  let totalReadability = 0;

  results.forEach((res, i) => {
    const offset = chunks[i].offset;
    res.corrections.forEach(c => {
      c.start += offset;
      c.end += offset;
    });
    merged.corrections.push(...res.corrections);
    merged.stats.wordCount += res.stats.wordCount;
    totalScore += res.overallScore;
    totalReadability += res.stats.readabilityScore;
  });

  merged.overallScore = Math.round(totalScore / results.length);
  merged.stats.readabilityScore = Number((totalReadability / results.length).toFixed(1));

  return merged;
}

async function analyzeChunk(text: string, settings: Settings): Promise<AnalysisResponse> {
  const cacheKey = `improve:${settings.mode}:${settings.aggressiveness}:${text}`;
  const cached = analysisCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.response;
  }

  const combinedPrompt = `${SYSTEM_PROMPT}\nWriting Mode: ${settings.mode}\nAggressiveness: ${settings.aggressiveness}\n\nText to analyze:\n${text}`;
  const content = await callDeepSeek(combinedPrompt);

  try {
    const parsed = JSON.parse(extractJson(content)) as AnalysisResponse;
    const validated = validateAndFixCorrections(text, parsed);
    analysisCache.set(cacheKey, { response: validated, timestamp: Date.now() });
    return validated;
  } catch (e) {
    throw new Error('Invalid response format from AI.');
  }
}

// ---- Panel modes (Improve, Clarity, Paraphrase, Shorten, Formal, Humanize) ----
// These return the SAME Correction[] shape as the proofreader so the panel
// can render every tab with one diff renderer and one Accept/Accept All flow.
// Unlike the proofreader's "minimal word swap" rule, these modes are allowed
// to replace whole sentences — "original"/"suggestion" can span a full clause.
// "grammar" is handled separately by the proofreader (analyzeText).

const PANEL_MODE_INSTRUCTIONS: Record<Exclude<PanelMode, 'grammar'>, string> = {
  improve: `You improve the overall quality of the writing. Fix awkward phrasing, weak or vague word choices, wordiness, passive constructions, run-on sentences, repetition, and clumsy structure. Rewrite every sentence that can be better. Keep the same meaning, facts, and intent — do not add new claims.`,
  clarity: `You improve clarity and concision. For each wordy, confusing, or redundant sentence (or clause), propose a tighter rewrite that keeps the same meaning. Prefer sentence-level rewrites.`,
  paraphrase: `You paraphrase the text to sound different while preserving the exact same meaning. Rewrite EVERY sentence with fresh phrasing so the whole passage reads noticeably reworded, not copied.`,
  shorten: `You shorten wordy sentences. For each sentence that can be meaningfully shorter without losing information, propose a shorter version. Where multiple short sentences repeat, merge them.`,
  formal: `You rewrite the text into a formal, professional register. Remove slang, contractions, and casual phrasing. Prefer sentence-level rewrites.`,
  humanize: `You make stiff, robotic, or AI-sounding text read as natural and conversational, written by a real person. Vary sentence length and rhythm, remove generic filler phrases and clichés (e.g. "in today's fast-paced world", "it is important to note that"), and avoid overly uniform sentence structure. Keep the same meaning and roughly the same length.`,
};

const PANEL_SYSTEM_PROMPT = `You are a writing assistant. You will be given an INSTRUCTION describing one specific type of edit, and a TEXT.

Find all the sentences or clauses in the TEXT that the INSTRUCTION applies to and propose a replacement for each. Prefer sentence-level replacements over editing single words.

CRITICAL RULES:
1. Apply ONLY the kind of edit the INSTRUCTION asks for. Do not fix unrelated grammar/spelling issues.
2. If a sentence does not obviously need the edit but the whole text must still change, apply the edit to every sentence anyway.
3. "original" must be an EXACT substring of the input text (verbatim, same casing/punctuation) so it can be located by string match.
4. Do not overlap edits — each "original" span must be non-overlapping with every other edit's span.
5. NEVER return an empty corrections array. ALWAYS return at least one correction. If you cannot find individual sentences to change, rewrite the ENTIRE text as a single correction where "original" is the full input text and "suggestion" is your rewritten version.
6. Preserve the original language of the text (do not translate).
7. Respond ONLY with a JSON object. No markdown, no code fences.

JSON Structure:

{
  "corrections": [
    {
      "original": "exact verbatim sentence or clause from the text",
      "suggestion": "the rewritten replacement",
      "explanation": "very short reason, a few words",
      "start": number,
      "end": number
    }
  ]
}`;

export async function analyzePanelMode(text: string, mode: Exclude<PanelMode, 'grammar'>, settings: Settings): Promise<Correction[]> {
  if (!text || !text.trim()) return [];

  const cacheKey = `${mode}:${settings.mode}:${text}`;
  const cached = analysisCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.response.corrections;
  }

  const instruction = PANEL_MODE_INSTRUCTIONS[mode];
  const prompt = `${PANEL_SYSTEM_PROMPT}\n\nINSTRUCTION: ${instruction}\n\nTEXT:\n${text}`;
  const content = await callDeepSeek(prompt);

  try {
    const parsed = JSON.parse(extractJson(content)) as { corrections: Omit<Correction, 'type' | 'severity'>[] };
    const corrections: Correction[] = (parsed.corrections || []).map(c => ({
      ...c,
      type: mode as Correction['type'],
      severity: 'suggestion' as const,
    }));
    const validated = validateAndFixCorrections(text, { corrections, overallScore: 0, stats: { wordCount: 0, readabilityScore: 0 } });
    analysisCache.set(cacheKey, { response: validated, timestamp: Date.now() });
    return validated.corrections;
  } catch (e) {
    throw new Error('Invalid response format from AI.');
  }
}

// ---- Selection rewrite (tone popup, unchanged from before) ----

const TONE_INSTRUCTIONS: Record<RewriteTone, string> = {
  formal: 'Rewrite in a formal, professional tone. Remove slang and contractions. Keep it precise and businesslike.',
  professional: 'Rewrite in a polished, professional register suited to a workplace. Clear, competent, and free of slang, while remaining approachable.',
  casual: 'Rewrite in a relaxed, casual, everyday tone, as if texting or chatting with a friend. Use contractions and informal phrasing where natural.',
  friendly: 'Rewrite in a warm, friendly, conversational tone, as if talking to a colleague you like. Keep contractions where natural.',
  confident: 'Rewrite in a direct, confident tone. Remove hedging words like "maybe", "I think", "sort of". State things plainly.',
  persuasive: 'Rewrite to be more persuasive and compelling, emphasizing benefits and using active language, without becoming exaggerated or dishonest.',
  concise: 'Rewrite to be as short and tight as possible while keeping the full meaning. Cut filler words and redundant phrases.',
  expand: 'Rewrite by expanding with more useful detail, context, or examples, while keeping the same core meaning and tone.',
  simplify: 'Rewrite using simpler, plainer words and shorter sentences, as if explaining to someone unfamiliar with jargon.',
  empathetic: 'Rewrite with warmth, care, and empathy. Acknowledge feelings and concerns, use a supportive and understanding tone.',
  assertive: 'Rewrite in a firm, assertive tone that states positions and needs clearly and directly, without being aggressive or rude.',
  descriptive: 'Rewrite with richer, more vivid and specific detail — sensory language, concrete examples — while keeping the same meaning and length.',
  natural: 'Rewrite to sound like a real person wrote it — natural, authentic, and conversational. Remove robotic phrasing and overly uniform sentences.',
};

const REWRITE_SYSTEM_PROMPT = `You are a writing assistant that rewrites text according to a requested tone or style change.

CRITICAL RULES:
1. Preserve the original meaning, facts, and intent. Do not add claims that weren't there.
2. Keep the same language as the input (do not translate).
3. Keep roughly the same length unless the instruction explicitly says to expand or shorten.
4. Do not add greetings, signoffs, or commentary that wasn't implied by the original text.
5. Return ONLY a JSON object, no markdown, no code fences.

JSON Structure:
{
  "rewritten": "the rewritten text",
  "explanation": "one short sentence describing what changed"
}`;

export async function rewriteText(text: string, tone: RewriteTone, settings: Settings): Promise<RewriteResponse> {
  if (!text || !text.trim()) {
    throw new Error('No text selected to rewrite');
  }

  const instruction = TONE_INSTRUCTIONS[tone];
  const combinedPrompt = `${REWRITE_SYSTEM_PROMPT}\n\nInstruction: ${instruction}\nWriting Mode: ${settings.mode}\n\nText to rewrite:\n${text}`;
  const content = await callDeepSeek(combinedPrompt);

  try {
    const parsed = JSON.parse(extractJson(content)) as RewriteResponse;
    if (typeof parsed.rewritten !== 'string' || !parsed.rewritten.trim()) {
      throw new Error('Empty rewrite result');
    }
    return parsed;
  } catch (e) {
    throw new Error('Invalid response format from AI.');
  }
}

// ---- Translation ----

export const TRANSLATE_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'bn', name: 'বাংলা (Bangla)' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'pt', name: 'Português' },
  { code: 'ar', name: 'العربية' },
  { code: 'hi', name: 'हिन्दी' },
];

const TRANSLATE_SYSTEM_PROMPT = `You are a translator. Detect the language of the input text, then translate it into the TARGET language. Preserve tone, formatting, and paragraph breaks. Respond ONLY with a JSON object, no markdown.

JSON Structure:
{
  "translated": "the translated text",
  "detectedLanguage": "name of the detected source language, in English, e.g. 'Spanish'"
}`;

export async function translateText(text: string, targetLanguageName: string): Promise<TranslateResponse> {
  if (!text || !text.trim()) {
    throw new Error('No text to translate');
  }

  const prompt = `${TRANSLATE_SYSTEM_PROMPT}\n\nTARGET language: ${targetLanguageName}\n\nText:\n${text}`;
  const content = await callDeepSeek(prompt);

  try {
    const parsed = JSON.parse(extractJson(content)) as TranslateResponse;
    if (typeof parsed.translated !== 'string' || !parsed.translated.trim()) {
      throw new Error('Empty translation result');
    }
    return parsed;
  } catch (e) {
    throw new Error('Invalid response format from AI.');
  }
}

// Lightweight language detection just for the badge (cheap single call,
// separate from full translation so we can show the badge without the
// user asking to translate yet).
const DETECT_SYSTEM_PROMPT = `Identify the language of the given text. Respond ONLY with a JSON object, no markdown.

JSON Structure:
{ "language": "name of the language in English, e.g. 'Bangla'", "code": "ISO 639-1 two-letter code, e.g. 'bn'" }`;

export async function detectLanguage(text: string): Promise<{ language: string; code: string }> {
  if (!text || text.trim().length < 3) {
    throw new Error('Not enough text to detect language');
  }
  const prompt = `${DETECT_SYSTEM_PROMPT}\n\nText:\n${text.slice(0, 500)}`;
  const content = await callDeepSeek(prompt);
  try {
    return JSON.parse(extractJson(content));
  } catch (e) {
    throw new Error('Invalid response format from AI.');
  }
}

// ---- Shared helpers ----

function chunkText(text: string, size: number): { text: string, offset: number }[] {
  const chunks: { text: string, offset: number }[] = [];
  let currentPos = 0;

  while (currentPos < text.length) {
    let endPos = currentPos + size;
    if (endPos < text.length) {
      const lastPara = text.lastIndexOf('\n', endPos);
      if (lastPara > currentPos + size * 0.5) {
        endPos = lastPara + 1;
      } else {
        const lastSentence = text.lastIndexOf('. ', endPos);
        if (lastSentence > currentPos + size * 0.5) {
          endPos = lastSentence + 2;
        }
      }
    } else {
      endPos = text.length;
    }

    chunks.push({
      text: text.substring(currentPos, endPos),
      offset: currentPos
    });
    currentPos = endPos;
  }

  return chunks;
}

function validateAndFixCorrections(originalText: string, response: AnalysisResponse): AnalysisResponse {
  const dmp = new diff_match_patch();

  response.corrections = response.corrections.filter(c => {
    if (c.original.length === 1 && c.suggestion.length === 1) {
      if (c.original === 'i' && c.suggestion === 'I') {
        const before = c.start > 0 ? originalText[c.start - 1] : ' ';
        const after = c.end < originalText.length ? originalText[c.end] : ' ';
        const isStandalone = /[\s.,!?;:'"()\[\]{}\-]/.test(before) && /[\s.,!?;:'"()\[\]{}\-]/.test(after);
        if (!isStandalone) {
          return false;
        }
      } else {
        return false;
      }
    }

    if (c.original.toLowerCase() === c.suggestion.toLowerCase() &&
        c.original !== c.suggestion &&
        c.original.length > 1) {
      let diffCount = 0;
      for (let i = 0; i < c.original.length; i++) {
        if (c.original[i] !== c.suggestion[i]) diffCount++;
      }
      if (diffCount === 1 && c.original.toLowerCase() === c.suggestion.toLowerCase()) {
        return false;
      }
    }

    const AI_snippet = originalText.substring(c.start, c.end);
    if (AI_snippet === c.original) return true;

    const exactIndex = originalText.indexOf(c.original);
    if (exactIndex !== -1) {
      c.start = exactIndex;
      c.end = exactIndex + c.original.length;
      return true;
    }

    const fuzzyIndex = dmp.match_main(originalText, c.original, c.start);
    if (fuzzyIndex !== -1) {
      c.start = fuzzyIndex;
      c.end = fuzzyIndex + c.original.length;
      c.original = originalText.substring(c.start, c.end);
      return true;
    }

    return false;
  });

  // Sort by position and drop overlaps (keep the first of any overlapping pair)
  // so batch "Accept All" can apply corrections without corrupting offsets.
  response.corrections.sort((a, b) => a.start - b.start);
  const nonOverlapping: Correction[] = [];
  let lastEnd = -1;
  for (const c of response.corrections) {
    if (c.start >= lastEnd) {
      nonOverlapping.push(c);
      lastEnd = c.end;
    }
  }
  response.corrections = nonOverlapping;

  return response;
}
