export function parseTickerArg(args: string[]): string | undefined {
  const ticker = args.find((arg) => arg !== "--")?.trim();
  return ticker ? ticker.toUpperCase() : undefined;
}
