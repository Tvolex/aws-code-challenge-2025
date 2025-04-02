import {
  SQSClient,
  DeleteMessageBatchCommand,
  ChangeMessageVisibilityBatchCommand,
  GetQueueAttributesCommand,
} from "@aws-sdk/client-sqs";

class FinalMessageHandler {
  #commandRetryCount = 0;
  #commandMaxRetry = 5;

  #messages = {
    [FinalMessageHandler.MessageType.successful]: [],
    [FinalMessageHandler.MessageType.failed]: [],
  };

  constructor(queueUrl) {
    this.queueUrl = queueUrl || process.env.TASK_PROCESSING_QUEUE_URL;
    this.sqsClient = new SQSClient({});
  }

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
    const currentQueueVisibilityTimeout =
      await this.#getQeueuVisibilityTimeout();

    const messages = this.#messages[FinalMessageHandler.MessageType.failed].map(
      (message) => {
        const VisibilityTimeout =
          currentQueueVisibilityTimeout *
          +(message.attributes?.ApproximateReceiveCount || 1);

        console.log("visible timeouts", {
          currentQueueVisibilityTimeout,
          ApproximateReceiveCount: message.attributes?.ApproximateReceiveCount,
          VisibilityTimeout,
        });
        return {
          Id: message.messageId,
          ReceiptHandle: message.receiptHandle,
          VisibilityTimeout,
        };
      },
    );

    await this.#changeVisibility(messages);
  }

  async processMessages() {
    await Promise.all([
      this.#processSuccessfulMessages(),
      this.#processFailedMessages(),
    ]);
  }

  hasFailedMessages() {
    return !!this.#messages[FinalMessageHandler.MessageType.failed].length;
  }

  async #getQeueuVisibilityTimeout() {
    const command = new GetQueueAttributesCommand({
      QueueUrl: this.queueUrl,
      AttributeNames: ["VisibilityTimeout"],
    });
    const response = await this.sqsClient.send(command);
    console.log("response visibilityTimeout", JSON.stringify(response));
    return response?.Attributes?.VisibilityTimeout || 1;
  }

  async #changeVisibility(messages) {
    if (!messages?.length) return;

    const messageParams = {
      QueueUrl: this.queueUrl,
      Entries: messages,
    };
    await this.#runRetrySqsCommand(
      ChangeMessageVisibilityBatchCommand,
      messageParams,
    );
  }

  async #deleteFromQueue(messages) {
    if (!messages?.length) return;

    const messageParams = {
      QueueUrl: this.queueUrl,
      Entries: messages,
    };
    await this.#runRetrySqsCommand(DeleteMessageBatchCommand, messageParams);
  }

  async #runRetrySqsCommand(CommandPattern, messageParams) {
    const command = new CommandPattern(messageParams);
    const commandResponse = await this.sqsClient.send(command);

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

export default FinalMessageHandler;
