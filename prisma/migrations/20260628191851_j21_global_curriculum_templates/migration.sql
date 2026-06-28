-- CreateTable
CREATE TABLE "GlobalCurriculumTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Kenya',
    "context" TEXT,
    "version" TEXT NOT NULL DEFAULT 'v1',
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "learningAreasJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
