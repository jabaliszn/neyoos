-- CreateTable
CREATE TABLE "PublicSiteSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "heroHeadline" TEXT NOT NULL DEFAULT 'Nurturing Excellence & Character',
    "heroSubheading" TEXT,
    "heroImageUrl" TEXT,
    "history" TEXT,
    "whyChooseUs" TEXT,
    "mapEmbedUrl" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "ogImageUrl" TEXT,
    "primaryCtaLabel" TEXT NOT NULL DEFAULT 'Begin Application',
    "secondaryCtaLabel" TEXT NOT NULL DEFAULT 'Parent Portal',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PublicSiteSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PublicSiteLeader" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bio" TEXT,
    "photoUrl" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PublicSiteLeader_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PublicSiteTestimonial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "guardianName" TEXT NOT NULL,
    "relationship" TEXT,
    "studentName" TEXT,
    "photoUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PublicSiteTestimonial_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PublicSiteGalleryImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "caption" TEXT,
    "imageUrl" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'School life',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PublicSiteGalleryImage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PublicSiteActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PublicSiteActivity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NewsPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "imageFileUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NewsPost_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicSiteSettings_tenantId_key" ON "PublicSiteSettings"("tenantId");

-- CreateIndex
CREATE INDEX "PublicSiteLeader_tenantId_published_sortOrder_idx" ON "PublicSiteLeader"("tenantId", "published", "sortOrder");

-- CreateIndex
CREATE INDEX "PublicSiteTestimonial_tenantId_published_sortOrder_idx" ON "PublicSiteTestimonial"("tenantId", "published", "sortOrder");

-- CreateIndex
CREATE INDEX "PublicSiteGalleryImage_tenantId_published_sortOrder_idx" ON "PublicSiteGalleryImage"("tenantId", "published", "sortOrder");

-- CreateIndex
CREATE INDEX "PublicSiteGalleryImage_tenantId_category_idx" ON "PublicSiteGalleryImage"("tenantId", "category");

-- CreateIndex
CREATE INDEX "PublicSiteActivity_tenantId_published_sortOrder_idx" ON "PublicSiteActivity"("tenantId", "published", "sortOrder");

-- CreateIndex
CREATE INDEX "NewsPost_tenantId_status_publishedAt_idx" ON "NewsPost"("tenantId", "status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NewsPost_tenantId_slug_key" ON "NewsPost"("tenantId", "slug");
