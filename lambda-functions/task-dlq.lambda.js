import { SQSClient, DeleteMessageBatchCommand } from "@aws-sdk/client-sqs";

const sqsClient = new SQSClient({});
const deleteSuccessfulMessages = async (messages) => {
    if (!messages || !messages.length) return;

    const messageParams = {
        QueueUrl: 'https://sqs.eu-central-1.amazonaws.com/650979641201/taskDLQ.fifo',
        Entries: messages
    }
    const sendDeleteBatchCommand = new DeleteMessageBatchCommand(messageParams)
    await sqsClient.send(sendDeleteBatchCommand);
}

export const handler = async (event, context) => {
  const successfulMessages = [];
  for (const record of event.Records) {
    const messagePayload = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;

    console.log('New message in dlq', {
      awsRequestId: context.awsRequestId,
      messagePayload
    });

    successfulMessages.push({
      Id: record.messageId,
      ReceiptHandle: record.receiptHandle
    });
  }

  await deleteSuccessfulMessages(successfulMessages);
};