import { Input } from "./Input";
import type { Size } from "./types";

export interface GameState {
  elapsed: number;
  width: number;
  height: number;
}

export class Game {
  private static readonly SIZE: Size = { width: 640, height: 360 };

  private input: Input;
  private rafId: number | null = null;
  private lastTime = 0;
  private elapsed = 0;
  private onUpdate: (state: GameState) => void;

  constructor(onUpdate: (state: GameState) => void) {
    this.onUpdate = onUpdate;
    this.input = new Input();
  }

  start(): void {
    this.lastTime = performance.now();
    this.tick(this.lastTime);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.input.destroy();
  }

  private tick = (now: number): void => {
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this.elapsed += dt;
    this.update(dt);
    this.onUpdate(this.getState());
    this.rafId = requestAnimationFrame(this.tick);
  };

  private update(_dt: number): void {
    // game logic here
  }

  private getState(): GameState {
    return {
      elapsed: this.elapsed,
      width: Game.SIZE.width,
      height: Game.SIZE.height,
    };
  }
}
