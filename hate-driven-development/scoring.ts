export interface PublicMetrics {
  like_count?: number;
  reply_count?: number;
  retweet_count?: number;
  quote_count?: number;
}

export interface ScoreResult {
  score: number;
  engagement: number;
  engagementBoost: number;
  actionable: boolean;
  mealTag: 'actionable protein' | 'empty calories' | 'light snack';
  reasons: string[];
  actionableSignals: string[];
}

export interface MentionInput {
  id: string;
  text: string;
  created_at?: string;
  public_metrics?: PublicMetrics;
}

export interface RankedMention extends MentionInput, ScoreResult {}

interface Rule {
  label: string;
  pattern: RegExp;
  weight: number;
  actionable?: boolean;
}

const NEGATIVE_RULES: Rule[] = [
  { label: 'hate', pattern: /\bhate\b/gi, weight: 6 },
  { label: 'worst', pattern: /\bworst\b/gi, weight: 5 },
  { label: 'terrible/awful', pattern: /\bterrible\b|\bawful\b/gi, weight: 5 },
  { label: 'trash/garbage', pattern: /\btrash\b|\bgarbage\b/gi, weight: 5 },
  { label: 'scam/fraud/grift', pattern: /\bscam\b|\bfraud\b|\bgrift(?:er)?\b/gi, weight: 6 },
  { label: 'sucks', pattern: /\bsucks?\b/gi, weight: 4 },
  { label: 'slop', pattern: /\bslop\b/gi, weight: 4 },
  { label: 'broken/buggy/failing', pattern: /\bbugg?y\b|\bbroken\b|\bunusable\b|\bdoesn'?t work\b|\bdoes not work\b|\bfail(?:s|ed|ing)?\b/gi, weight: 4, actionable: true },
  { label: 'annoying/confusing', pattern: /\bannoying\b|\bconfusing\b|\bmisleading\b|\bunclear\b/gi, weight: 3, actionable: true },
  { label: 'dumb/stupid/clown', pattern: /\bdumb\b|\bstupid\b|\bclown\b/gi, weight: 3 },
  { label: 'cope/copium', pattern: /\bcope\b|\bcopium\b/gi, weight: 3 },
  { label: 'wtf', pattern: /\bwtf\b/gi, weight: 2.5 },
  { label: 'mocking laughter', pattern: /\blol\b|\blmao\b|\brofl\b/gi, weight: 1.5 },
  { label: 'shitty', pattern: /\bshitty\b|\bshit\b/gi, weight: 4.5 },
];

const POSITIVE_RULES: Rule[] = [
  { label: 'love', pattern: /\blove\b/gi, weight: 3 },
  { label: 'good/great', pattern: /\bgood\b|\bgreat\b/gi, weight: 2 },
  { label: 'cool/amazing', pattern: /\bcool\b|\bamazing\b|\bhelpful\b|\buseful\b/gi, weight: 2.5 },
];

const ACTIONABLE_RULES: Rule[] = [
  { label: 'docs/readme', pattern: /\bdocs?\b|\breadme\b/gi, weight: 0, actionable: true },
  { label: 'install/setup', pattern: /\binstall\b|\bsetup\b|\bconfigure\b/gi, weight: 0, actionable: true },
  { label: 'build/compile', pattern: /\bbuild\b|\bcompile\b|\bbun\b|\bnode\b/gi, weight: 0, actionable: true },
  { label: 'error/crash', pattern: /\berror\b|\bcrash(?:ed|es)?\b|\bexception\b/gi, weight: 0, actionable: true },
  { label: 'slow/perf', pattern: /\bslow\b|\bperformance\b|\blag(?:gy)?\b/gi, weight: 0, actionable: true },
  { label: 'missing/unclear', pattern: /\bmissing\b|\bunclear\b|\bconfusing\b/gi, weight: 0, actionable: true },
];

function countMatches(text: string, pattern: RegExp): number {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const matches = text.match(new RegExp(pattern.source, flags));
  return matches?.length ?? 0;
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

function scoreRules(text: string, rules: Rule[], reasons: string[], actionableSignals: string[]): number {
  let total = 0;

  for (const rule of rules) {
    const matches = countMatches(text, rule.pattern);
    if (matches === 0) continue;

    const cappedMatches = Math.min(matches, 2);
    total += rule.weight * cappedMatches;
    reasons.push(`${rule.label} x${cappedMatches} (${rule.weight >= 0 ? '+' : ''}${roundScore(rule.weight * cappedMatches)})`);

    if (rule.actionable) {
      actionableSignals.push(rule.label);
    }
  }

  return total;
}

export function scoreMention(text: string, metrics: PublicMetrics = {}): ScoreResult {
  const reasons: string[] = [];
  const actionableSignals: string[] = [];

  let score = 0;
  score += scoreRules(text, NEGATIVE_RULES, reasons, actionableSignals);
  score -= scoreRules(text, POSITIVE_RULES, [], []);

  for (const rule of ACTIONABLE_RULES) {
    if (countMatches(text, rule.pattern) > 0) {
      actionableSignals.push(rule.label);
    }
  }

  const capsWords = (text.match(/\b[A-Z]{4,}\b/g) ?? []).length;
  if (capsWords > 0) {
    const capsBoost = Math.min(2, capsWords * 0.5);
    score += capsBoost;
    reasons.push(`all-caps emphasis (+${roundScore(capsBoost)})`);
  }

  const exclamations = (text.match(/!/g) ?? []).length;
  if (exclamations > 0) {
    const punctuationBoost = Math.min(1.5, exclamations * 0.25);
    score += punctuationBoost;
    reasons.push(`punctuation heat (+${roundScore(punctuationBoost)})`);
  }

  const engagement =
    (metrics.like_count ?? 0) +
    ((metrics.reply_count ?? 0) * 2) +
    ((metrics.retweet_count ?? 0) * 3) +
    ((metrics.quote_count ?? 0) * 4);
  const engagementBoost = Math.min(4, Math.log2(engagement + 1));
  if (engagementBoost > 0) {
    score += engagementBoost;
    reasons.push(`engagement boost (+${roundScore(engagementBoost)})`);
  }

  const actionable = actionableSignals.length > 0;
  const rounded = roundScore(score);
  const mealTag = actionable
    ? 'actionable protein'
    : rounded >= 8
      ? 'empty calories'
      : 'light snack';

  return {
    score: rounded,
    engagement,
    engagementBoost: roundScore(engagementBoost),
    actionable,
    mealTag,
    reasons,
    actionableSignals: [...new Set(actionableSignals)],
  };
}

export function compareRankedMentions(a: RankedMention, b: RankedMention): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.engagement !== a.engagement) return b.engagement - a.engagement;
  const aCreated = a.created_at ?? '';
  const bCreated = b.created_at ?? '';
  if (bCreated !== aCreated) return bCreated.localeCompare(aCreated);
  return b.id.localeCompare(a.id);
}

export function rankMentions<T extends MentionInput>(mentions: T[]): Array<T & ScoreResult> {
  return mentions
    .map(mention => ({
      ...mention,
      ...scoreMention(mention.text, mention.public_metrics),
    }))
    .sort((a, b) => compareRankedMentions(a, b));
}
