export const RULE_SCORE_WEIGHT = 0.4;

//Higher than rules because LLM analysis is context-sensitive and provides better precision on domain-specific content.
export const AI_SCORE_WEIGHT = 0.6;

export const MEDIUM_RISK_THRESHOLD = 0.34;

export const HIGH_RISK_THRESHOLD = 0.67;

//Chosen empirically by severity of impact
export const RULE_WEIGHTS = {
  THREAT: 0.7,
  SELF_HARM: 0.7,
  HATE: 0.5,
  SCAM: 0.4,
  TOXICITY: 0.3,
  MANY_URLS: 0.3,
  CHAR_REPETITION: 0.2,
  EXCESSIVE_PUNCTUATION: 0.1,
  CRYPTO_WALLET: 0.5,
  URL_SHORTENER: 0.3,
  IP_ADDRESS_URL: 0.5,
  CENSORED_PROFANITY: 0.2,
  REPEATED_WORD: 0.3,
  CREDIT_CARD: 0.5,
} as const;
