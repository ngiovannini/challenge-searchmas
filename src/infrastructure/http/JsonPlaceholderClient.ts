const DEFAULT_BASE_URL = "https://jsonplaceholder.typicode.com";
const REQUEST_TIMEOUT_MS = 10_000;

export interface JsonPlaceholderPost {
  id: number;
  userId: number;
  title: string;
  body: string;
}

export class JsonPlaceholderClient {
  constructor(
    private readonly baseUrl: string = process.env.JSONPLACEHOLDER_BASE_URL ??
      DEFAULT_BASE_URL,
  ) {}

  async getPosts(): Promise<JsonPlaceholderPost[]> {
    const url = `${this.baseUrl}/posts`;
    let response: Response;

    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new Error(
        `Failed to reach JSONPlaceholder at ${url}: ${toErrorMessage(error)}`,
      );
    }

    if (!response.ok) {
      throw new Error(
        `JSONPlaceholder responded with ${response.status} ${response.statusText} for ${url}`,
      );
    }

    return (await response.json()) as JsonPlaceholderPost[];
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
