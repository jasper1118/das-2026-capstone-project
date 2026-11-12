# AI log

## Build 1

### Prompt 1: Build 1 domain core
- **What I asked:** Implement the Build 1 in-memory ticketing domain, readable references, FIFO waitlist, demo, and lookup benchmark.
- **What came back:** The core modules and scripts were already present, and the demo and benchmark scripts were configured. No files were created; the requested files already existed. ids.js and inventory.js were modified. The demo, benchmark and Javascript syntax were verified.
- **What was wrong (or "nothing"):** The ID module exported `referenceCode` instead of the requested `newReference`; some malformed public inputs leaked native errors, and booking lookup targets used `Math.random`. Added the requested export while keeping the old name compatible, tightened validation and booking mutation ordering. The demo and benchmark passed.

## Build 2

### Prompt 1: Build 2 prompt (docs/build-2.md)
- **What I asked:** Add a stable, non-mutating merge sort, event publishing & unpublishing functions, summaries, event search, filters and sorting, acceptance-criteria tests and  test scripts.
- **What came back:** Added the Build 2 domain functions and tests. All the tests carried out passed, and the existing demo still worked.
- **What was wrong (or "nothing"):** When unpublishing, nothing was being done to the tickets that were pending, so i fixed it to cancel pending tickets.

## Build 3

### Prompt 1: Build 3 architecture, state machine, and server
- **What I asked:** Add the architecture diagrams, booking lifecycle rules, tiny HTTP router and server, configuration, and tests from `docs/build-3.md`.
- **What came back:** Added the diagrams, transition rules, HTTP/static-file server, startup script, and focused tests. Existing domain files were left unchanged.
- **What was wrong (or "nothing"):** Nothing incorrect remained after checking every state pair and exercising health, JSON errors, API 404s, and static path containment.

## Build 4

### Prompt 1: Build 4 working REST API
- **What I asked:** Implement the in-memory REST API for creating and publishing events, searching, booking, mock payment, and cancellation.
- **What came back:** The repository, services, payment gateway, API routes, examples, and API tests were present. I ran the configured Node test command directly; all 45 tests passed.
- **What was wrong (or "nothing"):** My first PowerShell request returned `INVALID_JSON` because the request body syntax needed to work with PowerShell. A later `404` came from an older Node server process already using port 3000, not from the current API routes. Restarting the server from the project folder fixed it. The API examples use Bash syntax, so they are not directly pasteable into PowerShell.
- **What I changed:** I restarted the server from the project folder and used a PowerShell-compatible request. No application source files were changed during this troubleshooting.

## Build 5

### Prompt 1 and Prompt 2: SQLite persistence and overselling
- **What I asked:** Add SQLite persistence, a seed command and a 50-request reproduction, then fix last-seat overselling with a database-level conditional update and a regression test.
- **What came back:** Added the SQLite repository and persistent server, seed and demo scripts, then an atomic seat reservation and a 50-attendee test.
- **What was wrong (or "nothing"):** The first booking path checked and updated a stale tier in separate steps, so all 50 requests could succeed for the same last seat. The SQLite repository now increments `sold` only when `sold + quantity <= capacity`, and the service treats a zero-row update as `SOLD_OUT`.
- **Verification:** Before the fix, 50 of 50 requests succeeded and bookings counted 60 seats against capacity 11. After the fix, the test expects exactly 1 success and 49 `SOLD_OUT` responses, with 11 seats booked in total.