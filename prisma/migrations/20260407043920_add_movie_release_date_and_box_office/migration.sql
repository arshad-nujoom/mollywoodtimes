-- AlterTable
ALTER TABLE "Trailer" ADD COLUMN "movieReleaseDate" TEXT;

-- CreateTable
CREATE TABLE "BoxOffice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trailerId" TEXT NOT NULL,
    "day1India" REAL,
    "day1Worldwide" REAL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "rawText" TEXT,
    "collectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BoxOffice_trailerId_fkey" FOREIGN KEY ("trailerId") REFERENCES "Trailer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BoxOffice_trailerId_key" ON "BoxOffice"("trailerId");
