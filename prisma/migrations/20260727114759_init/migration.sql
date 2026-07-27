-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DONE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'DOING', 'BLOCKED', 'DONE');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TaskOrigin" AS ENUM ('MANUAL', 'MEETING_AI');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('DRAFT', 'UPLOADED', 'TRANSCRIBING', 'ANALYZING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "DailyCheck" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "emoji" TEXT,
    "colorToken" TEXT NOT NULL DEFAULT 'accent',
    "weekdays" INTEGER[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[],
    "position" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCheckCompletion" (
    "id" TEXT NOT NULL,
    "dailyCheckId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyCheckCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "colorToken" TEXT NOT NULL DEFAULT 'accent',
    "startDate" DATE,
    "dueDate" DATE,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectNote" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" DATE,
    "completedAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "origin" "TaskOrigin" NOT NULL DEFAULT 'MANUAL',
    "sourceMeetingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meetingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "participants" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contextNotes" TEXT,
    "status" "MeetingStatus" NOT NULL DEFAULT 'DRAFT',
    "audioPath" TEXT,
    "audioMimeType" TEXT,
    "audioSizeBytes" INTEGER,
    "durationSeconds" INTEGER,
    "transcript" TEXT,
    "transcriptLanguage" TEXT,
    "summaryMarkdown" TEXT,
    "problems" JSONB,
    "decisions" JSONB,
    "actionPlan" JSONB,
    "risks" JSONB,
    "flowchartMermaid" TEXT,
    "flowchartTitle" TEXT,
    "transcribeModel" TEXT,
    "analysisModel" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "processingStartedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "DailyCheck_isArchived_position_idx" ON "DailyCheck"("isArchived", "position");

-- CreateIndex
CREATE INDEX "DailyCheckCompletion_date_idx" ON "DailyCheckCompletion"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCheckCompletion_dailyCheckId_date_key" ON "DailyCheckCompletion"("dailyCheckId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Project_status_position_idx" ON "Project"("status", "position");

-- CreateIndex
CREATE INDEX "ProjectNote_projectId_isPinned_updatedAt_idx" ON "ProjectNote"("projectId", "isPinned", "updatedAt");

-- CreateIndex
CREATE INDEX "ProjectTask_projectId_status_position_idx" ON "ProjectTask"("projectId", "status", "position");

-- CreateIndex
CREATE INDEX "Meeting_projectId_meetingDate_idx" ON "Meeting"("projectId", "meetingDate");

-- CreateIndex
CREATE INDEX "Meeting_status_idx" ON "Meeting"("status");

-- AddForeignKey
ALTER TABLE "DailyCheckCompletion" ADD CONSTRAINT "DailyCheckCompletion_dailyCheckId_fkey" FOREIGN KEY ("dailyCheckId") REFERENCES "DailyCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectNote" ADD CONSTRAINT "ProjectNote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_sourceMeetingId_fkey" FOREIGN KEY ("sourceMeetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
