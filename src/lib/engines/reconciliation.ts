// Reconciliation Engine
// Detects transfers between own wallets, duplicates, bridge pairs, etc.
// Returns match candidates and issues.

import Decimal from "decimal.js";
import type {
  CanonicalTx,
  ReconciliationMatch,
  ReconciliationResult,
  DetectedIssue,
  IssueSeverity,
} from "@/lib/types";

const TRANSFER_TIME_TOLERANCE_MS = 30 * 60 * 1000; // 30 minutes
const AMOUNT_TOLERANCE_PERCENT = 0.01; // 1% — covers minor fee differences

export function reconcile(
  transactions: CanonicalTx[],
  ownAccountIds: Set<string>
): ReconciliationResult {
  const matches: ReconciliationMatch[] = [];
  const issues: DetectedIssue[] = [];

  const txById = new Map(transactions.map((t) => [t.id, t]));

  // Group outbound and inbound by asset
  const outbound = transactions.filter(
    (t) => t.direction === "OUT" && t.type !== "FEE"
  );
  const inbound = transactions.filter((t) => t.direction === "IN");

  // ── 1. Own-wallet transfer detection ──────────────────────────────────────
  const matched = new Set<string>();

  for (const out of outbound) {
    if (matched.has(out.id)) continue;

    const candidates = inbound.filter(
      (inp) =>
        !matched.has(inp.id) &&
        inp.assetId === out.assetId &&
        inp.id !== out.id &&
        Math.abs(inp.timestamp.getTime() - out.timestamp.getTime()) <
          TRANSFER_TIME_TOLERANCE_MS &&
        amountsMatch(inp.amount, out.amount)
    );

    if (candidates.length === 0) continue;

    // Prefer candidate where both accounts are known own accounts
    const ownTransfer = candidates.find(
      (c) =>
        c.sourceAccountId &&
        c.destinationAccountId &&
        ownAccountIds.has(c.sourceAccountId) &&
        ownAccountIds.has(c.destinationAccountId)
    );
    const bestMatch = ownTransfer ?? candidates[0];

    const bothOwn =
      out.sourceAccountId &&
      bestMatch.destinationAccountId &&
      ownAccountIds.has(out.sourceAccountId) &&
      ownAccountIds.has(bestMatch.destinationAccountId);

    matches.push({
      type: "own_transfer",
      confidence: bothOwn ? 0.95 : 0.7,
      txIds: [out.id, bestMatch.id],
      metadata: {
        assetId: out.assetId,
        amount: out.amount.toFixed(8),
        outTimestamp: out.timestamp.toISOString(),
        inTimestamp: bestMatch.timestamp.toISOString(),
      },
    });

    matched.add(out.id);
    matched.add(bestMatch.id);
  }

  // ── 2. Bridge pair detection ───────────────────────────────────────────────
  const bridgeOuts = transactions.filter((t) => t.type === "BRIDGE_OUT");
  const bridgeIns = transactions.filter((t) => t.type === "BRIDGE_IN");

  for (const bout of bridgeOuts) {
    if (matched.has(bout.id)) continue;

    const candidate = bridgeIns.find(
      (bin) =>
        !matched.has(bin.id) &&
        bin.assetId === bout.assetId &&
        amountsMatch(bin.amount, bout.amount) &&
        bin.timestamp >= bout.timestamp // bridge-in after bridge-out
    );

    if (candidate) {
      matches.push({
        type: "bridge_pair",
        confidence: 0.9,
        txIds: [bout.id, candidate.id],
        metadata: {
          assetId: bout.assetId,
          amount: bout.amount.toFixed(8),
        },
      });
      matched.add(bout.id);
      matched.add(candidate.id);
    }
  }

  // ── 3. Duplicate detection ─────────────────────────────────────────────────
  // Group by asset + amount + approximate timestamp
  const dupCandidates = new Map<string, CanonicalTx[]>();
  for (const tx of transactions) {
    const bucket = `${tx.assetId}:${tx.amount.toFixed(6)}:${tx.direction}`;
    if (!dupCandidates.has(bucket)) dupCandidates.set(bucket, []);
    dupCandidates.get(bucket)!.push(tx);
  }

  for (const [, group] of dupCandidates) {
    if (group.length < 2) continue;
    // Find pairs within 5 minutes
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        const timeDiff = Math.abs(
          a.timestamp.getTime() - b.timestamp.getTime()
        );
        if (timeDiff < 5 * 60 * 1000 && !matched.has(a.id) && !matched.has(b.id)) {
          matches.push({
            type: "duplicate",
            confidence: 0.8,
            txIds: [a.id, b.id],
            metadata: {
              timeDiffMs: timeDiff,
              assetId: a.assetId,
            },
          });
        }
      }
    }
  }

  // ── 4. Issue detection ─────────────────────────────────────────────────────

  // Unmatched transfers
  const unmatchedSends = outbound.filter(
    (t) =>
      !matched.has(t.id) &&
      (t.type === "SEND" ||
        t.type === "CRYPTO_WITHDRAWAL" ||
        t.type === "BRIDGE_OUT")
  );
  for (const tx of unmatchedSends) {
    issues.push({
      workspaceId: tx.workspaceId,
      severity: "WARNING",
      type: "UNMATCHED_TRANSFER",
      title: `Unmatched outbound transfer: ${tx.assetSymbol}`,
      description: `Outbound transfer of ${tx.amount.toFixed(6)} ${tx.assetSymbol} on ${tx.timestamp.toISOString()} could not be matched to an inbound transfer. This may be a sale, gift, or transfer to external wallet.`,
      linkedTxId: tx.id,
      suggestedResolution: {
        options: ["mark_as_sale", "mark_as_gift", "mark_as_external"],
      },
    });
  }

  // Missing prices
  for (const tx of transactions) {
    if (
      tx.fiatValue == null &&
      tx.type !== "TOKEN_APPROVAL" &&
      tx.type !== "SELF_TRANSFER"
    ) {
      issues.push({
        workspaceId: tx.workspaceId,
        severity: "WARNING",
        type: "MISSING_PRICE",
        title: `Missing NOK price: ${tx.assetSymbol}`,
        description: `Could not determine NOK price for ${tx.assetSymbol} at ${tx.timestamp.toISOString()}.`,
        linkedTxId: tx.id,
        suggestedResolution: { action: "manual_price_input" },
      });
    }
  }

  // Unknown transaction types
  for (const tx of transactions) {
    if (tx.type === "UNKNOWN") {
      issues.push({
        workspaceId: tx.workspaceId,
        severity: "WARNING",
        type: "UNCLASSIFIED_TX",
        title: "Unclassified transaction",
        description: `Transaction ${tx.id} could not be classified. Manual review required.`,
        linkedTxId: tx.id,
        suggestedResolution: { action: "classify_manually" },
      });
    }
  }

  return { matches, issues };
}

