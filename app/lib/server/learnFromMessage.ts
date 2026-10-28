import { after } from "next/server";

import { xanoFetch } from "./xanoProxy";

export type LearnFromMessageInput = {
  message: string;
  previousReply?: string;
  externalUserId?: string;
  deviceId?: string;
  /** The chat's session token; lets Xano leave a signed-in user's own session to the batch job. */
  sessionToken?: string;
};

type Scheduler = (task: () => Promise<void>) => void;
type Fetcher = typeof xanoFetch;

/** Longest previous-reply text forwarded to Xano. */
export const MAX_PREVIOUS_REPLY_CHARS = 1500;

/**
 * Schedules GEN-014 preference learning for a chat message: after the reply has been sent,
 * Xano's ep_learn_from_message_dev decides whether the message says anything about the user's
 * likes or dislikes and saves it to their user context. It never delays or changes the reply,
 * and a failure is only logged.
 */
export function scheduleLearnFromMessage(
  input: LearnFromMessageInput,
  schedule: Scheduler = after,
  fetcher: Fetcher = xanoFetch
): boolean {
  const message = input.message.trim();
  if (!message) return false;

  const previousReply = (input.previousReply ?? "").trim().slice(0, MAX_PREVIOUS_REPLY_CHARS);

  schedule(async () => {
    try {
      await fetcher("genie/ep_learn_from_message_dev", {
        method: "POST",
        body: {
          message,
          previous_reply: previousReply || undefined,
          external_user_id: input.externalUserId || undefined,
          device_id: input.deviceId || undefined,
          session_token: input.sessionToken || undefined,
        },
      });
    } catch (error) {
      console.error("Learning from the chat message failed:", error);
    }
  });

  return true;
}
