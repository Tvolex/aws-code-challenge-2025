import FinalMessageHandler from "../modules/finalMessageHandler.js";

console.log("Loading task-processing function");

export const handler = async (event) => {
  const finalMessageHandler = new FinalMessageHandler(
    process.env.TASK_PROCESSING_QUEUE_URL,
  );

  for (const record of event.Records) {
    try {
      const { messageId, body } = record;
      console.log("New message", messageId, body);

      const data =
        body && typeof body === "string" ? JSON.parse(body) : event.body;

      const throwAnError = Math.random() <= 0.3;

      if (throwAnError) {
        throw new Error("Some error appear here");
      }

      console.log(`Successfuly processed taskId: ${data.taskId}`, {
        taskId: data.taskId,
        payload: data.payload,
        messageId,
      });
      finalMessageHandler.addMessage(
        record,
        FinalMessageHandler.MessageType.successful,
      );
    } catch (e) {
      console.error(e);
      finalMessageHandler.addMessage(
        record,
        FinalMessageHandler.MessageType.failed,
      );
    }
  }

  await finalMessageHandler.processMessages();

  if (finalMessageHandler.hasFailedMessages()) {
    throw new Error("Some messages failed processing, retrying...");
  }

  return `Successfully processed ${event.Records.length} messages.`;
};
