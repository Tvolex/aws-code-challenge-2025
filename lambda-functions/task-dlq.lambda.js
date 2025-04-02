console.log("Loading task-dlq function");

export const handler = async (event, context) => {
  for (const record of event.Records) {
    const messagePayload =
      typeof event.body === "string" ? JSON.parse(event.body) : event.body;

    console.log("New message in dlq", {
      awsRequestId: context.awsRequestId,
      messagePayload,
    });
  }
};
