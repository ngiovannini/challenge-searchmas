import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { JsonPlaceholderClient } from "../infrastructure/http/JsonPlaceholderClient";
import { PostRepository } from "../infrastructure/db/PostRepository";
import { SqsPublisher } from "../infrastructure/queue/SqsPublisher";
import { SyncDataUseCase } from "../application/SyncDataUseCase";

// Composition root: se crea una vez por contenedor Lambda y se reutiliza
// entre invocaciones (mismo criterio que el singleton de PrismaClient).
//
// En este diseño simulado, SqsPublisher.publish() invoca directamente a
// processSyncJob vía subscribe() (sin trigger real de SQS), así que no hay
// un handler Lambda separado para el consumer: processSyncJob cumple acá
// el rol que en un entorno real cumpliría syncDataConsumerHandler.

const jsonPlaceholderClient = new JsonPlaceholderClient();
const postRepository = new PostRepository();
const sqsPublisher = new SqsPublisher();
const syncDataUseCase = new SyncDataUseCase(
  jsonPlaceholderClient,
  postRepository,
  sqsPublisher,
);
sqsPublisher.subscribe((message) => syncDataUseCase.processSyncJob(message));

export async function syncDataHandler(
  _event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const { jobId } = await syncDataUseCase.trigger();

    return {
      statusCode: 202,
      body: JSON.stringify({ message: "Sync job accepted", jobId }),
    };
  } catch (error) {
    console.error("Failed to enqueue sync job:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        statusCode: 500,
        message: "Failed to enqueue sync job",
        timestamp: new Date().toISOString(),
      }),
    };
  }
}
