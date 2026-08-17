import type { PostRepository, PostFilters } from '../infrastructure/db/PostRepository';
import type { Post } from '../domain/Post';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface GetDataParams {
  page?: number;
  limit?: number;
  userId?: number;
  search?: string;
}

export interface GetDataResult {
  data: Post[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class GetDataUseCase {
  constructor(private readonly postRepository: PostRepository) {}

  async getData(params: GetDataParams): Promise<GetDataResult> {
    const page = normalizePositiveInt(params.page, DEFAULT_PAGE);
    const limit = Math.min(normalizePositiveInt(params.limit, DEFAULT_LIMIT), MAX_LIMIT);
    const search = params.search || undefined; // string vacío = filtro no pasado

    const filters: PostFilters = {
      ...(params.userId !== undefined ? { userId: params.userId } : {}),
      ...(search ? { search } : {}),
    };

    const skip = (page - 1) * limit;
    const { posts, total } = await this.postRepository.findPaginated(filters, skip, limit);

    return {
      data: posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

function normalizePositiveInt(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isInteger(value) || value <= 0) {
    return fallback;
  }
  return value;
}
