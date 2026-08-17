export interface Post {
  id: string;
  externalId: number;
  userId: number;
  title: string;
  body: string;
  syncedAt: Date;
}
