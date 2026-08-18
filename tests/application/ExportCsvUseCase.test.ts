import { ExportCsvUseCase } from '../../src/application/ExportCsvUseCase';
import type { PostRepository } from '../../src/infrastructure/db/PostRepository';
import type { Post } from '../../src/domain/Post';

function createMocks() {
  const postRepository = {
    findAll: jest.fn(),
  } as unknown as jest.Mocked<PostRepository>;

  return { postRepository };
}

const CSV_HEADER = '"id","externalId","userId","title","body","syncedAt"';

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'uuid-1',
    externalId: 1,
    userId: 1,
    title: 'a title',
    body: 'a body',
    syncedAt: new Date('2026-08-15T10:00:00.000Z'),
    ...overrides,
  };
}

describe('ExportCsvUseCase', () => {
  it('exports all posts with no filters, one CSV row per post', async () => {
    const { postRepository } = createMocks();
    const posts = [
      makePost({ id: 'uuid-1', externalId: 1 }),
      makePost({ id: 'uuid-2', externalId: 2 }),
    ];
    postRepository.findAll.mockResolvedValue(posts);
    const useCase = new ExportCsvUseCase(postRepository);

    const csv = await useCase.exportToCsv({});

    expect(postRepository.findAll).toHaveBeenCalledWith({});
    const lines = csv.split('\n');
    expect(lines[0]).toBe(CSV_HEADER);
    expect(lines).toHaveLength(3); // header + 2 posts
  });

  it('passes userId and search filters through to the repository', async () => {
    const { postRepository } = createMocks();
    postRepository.findAll.mockResolvedValue([]);
    const useCase = new ExportCsvUseCase(postRepository);

    await useCase.exportToCsv({ userId: 5, search: 'qui' });

    expect(postRepository.findAll).toHaveBeenCalledWith({ userId: 5, search: 'qui' });
  });

  it('returns a CSV with only the header when there are no matching posts', async () => {
    const { postRepository } = createMocks();
    postRepository.findAll.mockResolvedValue([]);
    const useCase = new ExportCsvUseCase(postRepository);

    const csv = await useCase.exportToCsv({ userId: 9999 });

    expect(csv).toBe(CSV_HEADER);
    expect(csv.split('\n')).toHaveLength(1);
  });

  it('escapes commas and quotes in title/body per RFC 4180', async () => {
    const { postRepository } = createMocks();
    const post = makePost({
      title: 'Hello, world',
      body: 'A "quoted" body, with a comma',
    });
    postRepository.findAll.mockResolvedValue([post]);
    const useCase = new ExportCsvUseCase(postRepository);

    const csv = await useCase.exportToCsv({});
    const dataRow = csv.split('\n')[1];

    expect(dataRow).toContain('"Hello, world"');
    expect(dataRow).toContain('"A ""quoted"" body, with a comma"');
  });
});
