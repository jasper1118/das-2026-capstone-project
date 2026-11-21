import { createBooking, getEvent, getHoldExpiresAt, pay, releaseBooking } from '../api.js';
import { el, eventArtFor, formatEventDate, formatPrice } from '../ui.js';

const root = document.querySelector('#event-root');
let countdownInterval;

function setPageTitle(event) {
  document.title = `${event.title} - Rally`;
  document.querySelector('meta[name="description"]')?.setAttribute('content', `${event.title} at ${event.venue}, ${event.city}. Choose tickets on Rally.`);
}

function pageMessage(title, message) {
  root.setAttribute('aria-busy', 'false');
  root.replaceChildren(el('section', { className: 'page-message' }, [
    el('p', { className: 'eyebrow' }, 'RALLY / EVENT'),
    el('h1', {}, title),
    el('p', {}, message),
    el('a', { className: 'button button-dark', href: '/#events' }, 'Back to discovery'),
  ]));
}

function eventHero(event) {
  const art = eventArtFor(event.id);
  const image = el('img', { src: art.src, alt: art.alt, fetchPriority: 'high' });
  const imageWrap = el('div', { className: 'detail-image' }, image);
  const details = el('div', { className: 'detail-copy' }, [
    el('p', { className: 'eyebrow detail-eyebrow' }, [el('span', { className: 'eyebrow-index' }, 'EVENT'), ` ${art.kind.toUpperCase()}`]),
    el('p', { className: 'detail-date' }, formatEventDate(event.startsAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })),
    el('h1', {}, event.title),
    el('p', { className: 'detail-venue' }, [el('span', { 'aria-hidden': 'true' }, '↗'), ` ${event.venue} · ${event.city}`]),
    el('p', { className: 'detail-description' }, event.description),
    el('p', { className: 'detail-host' }, `HOSTED BY ${event.host.toUpperCase()}`),
  ]);
  return el('section', { className: 'event-hero' }, [imageWrap, details]);
}

function tierForm(tier, event) {
  const soldOut = tier.capacity - tier.sold <= 0;
  const maximum = Math.min(10, tier.capacity - tier.sold);
  const selectId = `quantity-${tier.id}`;
  const quantitySelect = el('select', {
    id: selectId,
    name: 'quantity',
    disabled: soldOut,
    'aria-describedby': `${selectId}-limit`,
  }, soldOut
    ? el('option', { value: '0' }, '0')
    : Array.from({ length: maximum }, (_, index) => el('option', { value: String(index + 1) }, String(index + 1))));
  const status = el('span', { className: soldOut ? 'tier-status sold-out' : 'tier-status' }, soldOut ? 'Sold out' : `${tier.capacity - tier.sold} available`);
  const form = el('form', { className: `tier-row${soldOut ? ' is-sold-out' : ''}` });
  const button = el('button', {
    className: soldOut ? 'button button-disabled' : 'button button-dark tier-action',
    type: 'submit',
    disabled: soldOut,
  }, soldOut ? 'Sold out' : 'Reserve');

  form.append(
    el('div', { className: 'tier-description' }, [
      el('h3', {}, tier.name),
      el('p', { id: `${selectId}-limit`, className: 'tier-availability' }, soldOut ? 'This ticket type is no longer available.' : `Up to ${maximum} per booking`),
    ]),
    el('p', { className: 'tier-price' }, formatPrice(tier.priceCents)),
    el('label', { className: 'quantity-control', htmlFor: selectId }, [el('span', { className: 'field-label' }, 'Qty'), quantitySelect]),
    status,
    button,
  );

  if (!soldOut) {
    form.addEventListener('submit', async (submission) => {
      submission.preventDefault();
      button.disabled = true;
      button.textContent = 'Reserving…';
      const quantity = Number(quantitySelect.value);
      try {
        const booking = await createBooking(tier.id, quantity);
        renderCheckout(event, tier, booking);
      } catch (error) {
        button.disabled = false;
        button.textContent = 'Reserve';
        if (error.code === 'SOLD_OUT') {
          const updated = await getEvent(event.id);
          renderEvent(updated, 'That ticket just sold out. Check the updated availability.');
          return;
        }
        form.insertBefore(el('p', { className: 'form-error', role: 'alert' }, error.message), button);
      }
    });
  }
  return form;
}

function renderTickets(event, notice = '') {
  const tierList = el('div', { className: 'tier-list' }, event.tiers.map((tier) => tierForm(tier, event)));
  return el('section', { className: 'ticket-section', 'aria-labelledby': 'tickets-heading' }, [
    el('div', { className: 'ticket-heading' }, [
      el('div', {}, [el('p', { className: 'eyebrow' }, 'CHOOSE YOUR ENTRY'), el('h2', { id: 'tickets-heading' }, 'Tickets')]),
      el('p', { className: 'ticket-note' }, 'Prices are in Nigerian naira.'),
    ]),
    notice ? el('p', { className: 'notice-banner', role: 'status' }, notice) : null,
    tierList,
    el('p', { className: 'mock-note' }, 'Checkout is simulated. No payment details are sent or charged.'),
  ]);
}

function renderEvent(event, notice = '') {
  clearInterval(countdownInterval);
  root.setAttribute('aria-busy', 'false');
  root.replaceChildren(
    el('a', { className: 'back-link', href: '/#events' }, [el('span', { 'aria-hidden': 'true' }, '←'), ' All events']),
    eventHero(event),
    renderTickets(event, notice),
  );
  setPageTitle(event);
}

