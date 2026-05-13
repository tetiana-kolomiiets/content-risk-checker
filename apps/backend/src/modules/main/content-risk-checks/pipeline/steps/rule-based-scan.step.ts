import { Injectable } from '@nestjs/common';
import { RULE_WEIGHTS } from '../../../../../infrastructure/config/scoring.constants';
import { ContentRiskCategory } from '../../../../../shared/enums/content-risk-category.enum';
import { ContentRiskStepName } from '../../../../../shared/enums/content-risk-step-name.enum';
import { FlaggedFragment } from '../../../../../shared/schemas/flagged-fragment.schema';
import { MatchedRule } from '../../../../../shared/schemas/matched-rule.schema';
import { PipelineStep } from '../contracts/pipeline-step.interface';
import { StepContext } from '../contracts/step-context.type';
import { StepResult } from '../contracts/step-result.type';
import { BlacklistRule, RulesProvider } from './rules.provider';

interface Rule {
  id: string;
  category: ContentRiskCategory;
  weight: number;
  test: (text: string) => Array<{ fragment: string }> | null;
}

function blacklistToRule(rule: BlacklistRule): Rule {
  return {
    id: rule.id,
    category: rule.category,
    weight: rule.weight,
    test: (text) => {
      const hits = rule.words.filter((w) => text.includes(w));
      return hits.length > 0 ? hits.map((w) => ({ fragment: w })) : null;
    },
  };
}

const URL_SHORTENER_HOSTS = [
  'bit\\.ly',
  'tinyurl\\.com',
  't\\.co',
  'goo\\.gl',
  'ow\\.ly',
  'is\\.gd',
  'buff\\.ly',
  'tiny\\.cc',
  'cutt\\.ly',
  'rb\\.gy',
  'lnkd\\.in',
];
const URL_SHORTENER_RE = new RegExp(
  `https?://(?:${URL_SHORTENER_HOSTS.join('|')})/\\S+`,
);

const STATIC_RULES: Rule[] = [
  {
    id: 'many_urls',
    category: ContentRiskCategory.SPAM,
    weight: RULE_WEIGHTS.MANY_URLS,
    test: (text) => {
      const matches = [...text.matchAll(/https?:\/\/\S+/g)];
      return matches.length > 2
        ? matches.slice(0, 5).map((m) => ({ fragment: m[0] }))
        : null;
    },
  },
  {
    id: 'char_repetition',
    category: ContentRiskCategory.SPAM,
    weight: RULE_WEIGHTS.CHAR_REPETITION,
    test: (text) => {
      const m = text.match(/(.)\1{4,}/);
      return m ? [{ fragment: m[0] }] : null;
    },
  },
  {
    id: 'excessive_punctuation',
    category: ContentRiskCategory.SPAM,
    weight: RULE_WEIGHTS.EXCESSIVE_PUNCTUATION,
    test: (text) => {
      const m = text.match(/[!?]{3,}/);
      return m ? [{ fragment: m[0] }] : null;
    },
  },
  {
    id: 'suspicious_tld',
    category: ContentRiskCategory.SCAM,
    weight: RULE_WEIGHTS.SCAM,
    test: (text) => {
      const m = text.match(/https?:\/\/\S+\.(?:tk|zip|click|top|xyz)\b\S*/);
      return m ? [{ fragment: m[0] }] : null;
    },
  },
  {
    id: 'crypto_wallet',
    category: ContentRiskCategory.SCAM,
    weight: RULE_WEIGHTS.CRYPTO_WALLET,
    test: (text) => {
      const m = text.match(
        /\b(?:0x[a-f0-9]{40}|bc1[a-z0-9]{6,87}|[13][a-z0-9]{25,34})\b/,
      );
      return m ? [{ fragment: m[0] }] : null;
    },
  },
  {
    id: 'url_shortener',
    category: ContentRiskCategory.SPAM,
    weight: RULE_WEIGHTS.URL_SHORTENER,
    test: (text) => {
      const matches = [...text.matchAll(new RegExp(URL_SHORTENER_RE, 'g'))];
      return matches.length > 0
        ? matches.slice(0, 5).map((m) => ({ fragment: m[0] }))
        : null;
    },
  },
  {
    id: 'ip_address_url',
    category: ContentRiskCategory.SCAM,
    weight: RULE_WEIGHTS.IP_ADDRESS_URL,
    test: (text) => {
      const m = text.match(/https?:\/\/(?:\d{1,3}\.){3}\d{1,3}\S*/);
      return m ? [{ fragment: m[0] }] : null;
    },
  },
  {
    id: 'censored_profanity',
    category: ContentRiskCategory.TOXICITY,
    weight: RULE_WEIGHTS.CENSORED_PROFANITY,
    test: (text) => {
      const m = text.match(/[a-z]\*{2,}[a-z]?/);
      return m ? [{ fragment: m[0] }] : null;
    },
  },
  {
    id: 'repeated_word',
    category: ContentRiskCategory.SPAM,
    weight: RULE_WEIGHTS.REPEATED_WORD,
    test: (text) => {
      const m = text.match(/\b(\w{2,})\b(?:\s+\1\b){2,}/);
      return m ? [{ fragment: m[0] }] : null;
    },
  },
  {
    id: 'credit_card_pattern',
    category: ContentRiskCategory.SCAM,
    weight: RULE_WEIGHTS.CREDIT_CARD,
    test: (text) => {
      const m = text.match(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/);
      return m ? [{ fragment: m[0] }] : null;
    },
  },
];

