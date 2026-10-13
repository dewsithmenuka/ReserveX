# ReserveX: ER Diagram

```mermaid
erDiagram
    USER |o--o{ RESERVATION : "makes"
    RESOURCE ||--o{ RESERVATION : "is booked by"

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
        timestamptz createdAt
        timestamptz updatedAt
    }
```

## Database rules

- `Reservation.resourceId` uses `ON DELETE RESTRICT`: a resource with booking history cannot be deleted, only deactivated.
- `Reservation.userId` uses `ON DELETE SET NULL`: bookings survive if a user is removed.
- `CHECK (endAt > startAt)` on `Reservation`.
- `CHECK (capacity IS NULL OR capacity > 0)` on `Resource`.
- Exclusion constraint `Reservation_no_overlap` (GiST on `resourceId` and `tstzrange(startAt, endAt, '[)')`, applied only where `status = 'CONFIRMED'`). Overlapping confirmed bookings for one resource are impossible, while back-to-back bookings and cancelled bookings are allowed.