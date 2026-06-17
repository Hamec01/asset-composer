/**
 * AnimationController — single source of truth for animation playback time.
 *
 * Uses requestAnimationFrame for the clock. Does NOT write to Zustand on every
 * tick; instead callers register tick listeners (60fps) or sync listeners (≈10fps).
 *
 * Usage:
 *   animController.play()
 *   animController.addTickListener(t => renderAt(t))
 *   animController.addSyncListener(t => store.setTime(t))  // cheap UI sync
 */

export type TickListener = (timeMs: number) => void;

export class AnimationController {
  private _timeMs       = 0;
  private _durationMs   = 2000;
  private _playing      = false;
  private _looping      = true;
  private _speed        = 1;
  private _rafId: number | null = null;
  private _lastTs: number | null = null;

  private _tickListeners = new Set<TickListener>();
  private _syncListeners = new Set<TickListener>();
  private _lastSyncTs    = 0;
  private _SYNC_INTERVAL = 80; // ms between sync listener calls

  // ── Getters ────────────────────────────────────────────────────────────────

  get currentTimeMs(): number { return this._timeMs; }
  get isPlaying():     boolean { return this._playing; }
  get isLooping():     boolean { return this._looping; }
  get speed():         number  { return this._speed; }
  get durationMs():    number  { return this._durationMs; }

  // ── Configuration ──────────────────────────────────────────────────────────

  setDuration(ms: number): void {
    this._durationMs = Math.max(1, ms);
    if (this._timeMs > this._durationMs) {
      this._timeMs = this._looping
        ? this._timeMs % this._durationMs
        : this._durationMs;
    }
  }

  setLoop(loop: boolean): void { this._looping = loop; }

  setSpeed(speed: number): void {
    this._speed = Math.max(0.1, Math.min(10, speed));
  }

  // ── Transport ──────────────────────────────────────────────────────────────

  play(): void {
    if (this._playing) return;
    if (this._timeMs >= this._durationMs && !this._looping) {
      this._timeMs = 0;
    }
    this._playing  = true;
    this._lastTs   = null;
    this._schedule();
  }

  pause(): void {
    if (!this._playing) return;
    this._playing = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._notifySync(performance.now(), true);
  }

  restart(): void {
    this._timeMs  = 0;
    this._lastTs  = null;
    if (!this._playing) this.play();
  }

  seek(ms: number): void {
    this._timeMs = Math.max(0, Math.min(ms, this._durationMs));
    this._notifyAll(this._timeMs);
    this._notifySync(performance.now(), true);
  }

  stepForward(fps = 24): void {
    this.seek(Math.min(this._timeMs + 1000 / fps, this._durationMs));
  }

  stepBackward(fps = 24): void {
    this.seek(Math.max(this._timeMs - 1000 / fps, 0));
  }

  // ── Listeners ──────────────────────────────────────────────────────────────

  /** Called every RAF frame (≈60fps). Ideal for renderers (Pixi, Canvas). */
  addTickListener(fn: TickListener): () => void {
    this._tickListeners.add(fn);
    fn(this._timeMs);
    return () => this._tickListeners.delete(fn);
  }

  /** Called ≈every 80ms (≈12fps). Ideal for UI sync (store, scrubber). */
  addSyncListener(fn: TickListener): () => void {
    this._syncListeners.add(fn);
    fn(this._timeMs);
    return () => this._syncListeners.delete(fn);
  }

  // ── Internal RAF loop ──────────────────────────────────────────────────────

  private _schedule(): void {
    this._rafId = requestAnimationFrame(this._frame);
  }

  private _frame = (ts: number): void => {
    if (!this._playing) return;

    if (this._lastTs !== null) {
      const deltaMs = (ts - this._lastTs) * this._speed;
      this._timeMs += deltaMs;

      if (this._looping) {
        this._timeMs = ((this._timeMs % this._durationMs) + this._durationMs) % this._durationMs;
      } else if (this._timeMs >= this._durationMs) {
        this._timeMs  = this._durationMs;
        this._playing = false;
        this._notifyAll(this._timeMs);
        this._notifySync(ts, true);
        return;
      }
    }
    this._lastTs = ts;

    this._notifyAll(this._timeMs);
    this._notifySync(ts, false);

    if (this._playing) this._schedule();
  };

  private _notifyAll(t: number): void {
    for (const fn of this._tickListeners) {
      try { fn(t); } catch (e) { console.error('[AnimCtrl] tick error', e); }
    }
  }

  private _notifySync(ts: number, force: boolean): void {
    if (!force && ts - this._lastSyncTs < this._SYNC_INTERVAL) return;
    this._lastSyncTs = ts;
    for (const fn of this._syncListeners) {
      try { fn(this._timeMs); } catch (e) { console.error('[AnimCtrl] sync error', e); }
    }
  }
}

/** Module-level singleton — shared by all consumers. */
export const animController = new AnimationController();
