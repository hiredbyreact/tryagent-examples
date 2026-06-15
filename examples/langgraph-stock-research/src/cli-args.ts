export function parseTickerArg(args: string[]): string | undefined {
  return args.map((arg) => arg.trim()).find((arg) => arg !== "" && arg !== "--");
}
