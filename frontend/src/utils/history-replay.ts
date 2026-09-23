import type { OpenHandsEvent } from "#/types/v1/core";
import {
  isConversationStateUpdateEvent,
  isStreamingDeltaEvent,
} from "#/types/v1/type-guards";

// Every (re)connection to a conversation's event socket replays its whole history
// (resend_all), one message per event. The conversation WebSocket context queues a
// connection's replay and adds it to the store in one update, closing the window when
// the stored events it has received reach the count the sandbox reported. This is the
// counting.

/** A connection's history replay, counted against the event count the sandbox reports. */
export interface ReplayWindow {
  active: boolean;
  firstMessage: boolean;
  /** Stored events received so far: what the sandbox's count counts. */
  received: number;
  expected: number | null;
  /** The replay has landed in the store: for the first connection, history has loaded. */
  onEnd: () => void;
}

export const NOT_REPLAYING: ReplayWindow = {
  active: false,
  firstMessage: false,
  received: 0,
  expected: null,
  onEnd: () => {},
};

// How long replayed events may wait in the queue while the replay is still arriving.
export const REPLAY_FLUSH_MS = 100;
// A replay that never reaches its count (the two disagree) stops holding events back.
export const REPLAY_MAX_MS = 10_000;

/**
 * Count one message on a connection: true if it arrived during that connection's replay.
 *
 * The count is of stored events, and two kinds of message are not stored ones. Subscribing
 * pushes a state snapshot before the replay starts (agent_server
 * event_service.subscribe_to_events), and upstream's counter took it for an event, so it
 * called the history loaded one message early: the conversation's last event then landed
 * after the chat had appeared -- here an error banner, which moved the view by 96 px.
 * Streaming deltas are never stored, and a running agent's can arrive mid-replay.
 */
export const countReplayed = (
  replay: ReplayWindow,
  message: unknown,
): boolean => {
  if (!replay.active) return false;
  const event = (typeof message === "object" && message) || {};
  const snapshot =
    replay.firstMessage &&
    isConversationStateUpdateEvent(event as OpenHandsEvent);
  // eslint-disable-next-line no-param-reassign
  replay.firstMessage = false;
  if (!snapshot && !isStreamingDeltaEvent(event as OpenHandsEvent)) {
    // eslint-disable-next-line no-param-reassign
    replay.received += 1;
  }
  return true;
};

export const replayComplete = (replay: ReplayWindow): boolean =>
  replay.active &&
  replay.expected !== null &&
  replay.received >= replay.expected;
