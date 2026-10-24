export function normalizeSpaces(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function titleCaseName(value: string): string {
  return normalizeSpaces(value)
    .toLocaleLowerCase()
    .replace(/(^|[\s'-])(\p{L})/gu, (_match, separator: string, letter: string) => {
      return `${separator}${letter.toLocaleUpperCase()}`;
    });
}
