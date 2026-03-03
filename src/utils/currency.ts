export function formatPrice(amount: number): string {
  return `NT$${amount.toLocaleString()}`;
}

export function formatPriceShort(amount: number): string {
  return `$${amount.toLocaleString()}`;
}
