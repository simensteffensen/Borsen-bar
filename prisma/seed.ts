// Seed script for development
// Run with: npm run db:seed

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create some known assets
  const assets = [
    { symbol: "BTC", name: "Bitcoin", coingeckoId: "bitcoin", isStablecoin: false },
    { symbol: "ETH", name: "Ethereum", coingeckoId: "ethereum", isStablecoin: false },
    { symbol: "SOL", name: "Solana", coingeckoId: "solana", isStablecoin: false },
    { symbol: "BNB", name: "BNB", coingeckoId: "binancecoin", isStablecoin: false },
    { symbol: "USDC", name: "USD Coin", coingeckoId: "usd-coin", isStablecoin: true },
    { symbol: "USDT", name: "Tether", coingeckoId: "tether", isStablecoin: true },
    { symbol: "ADA", name: "Cardano", coingeckoId: "cardano", isStablecoin: false },
    { symbol: "MATIC", name: "Polygon", coingeckoId: "matic-network", isStablecoin: false },
    { symbol: "DOT", name: "Polkadot", coingeckoId: "polkadot", isStablecoin: false },
    { symbol: "AVAX", name: "Avalanche", coingeckoId: "avalanche-2", isStablecoin: false },
  ];

  for (const asset of assets) {
    await prisma.asset.upsert({
      where: {
        symbol_chain_contractAddress: {
          symbol: asset.symbol,
          chain: null as unknown as string,
          contractAddress: null as unknown as string,
        },
      },
      create: {
        symbol: asset.symbol,
        name: asset.name,
        coingeckoId: asset.coingeckoId,
        isStablecoin: asset.isStablecoin,
      },
      update: {
        name: asset.name,
        coingeckoId: asset.coingeckoId,
        isStablecoin: asset.isStablecoin,
      },
    });
  }

  console.log(`Seeded ${assets.length} assets`);
  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
