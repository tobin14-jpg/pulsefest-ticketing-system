import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ReserveTickets from './pages/ReserveTickets';
import BookingConfirmation from './pages/BookingConfirmation';
import Festivals from './pages/Festivals';
import axiosInstance from './axiosConfig';

jest.mock('./axiosConfig', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('./context/AuthContext', () => ({ useAuth: () => ({ user: { token: 'attendee-token' } }) }));

const event = {
  _id: '0123456789abcdef01234567', name: 'River Sounds', date: '2099-12-10T10:00:00.000Z',
  location: 'Perth', price: 25, capacity: 10, remainingTickets: 10,
};
const requestId = '6f363f3a-bd62-4d98-bc8e-aebcaf6c61be';
const booking = { bookingReference: 'PF-' + requestId, quantity: 4, eventId: event };
let container;
let root;

beforeEach(() => {
  jest.resetAllMocks();
  Object.defineProperty(window, 'crypto', { configurable: true, value: { randomUUID: jest.fn(() => requestId) } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const renderBooking = async (path = `/festivals/${event._id}/reserve`) => {
  await act(async () => root.render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/festivals" element={<Festivals />} />
        <Route path="/festivals/:id/reserve" element={<ReserveTickets />} />
        <Route path="/bookings/:reference" element={<BookingConfirmation />} />
      </Routes>
    </MemoryRouter>
  ));
};

test('links an available festival to its reservation screen', async () => {
  axiosInstance.get.mockResolvedValue({ data: [event] });
  await renderBooking('/festivals');
  const link = container.querySelector('a.primary-button');
  expect(link.textContent).toBe('Reserve tickets');
  expect(link.getAttribute('href')).toBe(`/festivals/${event._id}/reserve`);
});

test('confirms only after the POST succeeds and the saved booking is retrieved', async () => {
  axiosInstance.get.mockResolvedValueOnce({ data: event }).mockResolvedValueOnce({ data: booking });
  let finish;
  axiosInstance.post.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  await renderBooking();
  await act(async () => Simulate.change(container.querySelector('#quantity'), { target: { value: '4' } }));
  await act(async () => Simulate.submit(container.querySelector('form')));
  expect(container.textContent).toMatch(/Confirming reservation/);
  expect(container.textContent).not.toMatch(/Reservation confirmed/);
  expect(container.querySelector('button[type="submit"]').disabled).toBe(true);
  expect(axiosInstance.post).toHaveBeenCalledWith('/api/reservations', {
    eventId: event._id, quantity: 4, requestId,
  }, { headers: { Authorization: 'Bearer attendee-token' } });
  await act(async () => finish({ data: { bookingReference: booking.bookingReference } }));
  expect(axiosInstance.get).toHaveBeenLastCalledWith(`/api/reservations/${booking.bookingReference}`, {
    headers: { Authorization: 'Bearer attendee-token' },
  });
  expect(container.textContent).toMatch(/Reservation confirmed/);
  expect(container.textContent).toContain(booking.bookingReference);
  expect(container.textContent).toContain('4 tickets are reserved');
});

test('retries an uncertain response using the same request ID', async () => {
  axiosInstance.get.mockResolvedValueOnce({ data: event }).mockResolvedValueOnce({ data: booking });
  axiosInstance.post.mockRejectedValueOnce(new Error('Network lost')).mockResolvedValueOnce({ data: booking });
  await renderBooking();
  await act(async () => Simulate.submit(container.querySelector('form')));
  expect(container.querySelector('[role="alert"]').textContent).toMatch(/uncertain/);
  expect(container.textContent).not.toMatch(/Reservation confirmed/);
  await act(async () => Simulate.submit(container.querySelector('form')));
  expect(axiosInstance.post.mock.calls[0][1]).toEqual(axiosInstance.post.mock.calls[1][1]);
  expect(window.crypto.randomUUID).toHaveBeenCalledTimes(1);
});

test('shows insufficient availability from the backend without confirming', async () => {
  axiosInstance.get.mockResolvedValue({ data: event });
  axiosInstance.post.mockRejectedValue({ response: { status: 409, data: { message: 'Not enough tickets remain.' } } });
  await renderBooking();
  await act(async () => Simulate.submit(container.querySelector('form')));
  expect(container.querySelector('[role="alert"]').textContent).toBe('Not enough tickets remain.');
  expect(container.textContent).not.toMatch(/Reservation confirmed/);
  expect(container.querySelector('button[type="submit"]').disabled).toBe(false);
});

test('rejects invalid quantities and disables sold-out bookings', async () => {
  axiosInstance.get.mockResolvedValue({ data: event });
  await renderBooking();
  await act(async () => Simulate.change(container.querySelector('#quantity'), { target: { value: '5' } }));
  await act(async () => Simulate.submit(container.querySelector('form')));
  expect(container.querySelector('[role="alert"]').textContent).toMatch(/1 to 4/);
  expect(axiosInstance.post).not.toHaveBeenCalled();
  axiosInstance.get.mockResolvedValue({ data: { ...event, remainingTickets: 0 } });
  await act(async () => container.querySelector('button[type="button"]').click());
  expect(container.querySelector('button[type="submit"]').disabled).toBe(true);
  expect(container.textContent).toMatch(/sold out/);
});

test('does not claim confirmation when a saved booking is inaccessible', async () => {
  axiosInstance.get.mockRejectedValue({ response: { status: 404, data: { message: 'Booking not found for your account.' } } });
  await renderBooking(`/bookings/${booking.bookingReference}`);
  expect(container.querySelector('[role="alert"]').textContent).toMatch(/not found/);
  expect(container.textContent).not.toMatch(/Reservation confirmed/);
});
