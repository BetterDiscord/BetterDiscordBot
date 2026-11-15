/**
 * Display-name hygiene, shared by the `cleanname` command and its join handler.
 * Previously duplicated in both, with a `TODO` acknowledging it.
 */

/**
 * Anything outside Discord's username standards.
 *
 * Deliberately NOT global. `RegExp.prototype.test` advances `lastIndex` on a
 * `/g` regex and resumes from there on the next call, so a shared global regex
 * returns alternating results across calls. That made `/cleanname server` skip
 * a share of the members it should have renamed on every run.
 */
const disallowedChars = /[^A-Za-z0-9\-_\\. ]/;

export const hasDisallowedChars = (displayName: string): boolean => disallowedChars.test(displayName);
