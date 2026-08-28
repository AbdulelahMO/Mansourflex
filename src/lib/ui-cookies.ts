/**
 * Cookie names shared between the server render and the client that writes them. They live
 * outside any "use client" file: a constant exported from one reaches the server as a client
 * reference, not as its value, and the lookup silently misses.
 */
export const SIDEBAR_COOKIE = "sidebar";
