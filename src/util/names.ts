/**
 * Display name checks shared by the `cleanname` command and its join handler.
 */

/**
 * Anything outside Discord's username standards.
 *
 * Deliberately not global: `RegExp.prototype.test` on a `/g` regex advances
 * `lastIndex` and resumes there on the next call, so a shared global regex
 * returns alternating results for matching names.
 */
const disallowedChars = /[^A-Za-z0-9\-_\\. ]/;

export const hasDisallowedChars = (displayName: string): boolean => disallowedChars.test(displayName);
