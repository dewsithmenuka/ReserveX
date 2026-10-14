import { TEST_DATABASE_URL, assertTestDatabaseUrl } from "./test-db";

assertTestDatabaseUrl(TEST_DATABASE_URL);
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.SESSION_SECRET = "test-only-session-secret-that-is-at-least-32-chars";