function renderConfirmation(booking, event) {
  clearInterval(countdownInterval);
  root.replaceChildren(
    el('a', { className: 'back-link', href: '/#events' }, [el('span', { 'aria-hidden': 'true' }, '←'), ' All events']),
    el('section', { className: 'confirmation-panel' }, [
      el('span', { className: 'confirmation-mark', 'aria-hidden': 'true' }, '✓'),
      el('p', { className: 'eyebrow' }, 'YOU’RE ON THE LIST'),
      el('h1', {}, 'That’s a plan.'),
      el('p', { className: 'confirmation-event' }, `${event.title} · ${booking.quantity} ${booking.quantity === 1 ? 'ticket' : 'tickets'}`),
      el('p', { className: 'confirmation-reference-label' }, 'BOOKING REFERENCE'),
      el('p', { className: 'confirmation-reference' }, booking.reference),
      el('a', { className: 'button button-dark', href: '/#events' }, 'Find another event'),
    ]),
  );
  root.setAttribute('aria-busy', 'false');
}

async function renderCheckout(event, tier, booking) {
  const expiresAt = await getHoldExpiresAt(booking.reference);
  const checkout = el('section', { className: 'checkout-section', 'aria-labelledby': 'checkout-heading' });
  const errorMessage = el('p', { className: 'form-error', role: 'alert', hidden: true });
  const countdown = el('span', { className: 'countdown-value' });
  const nameInput = el('input', {
    id: 'cardholder',
    name: 'cardholder',
    type: 'text',
    autocomplete: 'cc-name',
    required: true,
    placeholder: 'Name on card',
  });
  const numberInput = el('input', {
    id: 'card-number',
    name: 'cardNumber',
    type: 'text',
    inputMode: 'numeric',
    autocomplete: 'cc-number',
    required: true,
    minLength: 12,
    maxLength: 23,
    pattern: '[0-9 ]{12,23}',
    placeholder: '4242 4242 4242 4242',
  });
  const payButton = el('button', { className: 'button button-dark pay-button', type: 'submit' }, `Pay ${formatPrice(booking.amountCents)}`);
  const paymentForm = el('form', { className: 'payment-form' }, [
    el('label', { className: 'checkout-field', htmlFor: 'cardholder' }, [el('span', { className: 'field-label' }, 'Name on card'), nameInput]),
    el('label', { className: 'checkout-field', htmlFor: 'card-number' }, [el('span', { className: 'field-label' }, 'Card number'), numberInput]),
    el('p', { className: 'test-card-note' }, 'For a successful demo, use 4242 4242 4242 4242. To test a decline, use 4000 0000 0000 0002.'),
    errorMessage,
    payButton,
  ]);

  paymentForm.addEventListener('submit', async (submission) => {
    submission.preventDefault();
    errorMessage.hidden = true;
    payButton.disabled = true;
    payButton.textContent = 'Processing…';
    try {
      const paidBooking = await pay(booking.reference, {
        cardholder: nameInput.value.trim(),
        cardNumber: numberInput.value,
      });
      renderConfirmation(paidBooking, event);
    } catch (error) {
      errorMessage.textContent = error.message;
      errorMessage.hidden = false;
      payButton.disabled = false;
      payButton.textContent = `Try payment again · ${formatPrice(booking.amountCents)}`;
    }
  });

  const summary = el('div', { className: 'checkout-summary' }, [
    el('div', {}, [el('p', { className: 'checkout-event-title' }, event.title), el('p', { className: 'checkout-tier-name' }, `${booking.quantity} × ${tier.name}`)]),
    el('strong', {}, formatPrice(booking.amountCents)),
  ]);
  const timer = el('p', { className: 'hold-timer' }, [
    el('span', { className: 'timer-mark', 'aria-hidden': 'true' }, '◷'),
    ' Seats held for ',
    countdown,
  ]);
  const changeTicketsButton = el('button', {
    className: 'text-button',
    type: 'button',
    onClick: async () => {
      await releaseBooking(booking.reference);
      renderEvent(await getEvent(event.id), 'Your hold was released. Choose tickets again.');
    },
  }, 'Change tickets');
  checkout.append(
    el('div', { className: 'checkout-heading-row' }, [
      el('div', {}, [el('p', { className: 'eyebrow' }, 'ONE LAST THING'), el('h2', { id: 'checkout-heading' }, 'Checkout')]),
      changeTicketsButton,
    ]),
    summary,
    timer,
    paymentForm,
  );
  root.replaceChildren(
    el('a', { className: 'back-link', href: '/#events' }, [el('span', { 'aria-hidden': 'true' }, '←'), ' All events']),
    eventHero(event),
    checkout,
  );

  const updateCountdown = async () => {
    const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
    const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
    const seconds = (remaining % 60).toString().padStart(2, '0');
    countdown.textContent = `${minutes}:${seconds}`;
    if (remaining > 0) return;

    clearInterval(countdownInterval);
    await getEvent(event.id);
    paymentForm.hidden = true;
    timer.classList.add('timer-expired');
    timer.replaceChildren('This ticket hold expired. ');
    checkout.append(el('button', {
      className: 'button button-outline',
      type: 'button',
      onClick: async () => renderEvent(await getEvent(event.id), 'Choose from the latest ticket availability.'),
    }, 'Choose tickets again'));
  };
  await updateCountdown();
  if (expiresAt && Date.now() < expiresAt) countdownInterval = setInterval(updateCountdown, 1000);
}

async function initialize() {
  const eventId = new URLSearchParams(window.location.search).get('id');
  if (!eventId) {
    pageMessage('No event selected.', 'Choose an event from discovery to see its tickets.');
    return;
  }
  try {
    const event = await getEvent(eventId);
    renderEvent(event);
  } catch (error) {
    pageMessage('Event not found.', error.message);
  }
}

initialize();