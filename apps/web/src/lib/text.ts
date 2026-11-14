/** Words in markdown text: tokens that contain a letter or digit (markdown symbols alone don't count). */
export const countWords = (md: string) => md.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;

/** Minutes to read at 200 words per minute, at least 1 for non-empty text (C12). */
export const readingMinutes = (words: number) => (words ? Math.max(1, Math.round(words / 200)) : 0);
