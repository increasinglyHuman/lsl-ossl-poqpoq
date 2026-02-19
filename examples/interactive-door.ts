/**
 * Interactive Door — Classic LSL pattern, modern TypeScript.
 *
 * LSL equivalent would require ~40 lines with state blocks.
 * This version is cleaner, async, and supports smooth animation.
 */

import { WorldScript, Vector3, type Agent } from "../src/types/index.js";

export default class InteractiveDoor extends WorldScript {
  private isOpen = false;
  private autoCloseTimer = "autoClose";

  states = {
    default: {
      async onTouchStart(this: InteractiveDoor, agent: Agent) {
        if (this.isOpen) {
          await this.close();
        } else {
          await this.open();
        }
      },

      onTimer(this: InteractiveDoor, timerId?: string) {
        if (timerId === this.autoCloseTimer) {
          this.close();
        }
      },
    },
  };

  async open() {
    this.isOpen = true;
    this.say(0, "Opening...");
    await this.object.rotateTo(0, 90, 0, { duration: 0.5, easing: "easeInOut" });
    this.setTimer(10, this.autoCloseTimer);
  }

  async close() {
    this.isOpen = false;
    this.clearTimer(this.autoCloseTimer);
    this.say(0, "Closing...");
    await this.object.rotateTo(0, 0, 0, { duration: 0.5, easing: "easeInOut" });
  }
}
