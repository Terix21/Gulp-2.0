import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import IntruderPanel from '../IntruderPanel.jsx';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';

function renderWithProvider(node) {
  return render(React.createElement(ChakraProvider, { value: defaultSystem }, node));
}

describe('IntruderPanel real interactions', () => {
  let intruderApi;
  let progressHandler;

  beforeEach(() => {
    progressHandler = null;
    intruderApi = {
      configure: vi.fn(async () => ({ ok: true, configId: 'cfg-1' })),
      start: vi.fn(async () => ({ attackId: 'atk-1' })),
      stop: vi.fn(async () => ({ ok: true })),
      list: vi.fn(async () => ({ items: [] })),
      results: vi.fn(async () => ({ results: [], total: 0 })),
      onProgress: vi.fn((handler) => {
        progressHandler = handler;
        return () => {};
      }),
    };

    globalThis.window.sentinel = {
      intruder: intruderApi,
    };
  });

  it('renders the intruder heading and helper text', async () => {
    renderWithProvider(React.createElement(IntruderPanel));

    expect(screen.getByText('Intruder')).toBeTruthy();
    await waitFor(() => expect(intruderApi.list).toHaveBeenCalled());
  });

  it('starts an attack using marker-derived positions', async () => {
    renderWithProvider(React.createElement(IntruderPanel));

    fireEvent.click(screen.getByRole('button', { name: 'Start Attack' }));

    await waitFor(() => expect(intruderApi.configure).toHaveBeenCalledTimes(1));
    const payload = intruderApi.configure.mock.calls[0][0];
    expect(payload.config.attackType).toBe('sniper');
    expect(payload.config.requestTemplate.url).toContain('§payload§');
    expect(payload.config.positions).toHaveLength(1);

    await waitFor(() => expect(intruderApi.start).toHaveBeenCalledWith({ configId: 'cfg-1' }));
  });

  it('appends live progress results to the table', async () => {
    renderWithProvider(React.createElement(IntruderPanel));

    fireEvent.click(screen.getByRole('button', { name: 'Start Attack' }));
    await waitFor(() => expect(intruderApi.start).toHaveBeenCalled());

    await act(async () => {
      progressHandler({
        attackId: 'atk-1',
        sent: 1,
        total: 2,
        lastResult: {
          id: 'res-1',
          payload: 'position-1=admin',
          statusCode: 500,
          length: 123,
          duration: 42,
          isAnomalous: true,
          anomalyReasons: ['status changed'],
        },
        status: 'running',
      });
    });

    await waitFor(() => expect(screen.getByText('position-1=admin')).toBeTruthy());
    expect(screen.getByText('status changed')).toBeTruthy();
  });

  it('renders anomalous rows without anomalyReasons safely', async () => {
    intruderApi.list.mockResolvedValueOnce({ items: [{ id: 'atk-1', sent: 1, total: 1, status: 'completed', requestSummary: 'GET /', attackType: 'sniper' }] });
    intruderApi.results.mockResolvedValueOnce({
      results: [{
        id: 'res-missing-reasons',
        payload: 'position-1=test',
        statusCode: 500,
        length: 10,
        duration: 5,
        isAnomalous: true,
      }],
      total: 1,
    });

    renderWithProvider(React.createElement(IntruderPanel));

    await waitFor(() => expect(screen.getByText('position-1=test')).toBeTruthy());
    expect(screen.getByText('anomalous')).toBeTruthy();
  });
});
