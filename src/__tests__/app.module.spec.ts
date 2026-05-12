import { Writable } from 'node:stream';
import pino from 'pino';
import { LOGGER_REDACT_OPTIONS } from '../app.module';

const captureLogs = (): {
  stream: Writable;
  read: () => Record<string, unknown>[];
} => {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer | string, _enc, cb) {
      chunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf-8'));
      cb();
    },
  });
  return {
    stream,
    read: () =>
      chunks
        .join('')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>),
  };
};

describe('AppModule logger redaction', () => {
  it('replaces secret values with [Redacted] in JSON output', () => {
    const { stream, read } = captureLogs();
    const logger = pino({ redact: LOGGER_REDACT_OPTIONS }, stream);

    logger.info({ payload: { apiKey: 'sk-secret' } }, 'request');

    const [entry] = read();
    expect(entry.payload).toEqual({ apiKey: '[Redacted]' });
  });

  it('redacts password, token, secret, authorization, bearer, credential', () => {
    const { stream, read } = captureLogs();
    const logger = pino({ redact: LOGGER_REDACT_OPTIONS }, stream);

    logger.info({
      ctx: {
        password: 'pw',
        token: 'tk',
        secret: 'ss',
        authorization: 'Bearer xxx',
        bearer: 'xxx',
        credential: 'cr',
      },
    });

    const [entry] = read();
    expect(entry.ctx).toEqual({
      password: '[Redacted]',
      token: '[Redacted]',
      secret: '[Redacted]',
      authorization: '[Redacted]',
      bearer: '[Redacted]',
      credential: '[Redacted]',
    });
  });

  it('redacts request authorization, cookie, and x-api-key headers', () => {
    const { stream, read } = captureLogs();
    const logger = pino({ redact: LOGGER_REDACT_OPTIONS }, stream);

    logger.info({
      req: {
        headers: {
          authorization: 'Bearer xxx',
          cookie: 'session=abc',
          'x-api-key': 'sk-secret',
          'user-agent': 'jest',
        },
      },
    });

    const [entry] = read();
    expect(entry.req).toEqual({
      headers: {
        authorization: '[Redacted]',
        cookie: '[Redacted]',
        'x-api-key': '[Redacted]',
        'user-agent': 'jest',
      },
    });
  });

  it('does not redact false-positive names like keyword or tokenize', () => {
    const { stream, read } = captureLogs();
    const logger = pino({ redact: LOGGER_REDACT_OPTIONS }, stream);

    logger.info({
      data: {
        keyword: 'search-term',
        tokenize: true,
        passwordPolicy: 'strong',
      },
    });

    const [entry] = read();
    expect(entry.data).toEqual({
      keyword: 'search-term',
      tokenize: true,
      passwordPolicy: 'strong',
    });
  });
});
