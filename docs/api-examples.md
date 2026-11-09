# Build 4 API examples

Start the server with `npm start`. The API keeps data in memory, so restart it to clear the examples. Replace `ORGANIZER_ID`, `ATTENDEE_ID` and returned IDs/references with values from your responses.

For PowerShell, run `node src/server.js` from the project folder in a separate terminal, then use the PowerShell examples below. Set these IDs once, replacing the placeholders with your own values:

```powershell
$organizerId = 'ORGANIZER_ID'
$attendeeId = 'ATTENDEE_ID'
```

The PowerShell examples use variables returned by earlier examples (`$event`, `$tier` and `$booking`), so run the create/tier steps before the later steps. The cancel example creates a separate pending booking because the payment example makes its booking paid.

## Create an event

```bash
curl -X POST http://localhost:3000/api/events \
  -H 'content-type: application/json' \
  -H 'x-user-id: ORGANIZER_ID' \
  -d '{"title":"Lagos Tech Meetup","city":"Lagos","venue":"Main Hall","startsAt":"2026-12-05T17:00:00Z"}'
```
PowerShell:

```powershell
$event = Invoke-RestMethod `
  -Uri 'http://localhost:3000/api/events' `
  -Method Post `
  -Headers @{ 'x-user-id' = $organizerId } `
  -ContentType 'application/json' `
  -Body (@{
    title = 'Lagos Tech Meetup'
    city = 'Lagos'
    venue = 'Main Hall'
    startsAt = '2026-12-05T17:00:00Z'
  } | ConvertTo-Json -Compress)
$event | ConvertTo-Json -Depth 5
```

## Add a ticket tier

```bash
curl -X POST http://localhost:3000/api/events/EVENT_ID/tiers \
  -H 'content-type: application/json' \
  -H 'x-user-id: ORGANIZER_ID' \
  -d '{"name":"General","priceCents":500000,"capacity":100}'
```
PowerShell:

```powershell
$tier = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/events/$($event.id)/tiers" `
  -Method Post `
  -Headers @{ 'x-user-id' = $organizerId } `
  -ContentType 'application/json' `
  -Body (@{
    name = 'General'
    priceCents = 500000
    capacity = 100
  } | ConvertTo-Json -Compress)
$tier | ConvertTo-Json -Depth 5
```

## Publish the event

```bash
curl -X POST http://localhost:3000/api/events/EVENT_ID/publish \
  -H 'x-user-id: ORGANIZER_ID'
```
PowerShell:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/events/$($event.id)/publish" `
  -Method Post `
  -Headers @{ 'x-user-id' = $organizerId } |
  ConvertTo-Json -Depth 5
```

## Search published events

```bash
curl 'http://localhost:3000/api/events?q=tech&city=lagos&from=2026-12-01&to=2026-12-31&maxPriceCents=500000&onlyAvailable=true&sort=price'
```

Supported sort values are `date`, `price` and `availability`.

PowerShell:

```powershell
Invoke-RestMethod `
  -Uri 'http://localhost:3000/api/events?q=tech&city=lagos&from=2026-12-01&to=2026-12-31&maxPriceCents=500000&onlyAvailable=true&sort=price' |
  ConvertTo-Json -Depth 5
```

## Book tickets

```bash
curl -X POST http://localhost:3000/api/bookings \
  -H 'content-type: application/json' \
  -H 'x-user-id: ATTENDEE_ID' \
  -d '{"tierId":"TIER_ID","quantity":2}'
```
PowerShell:

```powershell
$booking = Invoke-RestMethod `
  -Uri 'http://localhost:3000/api/bookings' `
  -Method Post `
  -Headers @{ 'x-user-id' = $attendeeId } `
  -ContentType 'application/json' `
  -Body (@{
    tierId = $tier.id
    quantity = 2
  } | ConvertTo-Json -Compress)
$booking | ConvertTo-Json -Depth 5
```

## Pay for a booking

```bash
curl -X POST http://localhost:3000/api/bookings/BOOKING_REFERENCE/pay \
  -H 'content-type: application/json' \
  -H 'x-user-id: ATTENDEE_ID' \
  -d '{}'
```

To exercise a declined mock payment, use `-d '{"decline":true}'`; no card number is accepted or sent to the payment gateway.

PowerShell:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/bookings/$($booking.reference)/pay" `
  -Method Post `
  -Headers @{ 'x-user-id' = $attendeeId } `
  -ContentType 'application/json' `
  -Body '{}'
```

To exercise a declined mock payment instead, send `decline = $true`. The API responds with HTTP 409 and `PAYMENT_DECLINED`; the booking remains pending, so you can then run the successful payment example above:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/bookings/$($booking.reference)/pay" `
  -Method Post `
  -Headers @{ 'x-user-id' = $attendeeId } `
  -ContentType 'application/json' `
  -Body (@{ decline = $true } | ConvertTo-Json -Compress)
```

## Cancel an unpaid booking

```bash
curl -X POST http://localhost:3000/api/bookings/UNPAID_BOOKING_REFERENCE/cancel \
  -H 'x-user-id: ATTENDEE_ID'
```
PowerShell:

```powershell
$cancelBooking = Invoke-RestMethod `
  -Uri 'http://localhost:3000/api/bookings' `
  -Method Post `
  -Headers @{ 'x-user-id' = $attendeeId } `
  -ContentType 'application/json' `
  -Body (@{
    tierId = $tier.id
    quantity = 1
  } | ConvertTo-Json -Compress)

Invoke-RestMethod `
  -Uri "http://localhost:3000/api/bookings/$($cancelBooking.reference)/cancel" `
  -Method Post `
  -Headers @{ 'x-user-id' = $attendeeId } |
  ConvertTo-Json -Depth 5
```

## Unpublish an event

```bash
curl -X POST http://localhost:3000/api/events/EVENT_ID/unpublish \
  -H 'x-user-id: ORGANIZER_ID'
```
PowerShell:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/api/events/$($event.id)/unpublish" `
  -Method Post `
  -Headers @{ 'x-user-id' = $organizerId } |
  ConvertTo-Json -Depth 5
```