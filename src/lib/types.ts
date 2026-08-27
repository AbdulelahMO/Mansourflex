export type ActionState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
  /** The action is permitted only as an approval request; the caller must collect a reason. */
  needsReason?: boolean;
  /** Outstanding money was found; the caller must confirm knowingly before it proceeds. */
  needsAcknowledge?: boolean;
};

export const initialActionState: ActionState = {};
