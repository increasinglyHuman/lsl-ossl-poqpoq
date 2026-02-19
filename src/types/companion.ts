/**
 * AI Companion interface — unique to poqpoq.
 * Bridges the scripting engine to the AI companion system (Bob, etc.)
 */

/** Companion interface for AI interactions from scripts */
export interface Companion {
  /** Companion's display name (e.g., "Bob") */
  readonly name: string;

  /** Companion's unique ID */
  readonly id: string;

  /** Ask the companion a question — returns the response */
  ask(prompt: string): Promise<string>;

  /** Have the companion announce something to nearby agents */
  announce(message: string): void;

  /** Have the companion say something in chat */
  say(message: string, channel?: number): void;

  /** Request the companion to perform an action (e.g., "set the sky to sunset") */
  requestAction(action: string): Promise<boolean>;

  /** Get companion's current mood/personality state */
  getMood(): string;
}

/** Companion factory — available via world.companion */
export interface CompanionAPI {
  /** Get the current world's companion */
  get(): Companion | null;

  /** Check if a companion is available */
  isAvailable(): boolean;
}
