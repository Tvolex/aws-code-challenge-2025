import { handler as taskDlqHandler } from './task-dlq.lambda.js'
import { handler as taskGatewayHandler } from './task-gateway.lambda.js'
import { handler as taskProcessingHandler } from './task-processing.lambda.js'

export default {
  taskDlqHandler,
  taskGatewayHandler,
  taskProcessingHandler
}