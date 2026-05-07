import { Injectable } from '@nestjs/common';
import { ContentRiskCategory } from '../../../../../domain/content-risk-checks/enums/content-risk-category.enum';
import { ContentRiskStepName } from '../../../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import { PipelineStep } from '../contracts/pipeline-step.interface';
import { StepContext } from '../contracts/step-context.type';
import { StepResult } from '../contracts/step-result.type';

interface Rule {
  id: string;
  category: ContentRiskCategory;
  weight: number;
  test: (text: string) => Array<{ fragment: string }> | null;
}

function buildBlacklistRule(
  id: string,
  category: ContentRiskCategory,
  weight: number,
  words: string[],
): Rule[] {
  return [
    {
      id,
      category,
      weight,
      test: (text) => {
        const lower = text.toLowerCase();
        const hits = words.filter((w) => lower.includes(w));
        return hits.length > 0 ? hits.map((w) => ({ fragment: w })) : null;
      },
    },
  ];
}

const RULES: Rule[] = [
  {
    id: 'many_urls',
    category: ContentRiskCategory.SPAM,
    weight: 0.3,
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
    weight: 0.2,
    test: (text) => {
      const m = text.match(/(.)\1{4,}/);
      return m ? [{ fragment: m[0] }] : null;
    },
  },
  {
    id: 'excessive_punctuation',
    category: ContentRiskCategory.SPAM,
    weight: 0.1,
    test: (text) => {
      const m = text.match(/[!?]{3,}/);
      return m ? [{ fragment: m[0] }] : null;
    },
  },
  {
    id: 'all_caps',
    category: ContentRiskCategory.HARASSMENT,
    weight: 0.4,
    test: (text) => {
      const letters = text.replace(/[^a-zA-Zа-яА-Я]/g, '');
      if (letters.length < 10) return null;
      const upper = letters.replace(/[^A-ZА-Я]/g, '');
      return upper.length / letters.length > 0.7
        ? [{ fragment: text.slice(0, 80) }]
        : null;
    },
  },
  {
    id: 'suspicious_tld',
    category: ContentRiskCategory.SCAM,
    weight: 0.4,
    test: (text) => {
      const m = text.match(/https?:\/\/\S+\.(?:tk|zip|click|top|xyz)\b\S*/i);
      return m ? [{ fragment: m[0] }] : null;
    },
  },
  ...buildBlacklistRule(
    'placeholder_toxicity',
    ContentRiskCategory.TOXICITY,
    0.3,
    ['placeholder_toxic_a', 'placeholder_toxic_b', 'placeholder_toxic_c'],
  ),
  ...buildBlacklistRule('placeholder_hate', ContentRiskCategory.HATE, 0.5, [
    'placeholder_hate_a',
    'placeholder_hate_b',
  ]),
  ...buildBlacklistRule('placeholder_threat', ContentRiskCategory.THREAT, 0.7, [
    'placeholder_threat_a',
    'placeholder_threat_b',
    'placeholder_threat_c',
  ]),
  ...buildBlacklistRule(
    'placeholder_self_harm',
    ContentRiskCategory.SELF_HARM,
    0.7,
    ['placeholder_self_harm_a'],
  ),
];

interface RuleBasedInput {
  normalizedText: string;
}

interface MatchedRule {
  ruleId: string;
  category: ContentRiskCategory;
  fragments: Array<{ fragment: string }>;
}

interface FlaggedFragment {
  text: string;
  reason: string;
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

  execute(
    input: RuleBasedInput,
    _ctx: StepContext,
  ): Promise<StepResult<RuleBasedOutput>> {
    try {
      const matchedRules: MatchedRule[] = [];
      const flaggedFragments: FlaggedFragment[] = [];
      let weightSum = 0;

      for (const rule of RULES) {
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
          totalRulesChecked: RULES.length,
          flaggedFragments,
        },
        details: {
          stepName: ContentRiskStepName.RUN_RULE_BASED_CHECKS,
          matchedRulesCount: matchedRules.length,
          totalRulesChecked: RULES.length,
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
          totalRulesChecked: RULES.length,
          flags: [],
          score: 0,
        },
      });
    }
  }
}
