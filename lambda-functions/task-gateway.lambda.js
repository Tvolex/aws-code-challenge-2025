import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqsClient = new SQSClient({});

console.log("Loading task-gateway function");

// taskId (string, unique)
// payload (JSON object with arbitrary data)

export const handler = async (event, context) => {
  console.log("New message on API gateway", context.awsRequestId, event.body);

  const body =
    event.body &&
    (typeof event.body === "string" ? JSON.parse(event.body) : event.body);

  const { taskId, payload } = body;
  if (!taskId || !payload) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "taskId and payload are required" }),
    };
  }

  const messageParams = {
    QueueUrl: process.env.TASK_PROCESSING_QUEUE_URL,
    MessageBody: JSON.stringify({ taskId, payload }),
    MessageGroupId: context.awsRequestId,
    MessageDeduplicationId: context.awsRequestId,
  };

  const sendMessageCommand = new SendMessageCommand(messageParams);
  const sentMessageInfo = await sqsClient.send(sendMessageCommand);
  console.log("sent message to the queue", { sentMessageInfo });

  return {
    taskId,
    queueId: sentMessageInfo.MessageId,
  };
};
