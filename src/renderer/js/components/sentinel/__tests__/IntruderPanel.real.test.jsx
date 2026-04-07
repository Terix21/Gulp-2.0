import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import IntruderPanel from '../IntruderPanel.jsx';
const { ChakraProvider, defaultSystem } = require('@chakra-ui/react');

function renderWithChakra(node) {
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

    window.sentinel = {
      intruder: intruderApi,
    };
  });

  it('renders the intruder heading and helper text', async () => {
    renderWithChakra(React.createElement(IntruderPanel));

    expect(screen.getByText('Intruder')).toBeTruthy();
    await waitFor(() => expect(intruderApi.list).toHaveBeenCalled());
  });

  it('starts an attack using marker-derived positions', async () => {
    renderWithChakra(React.createElement(IntruderPanel));

    fireEvent.click(screen.getByRole('button', { name: 'Start Attack' }));

    await waitFor(() => expect(intruderApi.configure).toHaveBeenCalledTimes(1));
    const payload = intruderApi.configure.mock.calls[0][0];
    expect(payload.config.attackType).toBe('sniper');
    expect(payload.config.requestTemplate.url).toContain('§payload§');
    expect(payload.config.positions).toHaveLength(1);

    await waitFor(() => expect(intruderApi.start).toHaveBeenCalledWith({ configId: 'cfg-1' }));
  });

  it('appends live progress results to the table', async () => {
    renderWithChakra(React.createElement(IntruderPanel));

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
});
