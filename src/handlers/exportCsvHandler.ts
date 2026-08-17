import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PostRepository } from '../infrastructure/db/PostRepository';
import { ExportCsvUseCase } from '../application/ExportCsvUseCase';

// Composition root: se crea una vez por contenedor Lambda y se reutiliza
// entre invocaciones (mismo patrón que los demás handlers).
const postRepository = new PostRepository();
const exportCsvUseCase = new ExportCsvUseCase(postRepository);

export async function exportCsvHandler(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const query = event.queryStringParameters ?? {};
    const userId = parseOptionalNumber(query.userId);

    if (isPresentButInvalid(userId)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          statusCode: 400,
          message: 'Invalid query parameters',
          timestamp: new Date().toISOString(),
        }),
      };
    }

    const csv = await exportCsvUseCase.exportToCsv({
      userId,
      search: query.search,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="posts-export.csv"',
      },
      body: csv,
    };
  } catch (error) {
    console.error('Failed to generate CSV export:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        statusCode: 500,
        message: 'Failed to generate CSV export',
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
