import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const SYSTEM_PROMPT = `You are a content risk analyzer. Analyze text for harmful content across these categories: TOXICITY, HARASSMENT, HATE, THREAT, SELF_HARM, SEXUAL_CONTENT, SPAM, SCAM, MISINFORMATION.

Respond with ONLY valid JSON matching this exact schema:
{
  "finalLevel": "LOW" | "MEDIUM" | "HIGH",
  "categories": ["TOXICITY", ...],
  "score": 0..1,
  "rationale": "brief explanation, max 500 chars",
  "flaggedFragments": [{ "text": "...", "reason": "..." }]
}

No prose, no markdown fences, just the JSON object.`;

const USER_TEMPLATE = `Heuristic flags pre-detected: {rule_flags}

Text to analyze:
{text}`;

async function main() {
  const template = JSON.stringify({
    system: SYSTEM_PROMPT,
    userTemplate: USER_TEMPLATE,
  });

  await prisma.prompt.upsert({
    where: { name_version: { name: 'content-risk-analysis', version: 1 } },
    create: {
      name: 'content-risk-analysis',
      version: 1,
      template,
      model: 'anthropic/claude-opus-4-5',
      isActive: true,
    },
    update: {},
  });

  console.log('Seeded prompt content-risk-analysis v1');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
