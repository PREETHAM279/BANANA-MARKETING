-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "priorityRank" INTEGER NOT NULL DEFAULT 0,
    "priorityScore" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT NOT NULL DEFAULT '',
    "area" TEXT NOT NULL DEFAULT '',
    "locality" TEXT NOT NULL DEFAULT '',
    "zone" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "mapsQuery" TEXT NOT NULL DEFAULT '',
    "website" TEXT,
    "websiteNote" TEXT,
    "instagram" TEXT,
    "instagramNote" TEXT,
    "facebook" TEXT,
    "linkedin" TEXT,
    "youtube" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "offerings" TEXT NOT NULL DEFAULT '',
    "branches" TEXT NOT NULL DEFAULT '',
    "branchCount" INTEGER,
    "googleRating" REAL,
    "googleReviews" INTEGER,
    "googlePlaceId" TEXT,
    "googleMapsUri" TEXT,
    "googleFetchedAt" DATETIME,
    "googleData" TEXT,
    "ratingsNote" TEXT,
    "phone" TEXT,
    "phoneLabel" TEXT,
    "phoneSource" TEXT,
    "phones" TEXT NOT NULL DEFAULT '[]',
    "email" TEXT,
    "emailSource" TEXT,
    "emails" TEXT NOT NULL DEFAULT '[]',
    "people" TEXT NOT NULL DEFAULT '[]',
    "decisionMakerPhone" TEXT,
    "decisionMakerEmail" TEXT,
    "decisionMakerLinkedin" TEXT,
    "employeeCountVerified" TEXT,
    "employeeCountSource" TEXT,
    "employeeEstimate" TEXT NOT NULL DEFAULT '',
    "employeeEstimateBasis" TEXT NOT NULL DEFAULT '',
    "employeeBand" TEXT NOT NULL DEFAULT 'Unknown',
    "managementStructure" TEXT NOT NULL DEFAULT '',
    "attendanceFit" TEXT NOT NULL DEFAULT 'Medium',
    "attendanceFitReason" TEXT NOT NULL DEFAULT '',
    "socialFit" TEXT NOT NULL DEFAULT 'Medium',
    "socialFitReason" TEXT NOT NULL DEFAULT '',
    "whyProspect" TEXT NOT NULL DEFAULT '',
    "recommendedProduct" TEXT NOT NULL DEFAULT 'Both',
    "productReason" TEXT NOT NULL DEFAULT '',
    "operationalProblems" TEXT NOT NULL DEFAULT '[]',
    "socialPresence" TEXT NOT NULL DEFAULT '',
    "socialWeaknesses" TEXT NOT NULL DEFAULT '[]',
    "interestLevel" TEXT NOT NULL DEFAULT 'Medium',
    "interestReason" TEXT NOT NULL DEFAULT '',
    "pitch" TEXT NOT NULL DEFAULT '',
    "approach" TEXT NOT NULL DEFAULT '',
    "opener" TEXT NOT NULL DEFAULT '',
    "bestTimeToCall" TEXT NOT NULL DEFAULT '',
    "callBlock" INTEGER NOT NULL DEFAULT 0,
    "facts" TEXT NOT NULL DEFAULT '[]',
    "hook" TEXT NOT NULL DEFAULT '',
    "objections" TEXT NOT NULL DEFAULT '[]',
    "discoveryQuestions" TEXT NOT NULL DEFAULT '[]',
    "sources" TEXT NOT NULL DEFAULT '[]',
    "researchDate" TEXT NOT NULL DEFAULT '',
    "verification" TEXT NOT NULL DEFAULT '',
    "confidence" TEXT NOT NULL DEFAULT 'Medium',
    "photoUrl" TEXT,
    "photoSource" TEXT,
    "siteData" TEXT,
    "siteFetchedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'New Lead',
    "followUpDate" TEXT,
    "followUpNote" TEXT NOT NULL DEFAULT '',
    "nextAction" TEXT NOT NULL DEFAULT '',
    "dealValue" INTEGER,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "meetingAt" TEXT,
    "lastContactedAt" DATETIME,
    "doNotContact" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "details" TEXT NOT NULL DEFAULT '',
    "meta" TEXT NOT NULL DEFAULT '{}',
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'General',
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Note_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'Uploaded by you',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Photo_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recording" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'audio/webm',
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Recording_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutreachTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" DATETIME,
    "note" TEXT NOT NULL DEFAULT '',
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "OutreachTask_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DayNote" (
    "date" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "Business_category_idx" ON "Business"("category");

-- CreateIndex
CREATE INDEX "Business_status_idx" ON "Business"("status");

-- CreateIndex
CREATE INDEX "Business_followUpDate_idx" ON "Business"("followUpDate");

-- CreateIndex
CREATE INDEX "Activity_businessId_idx" ON "Activity"("businessId");

-- CreateIndex
CREATE INDEX "Activity_type_idx" ON "Activity"("type");

-- CreateIndex
CREATE INDEX "Activity_occurredAt_idx" ON "Activity"("occurredAt");

-- CreateIndex
CREATE INDEX "Note_businessId_idx" ON "Note"("businessId");

-- CreateIndex
CREATE INDEX "Photo_businessId_idx" ON "Photo"("businessId");

-- CreateIndex
CREATE INDEX "Recording_businessId_idx" ON "Recording"("businessId");

-- CreateIndex
CREATE INDEX "OutreachTask_date_idx" ON "OutreachTask"("date");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachTask_date_businessId_key" ON "OutreachTask"("date", "businessId");
