-- CreateTable
CREATE TABLE "article_reviews" (
    "id" UUID NOT NULL,
    "article_id" INTEGER NOT NULL,
    "customer_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "article_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "article_reviews_article_id_idx" ON "article_reviews"("article_id");

-- CreateIndex
CREATE UNIQUE INDEX "article_reviews_article_id_customer_id_key" ON "article_reviews"("article_id", "customer_id");

-- AddForeignKey
ALTER TABLE "article_reviews" ADD CONSTRAINT "article_reviews_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_reviews" ADD CONSTRAINT "article_reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
