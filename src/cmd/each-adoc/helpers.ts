export function nullable(value: string | null | undefined): string {
  if (typeof value === `string`) {
    return `'${value}'`;
  }
  return `NULL`;
}
export function nullableInt(value: number | null | undefined): string {
  if (typeof value === `number`) {
    return `${value}`;
  }
  return `NULL`;
}
