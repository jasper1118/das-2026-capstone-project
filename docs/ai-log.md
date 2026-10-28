# AI log

Every time you give an AI tool a significant prompt, add an entry. Three lines each.
"Nothing was wrong" is allowed, but it is rarely true. Your instructor will read this.

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


