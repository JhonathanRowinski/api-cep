import { jest } from '@jest/globals';
import { HttpService } from './http.service.js';

describe('HttpService', () => {
  let httpService: HttpService;

  beforeEach(() => {
    httpService = new HttpService();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should return the response body when the request succeeds', async () => {
    const data = {
      cep: '80020000',
      state: 'PR',
    };

    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(data), {
        status: 200,
      }),
    );

    await expect(
      httpService.get('https://example.com'),
    ).resolves.toEqual(data);
  });

  it('should throw an error when the response is not successful', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 404,
        statusText: 'Not Found',
      }),
    );

    await expect(
      httpService.get('https://example.com'),
    ).rejects.toThrow('HTTP 404: Not Found');
  });

  it('should throw a timeout error when the request exceeds the provided timeout', async () => {
    jest.useFakeTimers();

    jest.spyOn(global, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal;

          signal?.addEventListener('abort', () => {
            reject(signal.reason);
          });
        }),
    );

    const request = httpService.get('https://example.com', 2000);

    jest.advanceTimersByTime(2000);

    await expect(request)
    .rejects.toThrow('HTTP request timed out after 2000ms.');
  });

  it('should use the default timeout when no timeout is provided', async () => {
    jest.useFakeTimers();

    jest.spyOn(global, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal;

          signal?.addEventListener('abort', () => {
            reject(signal.reason);
          });
        }),
    );

    const request = httpService.get('https://example.com');

    jest.advanceTimersByTime(10000);

    await expect(request)
    .rejects.toThrow('HTTP request timed out after 10000ms.');
  });

  it('should propagate errors that are not caused by timeout', async () => {
    const error = new Error('Connection refused');

    jest.spyOn(global, 'fetch').mockRejectedValue(error);

    await expect(
      httpService.get('https://example.com'),
    ).rejects.toThrow('Connection refused');
  });
});