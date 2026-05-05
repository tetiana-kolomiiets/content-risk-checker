import { ContentRiskCategory } from '../../../../../../domain/content-risk-checks/enums/content-risk-category.enum';
import { ContentRiskLevel } from '../../../../../../domain/content-risk-checks/enums/content-risk-level.enum';
import { AiAnalysisOutput } from '../../../../../../domain/content-risk-checks/schemas/ai-output.schema';
import { StepContext } from '../../contracts/step-context.type';
import { AggregateResultStep } from '../aggregate-result.step';

const ctx: StepContext = {
  checkId: '00000000-0000-4000-8000-000000000001',
  traceId: 'trace-1',
  promptVersionId: '00000000-0000-4000-8000-000000000002',
};

const buildRuleResult = (overrides: Partial<{
  score: number;
  flags: ContentRiskCategory[];
  matchedRules: Array<{
    ruleId: string;
    category: ContentRiskCategory;
    fragments: Array<{ fragment: string }>;
  }>;
  matchedRulesCount: number;
  totalRulesChecked: number;
  flaggedFragments: Array<{ text: string; reason: string }>;
}> = {}) => ({
  score: 0,
  flags: [],
  matchedRules: [],
  matchedRulesCount: 0,
  totalRulesChecked: 9,
  flaggedFragments: [],
  ...overrides,
});

const buildAiResult = (overrides: Partial<AiAnalysisOutput> = {}): AiAnalysisOutput => ({
  finalLevel: ContentRiskLevel.LOW,
  categories: [],
  score: 0,
  rationale: 'no concerns',
  flaggedFragments: [],
  ...overrides,
});

describe('AggregateResultStep', () => {
  let step: AggregateResultStep;

  beforeEach(() => {
    step = new AggregateResultStep();
  });

  it('combines scores as 0.4 * ruleScore + 0.6 * aiScore', async () => {
    const result = await step.execute(
      {
        ruleResult: buildRuleResult({ score: 0.5 }),
        aiResult: buildAiResult({ score: 0.5 }),
      },
      ctx,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.details).toMatchObject({
      ruleScore: 0.5,
      aiScore: 0.5,
      finalScore: 0.5,
    });
  });

  it('weights AI signal more than rule signal', async () => {
    const result = await step.execute(
      {
        ruleResult: buildRuleResult({ score: 1 }),
        aiResult: buildAiResult({ score: 0 }),
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 0.4 * 1 + 0.6 * 0 = 0.4
    expect(result.details).toMatchObject({ finalScore: 0.4 });
  });

  it('derives LOW when finalScore < 0.34', async () => {
    const result = await step.execute(
      {
        ruleResult: buildRuleResult({ score: 0.2 }),
        aiResult: buildAiResult({ score: 0.2, finalLevel: ContentRiskLevel.LOW }),
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.finalRiskLevel).toBe(ContentRiskLevel.LOW);
  });

  it('derives MEDIUM when finalScore is in [0.34, 0.67)', async () => {
    const result = await step.execute(
      {
        ruleResult: buildRuleResult({ score: 0.5 }),
        aiResult: buildAiResult({ score: 0.5, finalLevel: ContentRiskLevel.LOW }),
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.finalRiskLevel).toBe(ContentRiskLevel.MEDIUM);
  });

  it('derives HIGH when finalScore >= 0.67', async () => {
    const result = await step.execute(
      {
        ruleResult: buildRuleResult({ score: 0.9 }),
        aiResult: buildAiResult({ score: 0.9, finalLevel: ContentRiskLevel.LOW }),
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.finalRiskLevel).toBe(ContentRiskLevel.HIGH);
  });

  it('AI override: if AI level is higher than threshold-derived, AI wins', async () => {
    // Low scores derive LOW, but AI says HIGH → final must be HIGH.
    const result = await step.execute(
      {
        ruleResult: buildRuleResult({ score: 0 }),
        aiResult: buildAiResult({ score: 0.1, finalLevel: ContentRiskLevel.HIGH }),
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.finalRiskLevel).toBe(ContentRiskLevel.HIGH);
  });

  it('AI override does NOT downgrade: AI lower than threshold-derived → keep threshold', async () => {
    // High scores derive HIGH, but AI says LOW → final must stay HIGH.
    const result = await step.execute(
      {
        ruleResult: buildRuleResult({ score: 1 }),
        aiResult: buildAiResult({ score: 1, finalLevel: ContentRiskLevel.LOW }),
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.finalRiskLevel).toBe(ContentRiskLevel.HIGH);
  });

  it('unions categories from AI and rule scan without duplicates', async () => {
    const result = await step.execute(
      {
        ruleResult: buildRuleResult({
          flags: [ContentRiskCategory.SPAM, ContentRiskCategory.TOXICITY],
        }),
        aiResult: buildAiResult({
          categories: [ContentRiskCategory.TOXICITY, ContentRiskCategory.HATE],
        }),
      },
      ctx,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cats = result.output.categories;
    expect(new Set(cats)).toEqual(
      new Set([
        ContentRiskCategory.SPAM,
        ContentRiskCategory.TOXICITY,
        ContentRiskCategory.HATE,
      ]),
    );
    expect(cats.length).toBe(3);
  });

  it('concatenates flaggedFragments from both sources', async () => {
    const result = await step.execute(
      {
        ruleResult: buildRuleResult({
          flaggedFragments: [{ text: 'aaaaa', reason: 'char_repetition' }],
        }),
        aiResult: buildAiResult({
          flaggedFragments: [{ text: 'awful', reason: 'toxic word' }],
        }),
      },
      ctx,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.flaggedFragments).toHaveLength(2);
    expect(result.output.flaggedFragments).toEqual(
      expect.arrayContaining([
        { text: 'awful', reason: 'toxic word' },
        { text: 'aaaaa', reason: 'char_repetition' },
      ]),
    );
  });

  it('uses AI rationale as the summary', async () => {
    const result = await step.execute(
      {
        ruleResult: buildRuleResult(),
        aiResult: buildAiResult({ rationale: 'AI explanation here.' }),
      },
      ctx,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.summary).toBe('AI explanation here.');
  });

  it('passes through matched rule counts and totals', async () => {
    const result = await step.execute(
      {
        ruleResult: buildRuleResult({
          matchedRulesCount: 3,
          totalRulesChecked: 9,
          matchedRules: [
            { ruleId: 'r1', category: ContentRiskCategory.SPAM, fragments: [] },
          ],
        }),
        aiResult: buildAiResult(),
      },
      ctx,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.matchedRulesCount).toBe(3);
    expect(result.output.totalRulesChecked).toBe(9);
    expect(result.output.matchedRules).toEqual([
      { ruleId: 'r1', category: ContentRiskCategory.SPAM, fragments: [] },
    ]);
  });
});
