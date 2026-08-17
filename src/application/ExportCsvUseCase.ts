import { Parser } from '@json2csv/plainjs';
import type { PostRepository, PostFilters } from '../infrastructure/db/PostRepository';

const CSV_FIELDS = ['id', 'externalId', 'userId', 'title', 'body', 'syncedAt'];

export class ExportCsvUseCase {
  constructor(private readonly postRepository: PostRepository) {}

  async exportToCsv(filters: PostFilters): Promise<string> {
    const posts = await this.postRepository.findAll(filters);
    const parser = new Parser({ fields: CSV_FIELDS });
    return parser.parse(posts);
  }
}
