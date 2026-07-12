export class Input {
  private keys = new Set<string>();
  private justPressed = new Set<string>();
  private readonly onKeyDown: (e: KeyboardEvent) => void;
  private readonly onKeyUp: (e: KeyboardEvent) => void;
  private readonly onVisibilityChange: () => void;

  constructor() {
    this.onKeyDown = (e) => {
      if (this.isGameKey(e.code)) {
        e.preventDefault();
      }

      if (!this.keys.has(e.code)) {
        this.justPressed.add(e.code);
      }
      this.keys.add(e.code);
    };

    this.onKeyUp = (e) => {
      this.keys.delete(e.code);
    };

    this.onVisibilityChange = () => {
      if (document.hidden) {
        this.clear();
      }
    };

    document.addEventListener("keydown", this.onKeyDown, true);
    document.addEventListener("keyup", this.onKeyUp, true);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  destroy(): void {
    document.removeEventListener("keydown", this.onKeyDown, true);
    document.removeEventListener("keyup", this.onKeyUp, true);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.clear();
  }

  private clear(): void {
    this.keys.clear();
    this.justPressed.clear();
  }

  private isGameKey(code: string): boolean {
    if (code.startsWith("Arrow") || code.startsWith("Key")) return true;
    return code === "Space" || code === "ShiftLeft" || code === "ShiftRight" || code === "Escape";
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  isPressed(code: string): boolean {
    if (!this.justPressed.has(code)) return false;
    this.justPressed.delete(code);
    return true;
  }
}
