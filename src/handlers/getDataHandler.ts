import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PostRepository } from '../infrastructure/db/PostRepository';
import { GetDataUseCase } from '../application/GetDataUseCase';

// Composition root: se crea una vez por contenedor Lambda y se reutiliza
// entre invocaciones (mismo patrón que syncDataHandler.ts).
const postRepository = new PostRepository();
const getDataUseCase = new GetDataUseCase(postRepository);

export async function getDataHandler(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const query = event.queryStringParameters ?? {};

    const page = parseOptionalNumber(query.page);
    const limit = parseOptionalNumber(query.limit);
    const userId = parseOptionalNumber(query.userId);

    if (isPresentButInvalid(page) || isPresentButInvalid(limit) || isPresentButInvalid(userId)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          statusCode: 400,
          message: 'Invalid query parameters',
          timestamp: new Date().toISOString(),
        }),
      };
    }

    const result = await getDataUseCase.getData({
      page,
      limit,
      userId,
      search: query.search,
    });

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('Failed to fetch data:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        statusCode: 500,
        message: 'Failed to fetch data',
        timestamp: new Date().toISOString(),
      }),
    };
  }
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  return value === undefined ? undefined : Number(value);
}

function isPresentButInvalid(value: number | undefined): boolean {
  return value !== undefined && Number.isNaN(value);
}
