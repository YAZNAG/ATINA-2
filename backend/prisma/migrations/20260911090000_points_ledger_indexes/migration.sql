-- CreateIndex
CREATE INDEX "points_transactions_customer_id_created_at_idx" ON "points_transactions"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "points_transactions_created_at_id_idx" ON "points_transactions"("created_at" DESC, "id" DESC);

