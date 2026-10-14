export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://reservex:reservex_dev_password@localhost:5434/reservex_test";

export function assertTestDatabaseUrl(url: string) {
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to run tests: database "${name}" is not a test database (name must end in _test)`);
  }
}