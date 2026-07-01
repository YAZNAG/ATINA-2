-- CreateTable
CREATE TABLE "support_conversations" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "order_id" UUID,
    "subject" VARCHAR(255) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "assigned_agent_id" INTEGER,
    "last_message_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "support_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_type" VARCHAR(20) NOT NULL,
    "sender_id" VARCHAR(50),
    "content" TEXT NOT NULL,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_conversations_customer_id_idx" ON "support_conversations"("customer_id");

-- CreateIndex
CREATE INDEX "support_conversations_status_idx" ON "support_conversations"("status");

-- CreateIndex
CREATE INDEX "support_conversations_last_message_at_idx" ON "support_conversations"("last_message_at" DESC);

-- CreateIndex
CREATE INDEX "support_messages_conversation_id_idx" ON "support_messages"("conversation_id");

-- AddForeignKey
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_assigned_agent_id_fkey" FOREIGN KEY ("assigned_agent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "support_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
