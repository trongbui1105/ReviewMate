import * as vscode from 'vscode';
import { ProviderName } from './types';

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `rm_usage_${y}-${m}-${day}`;
}

/**
 * Lightweight per-day usage counter. Always allows reviews for the MVP —
 * the structure is in place to add freemium gates later without churning
 * the call sites.
 */
export class UsageTracker {
  constructor(private readonly context: vscode.ExtensionContext) {}

  /** Returns whether the user is allowed to run another review. */
  canReview(): boolean {
    return true;
  }

  /** Increments today's review count. */
  increment(): void {
    const key = todayKey();
    const current = this.context.globalState.get<number>(key, 0);
    void this.context.globalState.update(key, current + 1);
  }

  /** Returns the number of reviews run today. */
  getTodayCount(): number {
    return this.context.globalState.get<number>(todayKey(), 0);
  }

  /** Reads the configured provider name from VS Code settings. */
  getProviderName(): ProviderName {
    const config = vscode.workspace.getConfiguration('reviewmate');
    return config.get<ProviderName>('provider', 'gemini');
  }
}
