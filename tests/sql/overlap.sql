BEGIN;

INSERT INTO "Resource" (id, name, type, "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000001', 'Test Room', 'room', now());

-- Base booking 10:00-11:00
INSERT INTO "Reservation" (id, "resourceId", "reservedByName", "reservedByEmail", purpose, "startAt", "endAt", "updatedAt")
VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'A', 'a@example.com', 'base',
        '2030-01-01 10:00+00', '2030-01-01 11:00+00', now());

-- 1. Overlapping booking must be rejected
DO $$
BEGIN
  INSERT INTO "Reservation" (id, "resourceId", "reservedByName", "reservedByEmail", purpose, "startAt", "endAt", "updatedAt")
  VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'B', 'b@example.com', 'overlap',
          '2030-01-01 10:30+00', '2030-01-01 11:30+00', now());
  RAISE EXCEPTION 'FAIL: overlapping booking was allowed';
EXCEPTION WHEN exclusion_violation THEN
  RAISE NOTICE 'PASS: overlapping booking rejected';
END $$;

-- 2. Back-to-back booking must be allowed
INSERT INTO "Reservation" (id, "resourceId", "reservedByName", "reservedByEmail", purpose, "startAt", "endAt", "updatedAt")
VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'C', 'c@example.com', 'back-to-back',
        '2030-01-01 11:00+00', '2030-01-01 12:00+00', now());
DO $$ BEGIN RAISE NOTICE 'PASS: back-to-back booking allowed'; END $$;

-- 3. Cancelled booking must not block the slot
INSERT INTO "Reservation" (id, "resourceId", "reservedByName", "reservedByEmail", purpose, "startAt", "endAt", status, "updatedAt")
VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'D', 'd@example.com', 'cancelled',
        '2030-01-01 10:00+00', '2030-01-01 11:00+00', 'CANCELLED', now());
DO $$ BEGIN RAISE NOTICE 'PASS: cancelled booking does not block'; END $$;

-- 4. end must be after start
DO $$
BEGIN
  INSERT INTO "Reservation" (id, "resourceId", "reservedByName", "reservedByEmail", purpose, "startAt", "endAt", "updatedAt")
  VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'E', 'e@example.com', 'bad range',
          '2030-01-02 10:00+00', '2030-01-02 10:00+00', now());
  RAISE EXCEPTION 'FAIL: zero-length booking was allowed';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS: zero-length booking rejected';
END $$;

ROLLBACK;