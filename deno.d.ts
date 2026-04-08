declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve: (...args: any[]) => any;
  exit(code?: number): never;
  errors: {
    AddrInUse: new (...args: any[]) => Error;
  };
};
