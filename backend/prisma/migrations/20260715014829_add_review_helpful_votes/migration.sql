-- AlterTable
ALTER TABLE "article_reviews" ADD COLUMN     "helpful_voter_ids" UUID[] DEFAULT ARRAY[]::UUID[];
