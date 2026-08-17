import { GetDataUseCase } from '../../src/application/GetDataUseCase';
import type { PostRepository } from '../../src/infrastructure/db/PostRepository';
import type { Post } from '../../src/domain/Post';

function createMocks() {
  const postRepository = {
    findPaginated: jest.fn(),
  } as unknown as jest.Mocked<PostRepository>;

  return { postRepository };
}

const samplePost: Post = {
  id: 'uuid-1',
  externalId: 1,
  userId: 1,
  title: 'a title',
  body: 'a body',
  syncedAt: new Date('2026-08-15T10:00:00Z'),
};

describe('GetDataUseCase', () => {
  it('applies defaults (page: 1, limit: 20) when page/limit are not provided', async () => {
    const { postRepository } = createMocks();
    postRepository.findPaginated.mockResolvedValue({ posts: [], total: 0 });
    const useCase = new GetDataUseCase(postRepository);

    await useCase.getData({});

    expect(postRepository.findPaginated).toHaveBeenCalledWith({}, 0, 20);
  });

  it.each([-3, 0, 1.5])('falls back to page: 1 (skip: 0) when page is invalid (%s)', async (page) => {
    const { postRepository } = createMocks();
    postRepository.findPaginated.mockResolvedValue({ posts: [], total: 0 });
    const useCase = new GetDataUseCase(postRepository);

    const result = await useCase.getData({ page });

    expect(postRepository.findPaginated).toHaveBeenCalledWith({}, 0, 20);
    expect(result.pagination.page).toBe(1);
  });

  it.each([-3, 0, 1.5])('falls back to limit: 20 when limit is invalid (%s)', async (limit) => {
    const { postRepository } = createMocks();
    postRepository.findPaginated.mockResolvedValue({ posts: [], total: 0 });
    const useCase = new GetDataUseCase(postRepository);

    const result = await useCase.getData({ limit });

    expect(postRepository.findPaginated).toHaveBeenCalledWith({}, 0, 20);
    expect(result.pagination.limit).toBe(20);
  });

  it('caps limit at 100 when a larger value is requested', async () => {
    const { postRepository } = createMocks();
    postRepository.findPaginated.mockResolvedValue({ posts: [], total: 0 });
    const useCase = new GetDataUseCase(postRepository);

    const result = await useCase.getData({ limit: 500 });

    expect(postRepository.findPaginated).toHaveBeenCalledWith({}, 0, 100);
    expect(result.pagination.limit).toBe(100);
  });

  it('treats an empty search string as if it were not passed', async () => {
    const { postRepository } = createMocks();
    postRepository.findPaginated.mockResolvedValue({ posts: [], total: 0 });
    const useCase = new GetDataUseCase(postRepository);

    await useCase.getData({ search: '' });

    expect(postRepository.findPaginated).toHaveBeenCalledWith({}, 0, 20);
  });

  it('passes combined userId and search filters to the repository', async () => {
    const { postRepository } = createMocks();
    postRepository.findPaginated.mockResolvedValue({ posts: [], total: 0 });
    const useCase = new GetDataUseCase(postRepository);

    await useCase.getData({ userId: 5, search: 'qui' });

    expect(postRepository.findPaginated).toHaveBeenCalledWith(
      { userId: 5, search: 'qui' },
      0,
      20,
    );
  });

  it('calculates skip/take correctly from page/limit', async () => {
    const { postRepository } = createMocks();
    postRepository.findPaginated.mockResolvedValue({ posts: [], total: 0 });
    const useCase = new GetDataUseCase(postRepository);

    await useCase.getData({ page: 3, limit: 10 });

    expect(postRepository.findPaginated).toHaveBeenCalledWith({}, 20, 10);
  });

  it('returns the exact { data, pagination } shape with totalPages rounded up', async () => {
    const { postRepository } = createMocks();
    postRepository.findPaginated.mockResolvedValue({ posts: [samplePost], total: 143 });
    const useCase = new GetDataUseCase(postRepository);

    const result = await useCase.getData({ page: 1, limit: 20 });

    expect(result).toEqual({
      data: [samplePost],
      pagination: {
        page: 1,
        limit: 20,
        total: 143,
        totalPages: 8, // Math.ceil(143 / 20)
      },
    });
  });
});
