// hederaClient.js
import { Client, TopicCreateTransaction, TopicMessageSubmitTransaction, TopicMessageQuery } from "@hashgraph/sdk";
import dotenv from "dotenv";
dotenv.config();

const operatorId = process.env.OPERATOR_ID;
const operatorKey = process.env.OPERATOR_KEY;
if (!operatorId || !operatorKey) {
  console.error("Missing OPERATOR_ID or OPERATOR_KEY in environment. See .env.example");
  process.exit(1);
}

const client = Client.forTestnet();
client.setOperator(operatorId, operatorKey);

/**
 * Create a new topic and return its id string.
 */
export async function createTopic() {
  const tx = await new TopicCreateTransaction().execute(client);
  const receipt = await tx.getReceipt(client);
  return receipt.topicId.toString();
}

/**
 * Submit a message (Buffer|Uint8Array|string) to the given topicId.
 * Returns a Date for the consensus timestamp (or current date as fallback).
 */
export async function submitMessage(topicId, message) {
  const txResponse = await new TopicMessageSubmitTransaction({
    topicId,
    message
  }).execute(client);

  // getReceipt may not always include consensusTimestamp (depending on network/node timing),
  // so guard against undefined and return a fallback Date.
  let receipt;
  try {
    receipt = await txResponse.getReceipt(client);
  } catch (err) {
    console.warn("Could not get receipt via getReceipt():", err);
    // still proceed with txResponse as best-effort
  }

  if (receipt && receipt.consensusTimestamp) {
    return receipt.consensusTimestamp.toDate();
  }

  // fallback: try to get record (not always available) or return current time
  try {
    const record = await txResponse.getRecord(client).catch(() => null);
    if (record && record.consensusTimestamp) {
      return record.consensusTimestamp.toDate();
    }
  } catch (err) {
    // ignore
  }

  console.warn("Receipt lacked consensusTimestamp — using now() as fallback");
  return new Date();
}

/**
 * Subscribe to a topic on the mirror stream. Calls onMessage(messageObj) for each received message.
 * Returns the subscription object (with unsubscribe()).
 */
export function subscribeToTopic(topicId, onMessage, maxAttempts = 8) {
  // We'll try to subscribe with exponential backoff if mirror node initially reports NOT_FOUND.
  let attempt = 0;

  const trySubscribe = () => {
    attempt += 1;
    try {
      const subscription = new TopicMessageQuery()
        .setTopicId(topicId)
        .subscribe(
          client,
          null,
          (message) => {
            onMessage(message);
          },
          (err) => {
            // Mirror node errors often include NOT_FOUND right after create; bubble up only on fatal errors
            console.error(`Mirror subscription error (attempt ${attempt}):`, err);
          }
        );

      console.log(`Mirror subscription successful for topic ${topicId} (attempt ${attempt})`);
      return subscription;
    } catch (err) {
      // This block may not always run (subscribe returns immediately or throws asynchronously),
      // but keep it for defensive programming.
      console.error(`Error creating subscription attempt ${attempt}:`, err);
      return null;
    }
  };

  return new Promise((resolve, reject) => {
    const attemptSubscribe = async () => {
      try {
        const sub = trySubscribe();
        if (sub) {
          return resolve(sub);
        }
      } catch (err) {
        // continue to retry below
      }

      if (attempt >= maxAttempts) {
        return reject(new Error(`Failed to subscribe to topic ${topicId} after ${attempt} attempts`));
      }

      // exponential backoff delay (ms)
      const delay = 250 * Math.pow(2, attempt - 1);
      console.log(`Error subscribing to topic ${topicId} during attempt ${attempt - 1}. Waiting ${delay} ms before next attempt.`);
      setTimeout(attemptSubscribe, delay);
    };

    // start
    attemptSubscribe();
  });
}
