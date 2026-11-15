import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Festivals from './pages/Festivals';
import { AuthProvider } from './context/AuthContext';
import axiosInstance from './axiosConfig';

jest.mock('./axiosConfig', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('./context/AuthContext', () => ({
  ...jest.requireActual('./context/AuthContext'),
  useAuth: () => ({ user: { token: 'test-token' } }),
}));

let container;
let root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  jest.clearAllMocks();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

test('shows the festival loading state', async () => {
  axiosInstance.get.mockReturnValue(new Promise(() => {}));
  await act(async () => root.render(<Festivals />));
  expect(container.querySelector('[role="status"]').textContent).toMatch(/Loading festivals/);
});

test('shows the empty state after a successful empty response', async () => {
  axiosInstance.get.mockResolvedValue({ data: [] });
  await act(async () => root.render(<Festivals />));
  expect(container.textContent).toMatch(/No upcoming festivals yet/);
  expect(axiosInstance.get).toHaveBeenCalledWith('/api/events', { headers: { Authorization: 'Bearer test-token' } });
});

test('shows real response details and sold-out availability', async () => {
  axiosInstance.get.mockResolvedValue({ data: [{
    _id: 'festival-id', name: 'River Sounds', description: 'Music by the river.',
    date: '2030-12-10T10:00:00.000Z', location: 'Perth', price: 25, remainingTickets: 0,
  }] });
  await act(async () => root.render(<Festivals />));
  expect(container.querySelector('article').textContent).toMatch(/River Sounds/);
  expect(container.textContent).toMatch(/Sold out/);
  expect(container.textContent).toMatch(/Perth/);
  expect(container.textContent).toMatch(/25\.00/);
});

test('shows errors and retries without showing a false empty state', async () => {
  axiosInstance.get.mockRejectedValueOnce({ response: { data: { message: 'Please log in again.' } } })
    .mockResolvedValueOnce({ data: [] });
  await act(async () => root.render(<Festivals />));
  expect(container.querySelector('[role="alert"]').textContent).toBe('Please log in again.');
  expect(container.textContent).not.toMatch(/No upcoming festivals/);
  await act(async () => container.querySelector('button').click());
  expect(container.textContent).toMatch(/No upcoming festivals/);
});

test('renders the PulseFest login screen through the existing router', async () => {
  window.history.replaceState({}, '', '/login');
  await act(async () => root.render(<AuthProvider><App /></AuthProvider>));
  expect(container.querySelector('h1').textContent).toBe('Welcome to PulseFest');
  expect(container.querySelector('input[type="email"]')).not.toBeNull();
  expect(container.querySelector('input[type="password"]')).not.toBeNull();
});
