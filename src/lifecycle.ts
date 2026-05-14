/*
 *      _           _      _
 *  ___| |__  _   _| |_ __| | _____      ___ __        _ __ ___   __ _ _ __   __ _  __ _  ___ _ __
 * / __| '_ \| | | | __/ _` |/ _ \ \ /\ / / '_ \ _____| '_ ` _ \ / _` | '_ \ / _` |/ _` |/ _ \ '__|
 * \__ \ | | | |_| | || (_| | (_) \ V  V /| | | |_____| | | | | | (_| | | | | (_| | (_| |  __/ |
 * |___/_| |_|\__,_|\__\__,_|\___/ \_/\_/ |_| |_|     |_| |_| |_|\__,_|_| |_|\__,_|\__, |\___|_|
 *                                                                                  |___/
 *
 *  shutdown-manager  --  production shutdown orchestration for Node.js HTTP services
 *
 *  Author  : Ritesh Rana  <contact@riteshrana.engineer>
 *  Support : https://buymeacoffee.com/ritesh.rana
 *  License : MIT
 */
import type { LifecyclePhase } from './types.js';

const TRANSITIONS: Record<LifecyclePhase, LifecyclePhase[]> = {
  idle: ['preShutdown'],
  preShutdown: ['draining', 'cleanup', 'failed'],
  draining: ['cleanup', 'failed'],
  cleanup: ['done', 'failed'],
  done: [],
  failed: [],
};

export class LifecycleState {
  private current: LifecyclePhase = 'idle';
  private readonly startedAt = new Map<LifecyclePhase, number>();
  private readonly endedAt = new Map<LifecyclePhase, number>();

  get phase(): LifecyclePhase {
    return this.current;
  }

  isTerminal(): boolean {
    return this.current === 'done' || this.current === 'failed';
  }

  canTransition(to: LifecyclePhase): boolean {
    return TRANSITIONS[this.current].includes(to);
  }

  transition(to: LifecyclePhase): {
    from: LifecyclePhase;
    to: LifecyclePhase;
    durationMs?: number;
  } {
    if (!this.canTransition(to)) {
      throw new Error(`Invalid lifecycle transition: ${this.current} → ${to}`);
    }
    const from = this.current;
    const now = Date.now();
    this.endedAt.set(from, now);
    this.startedAt.set(to, now);
    this.current = to;
    const startedAt = this.startedAt.get(from);
    const durationMs = startedAt === undefined ? undefined : now - startedAt;
    return { from, to, durationMs };
  }

  begin(): void {
    if (this.startedAt.has('idle')) return;
    this.startedAt.set('idle', Date.now());
  }

  totalDurationMs(): number {
    const start = this.startedAt.get('idle');
    if (start === undefined) return 0;
    return Date.now() - start;
  }
}
