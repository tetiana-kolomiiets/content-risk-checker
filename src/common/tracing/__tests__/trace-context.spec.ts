import { TraceContext } from '../trace-context';

describe('TraceContext', () => {
  it('returns the trace id set by the enclosing run()', () => {
    const observed = TraceContext.run('trace-123', () => TraceContext.get());
    expect(observed).toBe('trace-123');
  });

  it('returns undefined outside of any run()', () => {
    expect(TraceContext.get()).toBeUndefined();
  });

  it('isolates two parallel run() calls — neither sees the other’s id', async () => {
    const seen: Array<{ outer: string; inner: string | undefined }> = [];

    const work = async (id: string): Promise<void> => {
      await TraceContext.run(id, async () => {
        // Yield so both async chains interleave.
        await Promise.resolve();
        await new Promise((resolve) => setImmediate(resolve));
        await Promise.resolve();
        seen.push({ outer: id, inner: TraceContext.get() });
      });
    };

    await Promise.all([work('trace-A'), work('trace-B')]);

    expect(seen).toHaveLength(2);
    for (const entry of seen) {
      expect(entry.inner).toBe(entry.outer);
    }
    const ids = new Set(seen.map((e) => e.inner));
    expect(ids).toEqual(new Set(['trace-A', 'trace-B']));
  });

  it('does not leak ids across nested vs sibling run() calls', () => {
    const sibling = TraceContext.run('outer', () => {
      const innerSibling = TraceContext.run('inner', () => TraceContext.get());
      const afterInner = TraceContext.get();
      return { innerSibling, afterInner };
    });

    expect(sibling.innerSibling).toBe('inner');
    expect(sibling.afterInner).toBe('outer');
    expect(TraceContext.get()).toBeUndefined();
  });
});
