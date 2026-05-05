import { ContentRiskCategory } from '../../../../../../domain/content-risk-checks/enums/content-risk-category.enum';
import { ContentRiskStepName } from '../../../../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import { StepContext } from '../../contracts/step-context.type';
import { RuleBasedScanStep } from '../rule-based-scan.step';

const ctx: StepContext = {
  checkId: '00000000-0000-4000-8000-000000000001',
  traceId: 'trace-1',
  promptVersionId: '00000000-0000-4000-8000-000000000002',
};

describe('RuleBasedScanStep', () => {
  let step: RuleBasedScanStep;

  beforeEach(() => {
    step = new RuleBasedScanStep();
  });

  it('returns clean result when no rules match', async () => {
    const result = await step.execute({ normalizedText: 'a quiet sentence' }, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.matchedRules).toEqual([]);
    expect(result.output.matchedRulesCount).toBe(0);
    expect(result.output.flags).toEqual([]);
    expect(result.output.flaggedFragments).toEqual([]);
    expect(result.output.score).toBe(0);
    expect(result.output.totalRulesChecked).toBeGreaterThan(0);
  });

  describe('individual rule firing', () => {
    it('fires many_urls (SPAM) when text contains more than two URLs', async () => {
      const result = await step.execute(
        {
          normalizedText:
            'see http://a.com http://b.com http://c.com http://d.com',
        },
        ctx,
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const rule = result.output.matchedRules.find((r) => r.ruleId === 'many_urls');
      expect(rule).toBeDefined();
      expect(rule?.category).toBe(ContentRiskCategory.SPAM);
      expect(rule?.fragments.length).toBeGreaterThan(0);
    });

    it('does NOT fire many_urls for two URLs only', async () => {
      const result = await step.execute(
        { normalizedText: 'see http://a.com http://b.com' },
        ctx,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output.matchedRules.find((r) => r.ruleId === 'many_urls')).toBeUndefined();
    });

    it('fires char_repetition (SPAM) for 5+ repeated characters', async () => {
      const result = await step.execute({ normalizedText: 'aaaaa hello' }, ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const rule = result.output.matchedRules.find((r) => r.ruleId === 'char_repetition');
      expect(rule).toBeDefined();
      expect(rule?.category).toBe(ContentRiskCategory.SPAM);
    });

    it('fires excessive_punctuation (SPAM) for 3+ ! or ?', async () => {
      const result = await step.execute({ normalizedText: 'wow!!!' }, ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const rule = result.output.matchedRules.find(
        (r) => r.ruleId === 'excessive_punctuation',
      );
      expect(rule).toBeDefined();
      expect(rule?.category).toBe(ContentRiskCategory.SPAM);
    });

    it('fires all_caps (HARASSMENT) when over 70% letters uppercase', async () => {
      const result = await step.execute(
        { normalizedText: 'STOP YELLING AT ME RIGHT NOW' },
        ctx,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const rule = result.output.matchedRules.find((r) => r.ruleId === 'all_caps');
      expect(rule).toBeDefined();
      expect(rule?.category).toBe(ContentRiskCategory.HARASSMENT);
    });

    it('does NOT fire all_caps for short uppercase strings', async () => {
      const result = await step.execute({ normalizedText: 'OK!' }, ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output.matchedRules.find((r) => r.ruleId === 'all_caps')).toBeUndefined();
    });

    it('fires suspicious_tld (SCAM) for risky TLDs', async () => {
      const result = await step.execute(
        { normalizedText: 'click http://free-money.zip now' },
        ctx,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const rule = result.output.matchedRules.find(
        (r) => r.ruleId === 'suspicious_tld',
      );
      expect(rule).toBeDefined();
      expect(rule?.category).toBe(ContentRiskCategory.SCAM);
    });

    it('fires placeholder_toxicity (TOXICITY)', async () => {
      const result = await step.execute(
        { normalizedText: 'this contains placeholder_toxic_a here' },
        ctx,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const rule = result.output.matchedRules.find(
        (r) => r.ruleId === 'placeholder_toxicity',
      );
      expect(rule).toBeDefined();
      expect(rule?.category).toBe(ContentRiskCategory.TOXICITY);
    });

    it('fires placeholder_hate (HATE)', async () => {
      const result = await step.execute(
        { normalizedText: 'placeholder_hate_a in here' },
        ctx,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const rule = result.output.matchedRules.find(
        (r) => r.ruleId === 'placeholder_hate',
      );
      expect(rule).toBeDefined();
      expect(rule?.category).toBe(ContentRiskCategory.HATE);
    });

    it('fires placeholder_threat (THREAT)', async () => {
      const result = await step.execute(
        { normalizedText: 'placeholder_threat_a' },
        ctx,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const rule = result.output.matchedRules.find(
        (r) => r.ruleId === 'placeholder_threat',
      );
      expect(rule).toBeDefined();
      expect(rule?.category).toBe(ContentRiskCategory.THREAT);
    });

    it('fires placeholder_self_harm (SELF_HARM)', async () => {
      const result = await step.execute(
        { normalizedText: 'placeholder_self_harm_a' },
        ctx,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const rule = result.output.matchedRules.find(
        (r) => r.ruleId === 'placeholder_self_harm',
      );
      expect(rule).toBeDefined();
      expect(rule?.category).toBe(ContentRiskCategory.SELF_HARM);
    });
  });

  describe('score and flags', () => {
    it('produces a score in [0, 1]', async () => {
      const result = await step.execute(
        {
          normalizedText:
            'placeholder_threat_a placeholder_self_harm_a placeholder_hate_a placeholder_toxic_a aaaaa wow!!!',
        },
        ctx,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output.score).toBeGreaterThan(0);
      expect(result.output.score).toBeLessThanOrEqual(1);
    });

    it('caps score at 1 when summed weights exceed 1', async () => {
      // threat (0.7) + self_harm (0.7) + hate (0.5) = 1.9 raw
      const result = await step.execute(
        {
          normalizedText:
            'placeholder_threat_a placeholder_self_harm_a placeholder_hate_a',
        },
        ctx,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output.score).toBe(1);
    });

    it('deduplicates flag categories when multiple rules share the same category', async () => {
      // many_urls + char_repetition + excessive_punctuation are all SPAM
      const result = await step.execute(
        {
          normalizedText:
            'aaaaa wow!!! http://a.com http://b.com http://c.com http://d.com',
        },
        ctx,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const spamHits = result.output.matchedRules.filter(
        (r) => r.category === ContentRiskCategory.SPAM,
      );
      expect(spamHits.length).toBeGreaterThanOrEqual(2);
      expect(result.output.flags.filter((f) => f === ContentRiskCategory.SPAM)).toHaveLength(1);
    });

    it('combines rule weights correctly when below 1', async () => {
      // char_repetition (0.2) + excessive_punctuation (0.1) = 0.3
      const result = await step.execute(
        { normalizedText: 'aaaaa wow!!!' },
        ctx,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output.score).toBeCloseTo(0.3, 5);
    });
  });

  describe('flaggedFragments structure', () => {
    it('emits {text, reason} fragments where reason is the rule id', async () => {
      const result = await step.execute(
        { normalizedText: 'aaaaa hello' },
        ctx,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.output.flaggedFragments.length).toBeGreaterThan(0);
      for (const f of result.output.flaggedFragments) {
        expect(typeof f.text).toBe('string');
        expect(f.text.length).toBeGreaterThan(0);
        expect(typeof f.reason).toBe('string');
        expect(f.reason.length).toBeGreaterThan(0);
      }
      expect(
        result.output.flaggedFragments.some((f) => f.reason === 'char_repetition'),
      ).toBe(true);
    });
  });

  describe('details payload', () => {
    it('includes step metadata when no rules match', async () => {
      const result = await step.execute({ normalizedText: 'plain' }, ctx);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.details).toMatchObject({
        stepName: ContentRiskStepName.RUN_RULE_BASED_CHECKS,
        matchedRulesCount: 0,
        flags: [],
        score: 0,
      });
    });
  });
});
