import { SyncDataUseCase } from '../../src/application/SyncDataUseCase';
import type {
  JsonPlaceholderClient,
  JsonPlaceholderPost,
} from '../../src/infrastructure/http/JsonPlaceholderClient';
import type { PostRepository } from '../../src/infrastructure/db/PostRepository';
import type { SqsPublisher } from '../../src/infrastructure/queue/SqsPublisher';
import type { Post } from '../../src/domain/Post';

function createMocks() {
  const jsonPlaceholderClient = {
    getPosts: jest.fn(),
  } as unknown as jest.Mocked<JsonPlaceholderClient>;

  const postRepository = {
    upsertByExternalId: jest.fn(),
  } as unknown as jest.Mocked<PostRepository>;

  const sqsPublisher = {
    publish: jest.fn(),
    subscribe: jest.fn(),
  } as unknown as jest.Mocked<SqsPublisher>;

  return { jsonPlaceholderClient, postRepository, sqsPublisher };
}

describe('SyncDataUseCase', () => {
  describe('trigger', () => {
    it('publishes a jobId to the queue and returns it immediately', async () => {
      const { jsonPlaceholderClient, postRepository, sqsPublisher } = createMocks();
      const useCase = new SyncDataUseCase(jsonPlaceholderClient, postRepository, sqsPublisher);

      const result = await useCase.trigger();

      expect(result.jobId).toEqual(expect.any(String));
      expect(sqsPublisher.publish).toHaveBeenCalledTimes(1);
      expect(sqsPublisher.publish).toHaveBeenCalledWith({ jobId: result.jobId });
    });
  });

  describe('processSyncJob', () => {
    it('fetches posts and upserts each one via the repository', async () => {
      const { jsonPlaceholderClient, postRepository, sqsPublisher } = createMocks();
      const posts: JsonPlaceholderPost[] = [
        { id: 1, userId: 10, title: 'title 1', body: 'body 1' },
        { id: 2, userId: 20, title: 'title 2', body: 'body 2' },
      ];
      jsonPlaceholderClient.getPosts.mockResolvedValue(posts);
      postRepository.upsertByExternalId.mockResolvedValue({} as Post);

      const useCase = new SyncDataUseCase(jsonPlaceholderClient, postRepository, sqsPublisher);
      await useCase.processSyncJob({ jobId: 'job-1' });

      expect(postRepository.upsertByExternalId).toHaveBeenCalledTimes(2);
      expect(postRepository.upsertByExternalId).toHaveBeenCalledWith({
        externalId: 1,
        userId: 10,
        title: 'title 1',
        body: 'body 1',
      });
      expect(postRepository.upsertByExternalId).toHaveBeenCalledWith({
        externalId: 2,
        userId: 20,
        title: 'title 2',
        body: 'body 2',
      });
    });

    it('logs the error and does not throw when getPosts fails', async () => {
      const { jsonPlaceholderClient, postRepository, sqsPublisher } = createMocks();
      const error = new Error('network down');
      jsonPlaceholderClient.getPosts.mockRejectedValue(error);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const useCase = new SyncDataUseCase(jsonPlaceholderClient, postRepository, sqsPublisher);

      await expect(useCase.processSyncJob({ jobId: 'job-2' })).resolves.toBeUndefined();
      expect(postRepository.upsertByExternalId).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('job-2'), error);

      consoleErrorSpy.mockRestore();
    });

    it('does not call upsert when there are no posts to sync', async () => {
      const { jsonPlaceholderClient, postRepository, sqsPublisher } = createMocks();
      jsonPlaceholderClient.getPosts.mockResolvedValue([]);

      const useCase = new SyncDataUseCase(jsonPlaceholderClient, postRepository, sqsPublisher);
      await useCase.processSyncJob({ jobId: 'job-3' });

      expect(postRepository.upsertByExternalId).not.toHaveBeenCalled();
    });
  });
});