interface RuleBasedInput {
  normalizedText: string;
}

interface RuleBasedOutput {
  score: number;
  flags: ContentRiskCategory[];
  matchedRules: MatchedRule[];
  matchedRulesCount: number;
  totalRulesChecked: number;
  flaggedFragments: FlaggedFragment[];
}

@Injectable()
export class RuleBasedScanStep implements PipelineStep<
  RuleBasedInput,
  RuleBasedOutput
> {
  readonly name = ContentRiskStepName.RUN_RULE_BASED_CHECKS;

  constructor(private readonly rulesProvider: RulesProvider) {}

  execute(
    input: RuleBasedInput,
    _ctx: StepContext,
  ): Promise<StepResult<RuleBasedOutput>> {
    const rules = this.buildRules();

    try {
      const matchedRules: MatchedRule[] = [];
      const flaggedFragments: FlaggedFragment[] = [];
      let weightSum = 0;

      for (const rule of rules) {
        const fragments = rule.test(input.normalizedText);
        if (fragments && fragments.length > 0) {
          matchedRules.push({
            ruleId: rule.id,
            category: rule.category,
            fragments,
          });
          fragments.forEach((f) =>
            flaggedFragments.push({ text: f.fragment, reason: rule.id }),
          );
          weightSum += rule.weight;
        }
      }

      const flags = [...new Set(matchedRules.map((r) => r.category))];
      const score = Math.min(weightSum, 1);

      return Promise.resolve({
        ok: true,
        output: {
          score,
          flags,
          matchedRules,
          matchedRulesCount: matchedRules.length,
          totalRulesChecked: rules.length,
          flaggedFragments,
        },
        details: {
          stepName: ContentRiskStepName.RUN_RULE_BASED_CHECKS,
          matchedRulesCount: matchedRules.length,
          totalRulesChecked: rules.length,
          flags: flags.map((f) => f.toString()),
          score,
        },
      });
    } catch (err) {
      return Promise.resolve({
        ok: false,
        error: { code: 'RULE_SCAN_FAILED', message: (err as Error).message },
        details: {
          stepName: ContentRiskStepName.RUN_RULE_BASED_CHECKS,
          matchedRulesCount: 0,
          totalRulesChecked: rules.length,
          flags: [],
          score: 0,
        },
      });
    }
  }

  private buildRules(): Rule[] {
    return [
      ...STATIC_RULES,
      ...this.rulesProvider.getBlacklistRules().map(blacklistToRule),
    ];
  }
}
