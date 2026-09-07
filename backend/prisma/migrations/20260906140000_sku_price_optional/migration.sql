-- Spec ATINA (US-114) : plus de prix global sur le SKU, le prix se gere exclusivement par node (selling_rules.price).
ALTER TABLE "skus" ALTER COLUMN "price" DROP NOT NULL;
