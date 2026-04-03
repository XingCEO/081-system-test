export interface PurchaseSuggestionInput {
  ingredientId: number;
  ingredientName: string;
  currentStock: number;
  lowStockThreshold: number;
  unit: string;
  costPerUnit: number;
}

export interface PurchaseSuggestion extends PurchaseSuggestionInput {
  estimatedCost: number;
  recommendedOrderQuantity: number;
  recommendedTargetStock: number;
  shortage: number;
  status: 'low' | 'out';
}

export interface PurchaseSuggestionSummary {
  lowStockCount: number;
  outOfStockCount: number;
  totalEstimatedCost: number;
  totalSuggestedQuantity: number;
}

const quantityFormatter = new Intl.NumberFormat('zh-TW', {
  maximumFractionDigits: 2,
});

function compareSuggestions(a: PurchaseSuggestion, b: PurchaseSuggestion): number {
  if (a.status !== b.status) {
    return a.status === 'out' ? -1 : 1;
  }

  if (a.estimatedCost !== b.estimatedCost) {
    return b.estimatedCost - a.estimatedCost;
  }

  if (a.recommendedOrderQuantity !== b.recommendedOrderQuantity) {
    return b.recommendedOrderQuantity - a.recommendedOrderQuantity;
  }

  return a.ingredientName.localeCompare(b.ingredientName, 'zh-Hant');
}

export function formatInventoryQuantity(quantity: number): string {
  return quantityFormatter.format(quantity);
}

export function buildPurchaseSuggestions(
  rows: PurchaseSuggestionInput[],
  safetyMultiplier = 2
): PurchaseSuggestion[] {
  return rows
    .filter((row) => row.lowStockThreshold > 0 && row.currentStock <= row.lowStockThreshold)
    .map((row) => {
      const recommendedTargetStock = Math.max(
        row.lowStockThreshold,
        row.lowStockThreshold * safetyMultiplier
      );
      const recommendedOrderQuantity = Math.max(
        recommendedTargetStock - row.currentStock,
        0
      );
      const shortage = Math.max(row.lowStockThreshold - row.currentStock, 0);

      return {
        ...row,
        estimatedCost: recommendedOrderQuantity * row.costPerUnit,
        recommendedOrderQuantity,
        recommendedTargetStock,
        shortage,
        status: row.currentStock <= 0 ? 'out' : 'low',
      } satisfies PurchaseSuggestion;
    })
    .sort(compareSuggestions);
}

export function summarizePurchaseSuggestions(
  suggestions: PurchaseSuggestion[]
): PurchaseSuggestionSummary {
  return suggestions.reduce<PurchaseSuggestionSummary>(
    (summary, suggestion) => ({
      lowStockCount:
        summary.lowStockCount + (suggestion.status === 'low' ? 1 : 0),
      outOfStockCount:
        summary.outOfStockCount + (suggestion.status === 'out' ? 1 : 0),
      totalEstimatedCost: summary.totalEstimatedCost + suggestion.estimatedCost,
      totalSuggestedQuantity:
        summary.totalSuggestedQuantity + suggestion.recommendedOrderQuantity,
    }),
    {
      lowStockCount: 0,
      outOfStockCount: 0,
      totalEstimatedCost: 0,
      totalSuggestedQuantity: 0,
    }
  );
}

export function formatPurchaseListText(params: {
  storeName: string;
  currency: string;
  suggestions: PurchaseSuggestion[];
  createdAt?: Date;
}): string {
  const createdAt = params.createdAt ?? new Date();
  const summary = summarizePurchaseSuggestions(params.suggestions);

  const lines = [
    `${params.storeName} 低庫存採購清單`,
    `產生時間：${createdAt.toLocaleString('zh-TW')}`,
    '',
  ];

  params.suggestions.forEach((suggestion, index) => {
    lines.push(
      `${index + 1}. ${suggestion.ingredientName}`,
      `   狀態：${suggestion.status === 'out' ? '缺貨' : '低庫存'}`,
      `   目前庫存：${formatInventoryQuantity(suggestion.currentStock)} ${suggestion.unit}`,
      `   低庫存門檻：${formatInventoryQuantity(suggestion.lowStockThreshold)} ${suggestion.unit}`,
      `   建議補貨：${formatInventoryQuantity(suggestion.recommendedOrderQuantity)} ${suggestion.unit}`,
      `   建議補到：${formatInventoryQuantity(suggestion.recommendedTargetStock)} ${suggestion.unit}`,
      `   預估成本：${params.currency}${suggestion.estimatedCost.toLocaleString('zh-TW')}`,
      ''
    );
  });

  lines.push(
    `品項數：${params.suggestions.length}`,
    `缺貨：${summary.outOfStockCount} 項`,
    `低庫存：${summary.lowStockCount} 項`,
    `建議採購量：${formatInventoryQuantity(summary.totalSuggestedQuantity)}`,
    `預估採購成本：${params.currency}${summary.totalEstimatedCost.toLocaleString('zh-TW')}`
  );

  return lines.join('\n');
}
