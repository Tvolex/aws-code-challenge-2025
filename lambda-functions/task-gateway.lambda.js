import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqsClient = new SQSClient({});

console.log('Loading function');

// taskId (string, unique)
// payload (JSON object with arbitrary data)

export const handler = async (event, context) => {
    console.log('New message', context.awsRequestId, event.body);

    const body = event.body && (typeof event.body === 'string' ? JSON.parse(event.body) : event.body);

    const { taskId, payload } = body;
    if (!taskId || !payload) {
        return {
            statusCode: 400,
            body: JSON.stringify({error: 'taskId and payload are required'}),
        };
    }

    const messageParams = {
        QueueUrl: 'https://sqs.eu-central-1.amazonaws.com/650979641201/TaskProcessingQueue.fifo',
        MessageBody: JSON.stringify({ taskId, payload }),
        MessageGroupId: context.awsRequestId,
        MessageDeduplicationId: context.awsRequestId
    }

    const sendMessageCommand = new SendMessageCommand(messageParams)
    const sentMessageInfo = await sqsClient.send(sendMessageCommand);

    return {
        taskId,
        queueId: sentMessageInfo.MessageId
    };
};
