/**
 * The words that must be typed to empty the system. Kept outside the "use server" file that
 * checks it: an exported const there is not a server action, and the build refuses it — the
 * same rule that once made a cookie name arrive at the server as a reference instead of a value.
 */
export const RESET_PHRASE = "أفرغ البيانات";
