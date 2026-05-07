import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ContentRiskCategory } from '../../../../../domain/content-risk-checks/enums/content-risk-category.enum';

export interface BlacklistRule {
  id: string;
  category: ContentRiskCategory;
  weight: number;
  words: string[];
}

const RULES_DIR = path.join(process.cwd(), 'config', 'rules');

@Injectable()
export class RulesProvider implements OnModuleInit {
  private readonly logger = new Logger(RulesProvider.name);
  private cache: BlacklistRule[] = [];

  onModuleInit(): void {
    this.cache = RulesProvider.loadFromDisk(RULES_DIR);
    this.logger.log(
      `Loaded ${this.cache.length} blacklist rule set(s) from ${RULES_DIR}`,
    );
  }

  getBlacklistRules(): BlacklistRule[] {
    return this.cache;
  }

  static loadFromDisk(dir: string): BlacklistRule[] {
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    const rules: BlacklistRule[] = [];
    for (const file of files) {
      const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
      const parsed = JSON.parse(raw) as BlacklistRule;
      if (!isValidCategory(parsed.category)) {
        throw new Error(
          `Invalid category "${parsed.category}" in ${file}`,
        );
      }
      rules.push({
        id: parsed.id,
        category: parsed.category,
        weight: parsed.weight,
        words: parsed.words.map((w) => w.toLowerCase()),
      });
    }
    return rules;
  }
}

function isValidCategory(value: string): value is ContentRiskCategory {
  return (Object.values(ContentRiskCategory) as string[]).includes(value);
}
