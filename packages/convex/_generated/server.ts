type FunctionDefinition = {
  args: unknown;
  returns?: unknown;
  handler: (...args: any[]) => any;
};

export function query<T extends FunctionDefinition>(definition: T): T {
  return definition;
}

export function mutation<T extends FunctionDefinition>(definition: T): T {
  return definition;
}
