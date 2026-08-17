import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';
import type { Post } from '../../domain/Post';

export interface PostFilters {
  userId?: number;
  search?: string;
}

export interface UpsertPostInput {
  externalId: number;
  userId: number;
  title: string;
  body: string;
}

export interface PaginatedPosts {
  posts: Post[];
  total: number;
}

let prismaSingleton: PrismaClient | undefined;

function getPrismaClient(): PrismaClient {
  if (!prismaSingleton) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    prismaSingleton = new PrismaClient({ adapter });
  }
  return prismaSingleton;
}

function buildWhereClause(filters: PostFilters) {
  return {
    ...(filters.userId !== undefined ? { userId: filters.userId } : {}),
    ...(filters.search
      ? { title: { contains: filters.search, mode: 'insensitive' as const } }
      : {}),
  };
}

export class PostRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient = getPrismaClient()) {
    this.prisma = prisma;
  }

  async upsertByExternalId(input: UpsertPostInput): Promise<Post> {
    return this.prisma.post.upsert({
      where: { externalId: input.externalId },
      update: {
        userId: input.userId,
        title: input.title,
        body: input.body,
        syncedAt: new Date(),
      },
      create: {
        externalId: input.externalId,
        userId: input.userId,
        title: input.title,
        body: input.body,
      },
    });
  }

  async findPaginated(filters: PostFilters, skip: number, take: number): Promise<PaginatedPosts> {
    const where = buildWhereClause(filters);

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({ where, skip, take }),
      this.prisma.post.count({ where }),
    ]);

    return { posts, total };
  }

  async findAll(filters: PostFilters): Promise<Post[]> {
    const where = buildWhereClause(filters);
    return this.prisma.post.findMany({ where });
  }
}
