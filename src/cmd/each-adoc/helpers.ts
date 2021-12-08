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

export function nullableJson(value: unknown): string {
  if (typeof value === `undefined` || value === null) {
    return `NULL`;
  }
  return `'${JSON.stringify(value)}'`;
}

export function boolean(value: boolean): string {
  return value ? `TRUE` : `FALSE`;
}
