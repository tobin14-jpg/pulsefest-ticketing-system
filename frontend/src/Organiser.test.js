import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import App from './App';
import OrganiserRoute from './components/OrganiserRoute';
import OrganiserDashboard from './pages/OrganiserDashboard';
import CreateFestival from './pages/CreateFestival';
import EditCapacity from './pages/EditCapacity';
import { useAuth } from './context/AuthContext';
import axiosInstance from './axiosConfig';

jest.mock('./axiosConfig', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));
jest.mock('./context/AuthContext', () => ({ useAuth: jest.fn() }));

const event = {
  _id: '0123456789abcdef01234567', name: 'River Sounds', date: '2099-12-10T10:00:00.000Z',
  location: 'Perth', price: 25, capacity: 10, reservedTickets: 4, remainingTickets: 6,
};
let container;
let root;
beforeEach(() => {
  jest.resetAllMocks();
  useAuth.mockReturnValue({ user: { token: 'organiser-token', role: 'organiser' }, login: jest.fn(), logout: jest.fn() });
  window.history.replaceState({}, '', '/');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
const renderOrganiser = async (path = '/organiser') => {
  await act(async () => root.render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/organiser" element={<OrganiserRoute><OrganiserDashboard /></OrganiserRoute>} />
        <Route path="/organiser/events/new" element={<OrganiserRoute><CreateFestival /></OrganiserRoute>} />
        <Route path="/organiser/events/:id/capacity" element={<OrganiserRoute><EditCapacity /></OrganiserRoute>} />
      </Routes>
    </MemoryRouter>
  ));
};
const change = async (id, value) => act(async () => Simulate.change(container.querySelector('#' + id), { target: { id, value } }));

test('denies attendee management routes and hides organiser navigation', async () => {
  useAuth.mockReturnValue({ user: { token: 'attendee-token', role: 'attendee' }, logout: jest.fn() });
  window.history.replaceState({}, '', '/organiser/events/new');
  await act(async () => root.render(<App />));
  expect(container.textContent).toMatch(/Organiser access required/);
  expect(container.querySelector('nav a[href="/organiser"]')).toBeNull();
  expect(container.querySelector('form')).toBeNull();
  expect(axiosInstance.get).not.toHaveBeenCalled();
});

test('redirects an unauthenticated organiser route to the existing login screen', async () => {
  useAuth.mockReturnValue({ user: null, login: jest.fn() });
  window.history.replaceState({}, '', '/organiser');
  await act(async () => root.render(<App />));
  expect(container.querySelector('h1').textContent).toBe('Welcome to PulseFest');
  expect(window.location.pathname).toBe('/login');
});

test('shows dashboard loading and empty states', async () => {
  let resolve;
  axiosInstance.get.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  await renderOrganiser();
  expect(container.querySelector('[role="status"]').textContent).toMatch(/Loading events/);
  await act(async () => resolve({ data: [] }));
  expect(container.textContent).toMatch(/No festivals yet/);
  expect(container.querySelector('a[href="/organiser/events/new"]')).not.toBeNull();
});

test('renders current reserved, total and available tickets with capacity-edit links', async () => {
  axiosInstance.get.mockResolvedValue({ data: [event] });
  await renderOrganiser();
  expect(container.textContent).toContain('4 reserved / 10 total tickets');
  expect(container.textContent).toContain('6 tickets left');
  expect(container.querySelector(`a[href="/organiser/events/${event._id}/capacity"]`)).not.toBeNull();
  expect(axiosInstance.get).toHaveBeenCalledWith('/api/events/manage', { headers: { Authorization: 'Bearer organiser-token' } });
});

test('creates an event with numeric values and UTC date then shows success after persistence', async () => {
  let finish;
  axiosInstance.post.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  axiosInstance.get.mockResolvedValue({ data: [event] });
  await renderOrganiser('/organiser/events/new');
  for (const [id, value] of Object.entries({ name: 'River Sounds', location: 'Perth', date: '2099-12-10T18:00', price: '25', capacity: '10' })) {
    await change(id, value);
  }
  await act(async () => Simulate.submit(container.querySelector('form')));
  expect(container.querySelector('fieldset').disabled).toBe(true);
  expect(container.textContent).not.toMatch(/created successfully/);
  expect(axiosInstance.post).toHaveBeenCalledWith('/api/events', {
    name: 'River Sounds', description: '', location: 'Perth', date: new Date('2099-12-10T18:00').toISOString(), price: 25, capacity: 10,
  }, { headers: { Authorization: 'Bearer organiser-token' } });
  await act(async () => finish({ data: event }));
  expect(container.textContent).toMatch(/Festival created successfully/);
  expect(container.querySelector('h1').textContent).toBe('Organiser dashboard');
});

test('validates the create form and preserves entered data when backend creation fails', async () => {
  axiosInstance.post.mockRejectedValue({ response: { data: { message: 'Choose a valid future date.' } } });
  await renderOrganiser('/organiser/events/new');
  await act(async () => Simulate.submit(container.querySelector('form')));
  expect(axiosInstance.post).not.toHaveBeenCalled();
  expect(container.querySelector('[role="alert"]').textContent).toMatch(/required fields/);
  for (const [id, value] of Object.entries({ name: 'River Sounds', location: 'Perth', date: '2099-12-10T18:00', price: '25', capacity: '10' })) {
    await change(id, value);
  }
  await act(async () => Simulate.submit(container.querySelector('form')));
  expect(container.querySelector('[role="alert"]').textContent).toBe('Choose a valid future date.');
  expect(container.querySelector('#name').value).toBe('River Sounds');
  expect(container.querySelector('fieldset').disabled).toBe(false);
});

test('sends only the new capacity and returns to a refreshed dashboard after success', async () => {
  axiosInstance.get.mockResolvedValueOnce({ data: event }).mockResolvedValueOnce({ data: [{ ...event, capacity: 12, remainingTickets: 8 }] });
  axiosInstance.patch.mockResolvedValue({ data: { ...event, capacity: 12, remainingTickets: 8 } });
  await renderOrganiser(`/organiser/events/${event._id}/capacity`);
  await change('capacity', '12');
  await act(async () => Simulate.submit(container.querySelector('form')));
  expect(axiosInstance.patch).toHaveBeenCalledWith(`/api/events/${event._id}`, { capacity: 12 }, { headers: { Authorization: 'Bearer organiser-token' } });
  expect(container.textContent).toMatch(/Ticket capacity updated successfully/);
  expect(container.textContent).toContain('8 tickets left');
});

test('rejects reductions below reserved tickets and shows a server conflict after concurrent bookings', async () => {
  axiosInstance.get.mockResolvedValue({ data: event });
  axiosInstance.patch.mockRejectedValue({ response: { status: 409, data: { message: 'Capacity cannot be lower than tickets already reserved. Refresh the event and try again.' } } });
  await renderOrganiser(`/organiser/events/${event._id}/capacity`);
  await change('capacity', '3');
  await act(async () => Simulate.submit(container.querySelector('form')));
  expect(axiosInstance.patch).not.toHaveBeenCalled();
  expect(container.querySelector('[role="alert"]').textContent).toMatch(/at least 4/);
  await change('capacity', '5');
  await act(async () => Simulate.submit(container.querySelector('form')));
  expect(container.querySelector('[role="alert"]').textContent).toMatch(/Refresh the event/);
  expect(container.textContent).not.toMatch(/updated successfully/);
  axiosInstance.get.mockResolvedValue({ data: { ...event, remainingTickets: 4 } });
  await act(async () => container.querySelector('button[type="button"]').click());
  expect(container.querySelector('#capacity').min).toBe('6');
});

test('shows dashboard errors and retries without a false empty state', async () => {
  axiosInstance.get.mockRejectedValueOnce({ response: { data: { message: 'Organiser access is required.' } } }).mockResolvedValueOnce({ data: [] });
  await renderOrganiser();
  expect(container.querySelector('[role="alert"]').textContent).toMatch(/Organiser access/);
  expect(container.textContent).not.toMatch(/No festivals yet/);
  await act(async () => container.querySelector('button').click());
  expect(container.textContent).toMatch(/No festivals yet/);
});
