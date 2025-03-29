import {
  SQSClient,
  DeleteMessageBatchCommand,
  ChangeMessageVisibilityBatchCommand,
  GetQueueAttributesCommand,
} from "@aws-sdk/client-sqs";

const QueueUrl =
  "https://sqs.eu-central-1.amazonaws.com/650979641201/TaskProcessingQueue.fifo";
const sqsClient = new SQSClient({});

console.log("Loading function");

class FinalMessageHandler {
  #commandRetryCount = 0;
  #commandMaxRetry = 5;

  #messages = {
    [FinalMessageHandler.MessageType.successful]: [],
    [FinalMessageHandler.MessageType.failed]: [],
  };

  static MessageType = {
    successful: "successful",
    failed: "failed",
  };

  addMessage(message, type) {
    const typeMessage = FinalMessageHandler.MessageType[type];
    this.#messages[typeMessage]?.push(message);
  }

  async #processSuccessfulMessages() {
    const preparedMessages = this.#messages[
      FinalMessageHandler.MessageType.successful
    ].map((message) => {
      return {
        Id: message.messageId,
        ReceiptHandle: message.receiptHandle,
      };
    });
    await this.#deleteFromQueue(preparedMessages);
  }

  async #processFailedMessages() {
    const Entries = this.#messages[FinalMessageHandler.MessageType.failed].map(
      (message) => {
        const VisibilityTimeout =
          this.#getQeueuVisibilityTimeout *
          (message.Attributes.ApproximateReceiveCount || 1);
        return {
          Id: message.messageId,
          ReceiptHandle: message.receiptHandle,
          VisibilityTimeout,
        };
      },
    );
  }

  async processMessages() {
    await Promise.all([
      this.#processSuccessfulMessages(),
      this.#processFailedMessages(),
    ]);
  }

  async #getQeueuVisibilityTimeout() {
    const command = new GetQueueAttributesCommand({
      QueueUrl,
      AttributeNames: ["VisibilityTimeout"],
    });
    const response = await sqsClient.send(command);
    return response?.Attributes?.VisibilityTimeout || 1;
  }

  async #changeVisibility(messages) {
    const messageParams = {
      QueueUrl,
      Entries: messages,
    };
    await this.#runRetrySqsCommand(
      ChangeMessageVisibilityBatchCommand,
      messageParams,
    );
  }

  async #deleteFromQueue(messages) {
    if (!messages || !messages.length) return;

    const messageParams = {
      QueueUrl,
      Entries: messages,
    };
    await this.#runRetrySqsCommand(DeleteMessageBatchCommand, messageParams);
  }

  async #runRetrySqsCommand(CommandPattern, messageParams) {
    const command = new CommandPattern(messageParams);
    const commandResponse = await sqsClient.send(command);

    console.log(
      `Command (${CommandPattern.name}) response, successful: ${commandResponse.Successful?.length || 0}, failed: ${commandResponse.Failed?.length || 0}`,
    );

    if (commandResponse?.Failed?.length) {
      if (this.#commandRetryCount > this.#commandMaxRetry) {
        console.log(
          `Maximum retries of reached. Current failed msgs length ${commandResponse.Failed.length}`,
        );
        return;
      }

      this.#commandRetryCount++;

      const retryMessageParams = {
        ...messageParams,
        Entries: commandResponse.Failed,
      };
      await this.#runRetrySqsCommand(command, retryMessageParams);
    }
  }
}

export const handler = async (event) => {
  const finalMessageHandler = new FinalMessageHandler();

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

  return `Successfully processed ${event.Records.length} messages.`;
};
