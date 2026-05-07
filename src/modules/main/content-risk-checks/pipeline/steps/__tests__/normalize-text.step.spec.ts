import { ContentRiskStepName } from '../../../../../../domain/content-risk-checks/enums/content-risk-step-name.enum';
import { StepContext } from '../../contracts/step-context.type';
import { NormalizeTextStep } from '../normalize-text.step';

const ctx: StepContext = {
  checkId: '00000000-0000-4000-8000-000000000001',
  traceId: 'trace-1',
  promptVersionId: '00000000-0000-4000-8000-000000000002',
};

describe('NormalizeTextStep', () => {
  let step: NormalizeTextStep;

  beforeEach(() => {
    step = new NormalizeTextStep();
  });

  it('collapses runs of whitespace into a single space', async () => {
    const result = await step.execute(
      { rawText: 'hello   \t\nworld   foo' },
      ctx,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.normalizedText).toBe('hello world foo');
  });

  it('strips ASCII control characters', async () => {
    const result = await step.execute(
      { rawText: 'hi\x00\x01\x07\x1F\x7Fthere' },
      ctx,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.normalizedText).toBe('hithere');
  });

  it('preserves Unicode letters (cyrillic, accents, emoji)', async () => {
    const result = await step.execute({ rawText: 'Привіт café 🚀 Naïve' }, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.normalizedText).toBe('привіт café 🚀 naïve');
  });

  it('lowercases mixed-case input', async () => {
    const result = await step.execute({ rawText: 'HELLO World MiXeD' }, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.normalizedText).toBe('hello world mixed');
  });

  it('reports charsRemoved as the difference between raw and cleaned length', async () => {
    const raw = '   HELLO\t\n  world  ';
    const result = await step.execute({ rawText: raw }, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cleaned = result.output.normalizedText;
    expect(cleaned).toBe('hello world');
    expect(result.details).toMatchObject({
      stepName: ContentRiskStepName.NORMALIZE_TEXT,
      charsRemoved: raw.length - cleaned.length,
      lowercased: true,
    });
  });

  it('returns charsRemoved=0 when input is already clean', async () => {
    const result = await step.execute({ rawText: 'hello' }, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.normalizedText).toBe('hello');
    expect(result.details).toMatchObject({
      stepName: ContentRiskStepName.NORMALIZE_TEXT,
      charsRemoved: 0,
      lowercased: true,
    });
  });

  it('handles empty input', async () => {
    const result = await step.execute({ rawText: '' }, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.output.normalizedText).toBe('');
    expect(result.details).toMatchObject({
      stepName: ContentRiskStepName.NORMALIZE_TEXT,
      charsRemoved: 0,
    });
  });
});
