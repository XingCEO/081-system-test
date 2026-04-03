export function getShortOrderNumber(orderNumber: string): string {
  return orderNumber.split('-').at(-1) ?? orderNumber;
}
