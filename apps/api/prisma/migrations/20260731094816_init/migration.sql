-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('stock', 'etf', 'gold_silver');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('listed', 'paused', 'delisted');

-- CreateEnum
CREATE TYPE "CandleInterval" AS ENUM ('1m', '15m', '1h', '1d');

-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('buy', 'sell');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('quoted', 'awaiting_signature', 'submitted', 'confirmed', 'failed');

-- CreateEnum
CREATE TYPE "DepositToken" AS ENUM ('usdc', 'usdt');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('seen', 'confirmed');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('ios', 'android');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "auth_provider" TEXT NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "email" TEXT,
    "app_lock_prefs" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "token_address" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "AssetCategory" NOT NULL,
    "logo_url" TEXT,
    "decimals" INTEGER NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'paused',
    "listed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_stats" (
    "asset_id" TEXT NOT NULL,
    "price_usd" DECIMAL(38,18) NOT NULL,
    "change_24h_pct" DECIMAL(12,6) NOT NULL,
    "volume_24h_usd" DECIMAL(38,6),
    "liquidity_usd" DECIMAL(38,6),
    "underlying_price_usd" DECIMAL(38,18),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_stats_pkey" PRIMARY KEY ("asset_id")
);

-- CreateTable
CREATE TABLE "candles" (
    "asset_id" TEXT NOT NULL,
    "interval" "CandleInterval" NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "o" DECIMAL(38,18) NOT NULL,
    "h" DECIMAL(38,18) NOT NULL,
    "l" DECIMAL(38,18) NOT NULL,
    "c" DECIMAL(38,18) NOT NULL,
    "volume" DECIMAL(38,6),

    CONSTRAINT "candles_pkey" PRIMARY KEY ("asset_id","interval","ts")
);

-- CreateTable
CREATE TABLE "watchlist_items" (
    "user_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watchlist_items_pkey" PRIMARY KEY ("user_id","asset_id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "side" "OrderSide" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'quoted',
    "input_token" TEXT NOT NULL,
    "input_amount" DECIMAL(38,18) NOT NULL,
    "quoted_output" DECIMAL(38,18),
    "executed_output" DECIMAL(38,18),
    "price_impact_bps" INTEGER,
    "fee_bps" INTEGER NOT NULL,
    "tx_signature" TEXT,
    "error_code" TEXT,
    "quoted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposits" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "token" "DepositToken" NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "tx_signature" TEXT NOT NULL,
    "status" "DepositStatus" NOT NULL DEFAULT 'seen',
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),

    CONSTRAINT "deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_lots" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "quantity" DECIMAL(38,18) NOT NULL,
    "cost_usd" DECIMAL(38,6) NOT NULL,
    "acquired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "position_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "user_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "token" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("user_id","device_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_provider_provider_user_id_key" ON "users"("auth_provider", "provider_user_id");

-- CreateIndex
CREATE INDEX "wallets_user_id_idx" ON "wallets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_chain_address_key" ON "wallets"("chain", "address");

-- CreateIndex
CREATE INDEX "assets_status_category_idx" ON "assets"("status", "category");

-- CreateIndex
CREATE UNIQUE INDEX "assets_chain_token_address_key" ON "assets"("chain", "token_address");

-- CreateIndex
CREATE INDEX "candles_interval_ts_idx" ON "candles"("interval", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "orders_tx_signature_key" ON "orders"("tx_signature");

-- CreateIndex
CREATE INDEX "orders_user_id_quoted_at_idx" ON "orders"("user_id", "quoted_at" DESC);

-- CreateIndex
CREATE INDEX "orders_status_submitted_at_idx" ON "orders"("status", "submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "deposits_tx_signature_key" ON "deposits"("tx_signature");

-- CreateIndex
CREATE INDEX "deposits_wallet_id_detected_at_idx" ON "deposits"("wallet_id", "detected_at" DESC);

-- CreateIndex
CREATE INDEX "position_lots_wallet_id_asset_id_idx" ON "position_lots"("wallet_id", "asset_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_sent_at_idx" ON "notifications"("user_id", "sent_at" DESC);

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_stats" ADD CONSTRAINT "asset_stats_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candles" ADD CONSTRAINT "candles_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_lots" ADD CONSTRAINT "position_lots_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position_lots" ADD CONSTRAINT "position_lots_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
