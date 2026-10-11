// Tags, statuses and kinds in this app are bit flags, never strings. A value is a power of two, written as a plain number so its type stays exact, and two can be OR'ed into a set.

/** A number made of flags OR'ed together. */
export type Flags = number;

/** True when `flags` has at least one of the bits of `flag`. */
export function has(flags: Flags, flag: Flags): boolean {
  return (flags & flag) !== 0;
}