function amountsMatch(a: Decimal, b: Decimal): boolean {
  if (b.isZero()) return a.isZero();
  const diff = a.minus(b).abs().div(b.abs());
  return diff.lessThanOrEqualTo(AMOUNT_TOLERANCE_PERCENT);
}

/**
 * Calculate running balance per asset to detect impossible negatives.
 */
export function detectImpossibleBalances(
  transactions: CanonicalTx[],
  workspaceId: string
): DetectedIssue[] {
  const issues: DetectedIssue[] = [];
  const balances = new Map<string, Decimal>();

  const sorted = [...transactions].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  for (const tx of sorted) {
    const current = balances.get(tx.assetId) ?? new Decimal(0);
    let next: Decimal;

    if (tx.direction === "IN") {
      next = current.plus(tx.amount);
    } else if (tx.direction === "OUT") {
      next = current.minus(tx.amount.abs());
    } else {
      next = current; // INTERNAL
    }

    if (next.lessThan(new Decimal("-0.0001"))) {
      issues.push({
        workspaceId,
        severity: "CRITICAL",
        type: "IMPOSSIBLE_BALANCE",
        title: `Impossible balance: ${tx.assetSymbol} went negative`,
        description: `Balance of ${tx.assetSymbol} became ${next.toFixed(8)} after transaction on ${tx.timestamp.toISOString()}. This indicates missing acquisition history.`,
        linkedTxId: tx.id,
        suggestedResolution: {
          action: "import_missing_history",
          assetId: tx.assetId,
        },
      });
    }

    balances.set(tx.assetId, next);
  }

  return issues;
}
