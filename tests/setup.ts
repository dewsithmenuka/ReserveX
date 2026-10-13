const url =
  process.env.TEST_DATABASE_URL ??
  "postgresql://reservex:reservex_dev_password@localhost:5434/reservex_test";

if (!url.includes("_test")) {
  throw new Error("Refusing to run tests against a non-test database");
}
process.env.DATABASE_URL = url;