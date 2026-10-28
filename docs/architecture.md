# Build 3 Architecture

## Layers

```mermaid
flowchart TD
  Routes[HTTP routes] --> Services[Application services]
  Services --> Rules[Domain rules]
  Services --> Repositories[Repositories]
  Repositories --> Data[(Database or in-memory data)]
```

- Routes may translate HTTP requests and responses, but may not implement business rules or access data directly.
- Services may coordinate domain rules and repositories, but may not depend on HTTP details or call routes.
- Rules may enforce business invariants using supplied values, but may not perform HTTP, persistence, or other I/O.
- Repositories may load and save data, but may not decide business policy or call services, routes, or rules.

## Data Model

```mermaid
erDiagram
  USERS ||--o{ EVENTS : organizes
  EVENTS ||--|{ TICKET_TIERS : offers
  TICKET_TIERS ||--o{ BOOKINGS : reserves
  USERS ||--o{ BOOKINGS : makes

  USERS {
    string id PK
    string name
    string email
    string role
  }
  EVENTS {
    string id PK
    string organizer_id FK
    string title
    string city
    string venue
    datetime starts_at
    string status
  }
  TICKET_TIERS {
    string id PK
    string event_id FK
    string name
    integer price_cents
    integer capacity
  }
  BOOKINGS {
    string id PK
    string user_id FK
    string tier_id FK
    integer quantity
    integer amount_cents
    string status
  }
```

## Booking Life Cycle

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> paid
  pending --> cancelled
  paid --> checked_in
  paid --> refunded
  paid --> cancelled
  cancelled --> [*]
  refunded --> [*]
  checked_in --> [*]
```