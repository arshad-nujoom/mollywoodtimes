-- CreateTable
CREATE TABLE "Trailer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "movieTitle" TEXT NOT NULL,
    "youtubeId" TEXT NOT NULL,
    "releaseDate" TEXT NOT NULL,
    "studio" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StatsCache" (
    "youtubeId" TEXT NOT NULL PRIMARY KEY,
    "views" INTEGER NOT NULL,
    "likes" INTEGER NOT NULL,
    "comments" INTEGER NOT NULL,
    "likesPerView" REAL NOT NULL,
    "commentsPerView" REAL NOT NULL,
    "title" TEXT NOT NULL,
    "publishedAt" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "refreshedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Trailer_youtubeId_key" ON "Trailer"("youtubeId");
