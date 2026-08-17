import { randomUUID } from 'node:crypto';
import type { JsonPlaceholderClient } from '../infrastructure/http/JsonPlaceholderClient';
import type { PostRepository } from '../infrastructure/db/PostRepository';
import type { SqsPublisher, SyncJobMessage } from '../infrastructure/queue/SqsPublisher';

export interface TriggerSyncResult {
  jobId: string;
}

export class SyncDataUseCase {
  constructor(
    private readonly jsonPlaceholderClient: JsonPlaceholderClient,
    private readonly postRepository: PostRepository,
    private readonly sqsPublisher: SqsPublisher,
  ) {}

  /** Dispara el sync: genera un jobId, encola el trabajo y devuelve de inmediato (para el 202 Accepted). */
  async trigger(): Promise<TriggerSyncResult> {
    const jobId = randomUUID();
    this.sqsPublisher.publish({ jobId });
    return { jobId };
  }

  /** Procesamiento real: lo dispara el consumer de la cola, no el request HTTP. */
  async processSyncJob(message: SyncJobMessage): Promise<void> {
    const { jobId } = message;

    try {
      const posts = await this.jsonPlaceholderClient.getPosts();

      await Promise.all(
        posts.map((post) =>
          this.postRepository.upsertByExternalId({
            externalId: post.id,
            userId: post.userId,
            title: post.title,
            body: post.body,
          }),
        ),
      );

      console.log(`[sync ${jobId}] processed ${posts.length} posts successfully`);
    } catch (error) {
      console.error(`[sync ${jobId}] failed to process sync job:`, error);
    }
  }
}
