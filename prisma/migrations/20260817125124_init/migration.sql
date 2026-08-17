-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "externalId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Post_externalId_key" ON "Post"("externalId");
