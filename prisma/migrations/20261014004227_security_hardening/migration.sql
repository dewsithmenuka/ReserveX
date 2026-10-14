ALTER TABLE "Resource"
  ADD CONSTRAINT "Resource_price_max" CHECK ("pricePerHourCents" <= 10000000);

-- A booking is free exactly when its amount is zero.
ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_amount_matches_status" CHECK (
    ("paymentStatus" = 'NOT_REQUIRED' AND "amountCents" = 0)
    OR ("paymentStatus" <> 'NOT_REQUIRED' AND "amountCents" > 0)
  );