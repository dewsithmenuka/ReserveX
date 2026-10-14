# ReserveX: ER Diagram

erDiagram

    USER |o--o{ RESERVATION : "makes"
    RESOURCE ||--o{ RESERVATION : "is booked by"
    RESERVATION ||--o{ PAYMENT : "has"
    USER |o--o{ PAYMENT : "made"

    USER {
        uuid id PK
        string name
        string email UK
        string passwordHash
        enum role "USER | ADMIN"
        timestamptz createdAt
        timestamptz updatedAt
    }

    RESOURCE {
        uuid id PK
        string name
        string type
        string description
        string location
        int capacity
        int pricePerHourCents
        boolean isActive
        timestamptz createdAt
        timestamptz updatedAt
    }

    RESERVATION {
        uuid id PK
        uuid resourceId FK
        uuid userId FK "nullable"
        string reservedByName
        string reservedByEmail
        string purpose
        timestamptz startAt
        timestamptz endAt
        enum status "CONFIRMED | CANCELLED"
        int amountCents
        enum paymentStatus "NOT_REQUIRED | UNPAID | PAID | REFUNDED"
        timestamptz createdAt
        timestamptz updatedAt
    }

    PAYMENT {
        uuid id PK
        uuid reservationId FK
        uuid userId FK "nullable"
        enum kind "CHARGE | REFUND"
        enum result "SUCCEEDED | FAILED"
        int amountCents
        string currency
        string cardBrand
        string cardLast4
        string failureReason
        timestamptz createdAt
    }

## Database rules

- `Reservation.resourceId` uses `ON DELETE RESTRICT`: a resource with booking history cannot be deleted, only deactivated.
- `Reservation.userId` uses `ON DELETE SET NULL`: bookings survive if a user is removed.
- `Payment.reservationId` uses `ON DELETE RESTRICT`: a reservation referenced by payment history cannot be deleted.
- `Payment.userId` uses `ON DELETE SET NULL`: payment history survives if a user is removed.
- `CHECK (endAt > startAt)` on `Reservation`.
- `CHECK (capacity IS NULL OR capacity > 0)` on `Resource`.
- Monetary amounts must be non-negative:
  - `CHECK (pricePerHourCents >= 0)` on `Resource`.
  - `CHECK (amountCents >= 0)` on `Reservation`.
  - `CHECK (amountCents >= 0)` on `Payment`.
- Unique indexes allow at most one successful charge and one successful refund per reservation. Failed payment attempts do not consume these successful-payment slots.
- Exclusion constraint `Reservation_no_overlap` (GiST on `resourceId` and `tstzrange(startAt, endAt, '[)')`, applied only where `status = 'CONFIRMED'`). Overlapping confirmed bookings for one resource are impossible, while back-to-back bookings and cancelled bookings are allowed.
- Free reservations use `paymentStatus = NOT_REQUIRED`; reservations requiring payment begin with `UNPAID`. Successful payment updates the reservation to `PAID`, and a successful refund updates it to `REFUNDED`.