
export function validateRequired(body: any, fields: string[]): string[] {
  if (!body) return fields;
  return fields.filter(field => {
    const value = body[field];
    return value === undefined || value === null || value === '';
  });
}

export function validateEnum(value: any, allowed: string[]): boolean {
  return allowed.includes(value);
}
