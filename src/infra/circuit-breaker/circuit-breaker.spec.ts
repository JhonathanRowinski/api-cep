import { jest } from '@jest/globals';
import { CircuitBreaker } from './circuit-breaker.js';

describe('CircuitBreaker', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should execute the operation when the circuit is closed', async () => {
    const breaker = new CircuitBreaker();

    const operation = jest
      .fn<() => Promise<string>>()
      .mockResolvedValue('success');

    await expect(breaker.execute(operation)).resolves.toBe('success');

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should allow execution when the circuit is closed', () => {
    const breaker = new CircuitBreaker();

    expect(breaker.canExecute()).toBe(true);
  });

  it('should open the circuit after reaching the failure threshold', async () => {
    const breaker = new CircuitBreaker();

    const operation = jest
      .fn<() => Promise<string>>()
      .mockRejectedValue(new Error('API error'));

    for (let i = 0; i < 5; i++) {
      await expect(
        breaker.execute(operation),
      ).rejects.toThrow('API error');
    }

    expect(breaker.canExecute()).toBe(false);
  });

  it('should not allow execution while the circuit is open', async () => {
    const breaker = new CircuitBreaker();

    const operation = jest
      .fn<() => Promise<string>>()
      .mockRejectedValue(new Error('API error'));

    for (let i = 0; i < 5; i++) {
      await expect(
        breaker.execute(operation),
      ).rejects.toThrow('API error');
    }

    expect(breaker.canExecute()).toBe(false);

    await expect(
      breaker.execute(operation),
    ).rejects.toThrow('Circuit Breaker is Open.');

    expect(operation).toHaveBeenCalledTimes(5);
  });

  it('should allow execution after the reset timeout', async () => {
    jest.useFakeTimers();

    const breaker = new CircuitBreaker();

    const operation = jest
      .fn<() => Promise<string>>()
      .mockRejectedValue(new Error('API error'));

    for (let i = 0; i < 5; i++) {
      await expect(
        breaker.execute(operation),
      ).rejects.toThrow('API error');
    }

    expect(breaker.canExecute()).toBe(false);

    jest.advanceTimersByTime(120000);

    expect(breaker.canExecute()).toBe(true);
  });

  it('should transition from OPEN to HALF_OPEN after the reset timeout', async () => {
    jest.useFakeTimers();

    const breaker = new CircuitBreaker();

    const operation = jest
      .fn<() => Promise<string>>()
      .mockRejectedValue(new Error('API error'));

    for (let i = 0; i < 5; i++) {
      await expect(
        breaker.execute(operation),
      ).rejects.toThrow('API error');
    }

    jest.advanceTimersByTime(120000);

    expect(breaker.canExecute()).toBe(true);

    const recoveryOperation = jest
      .fn<() => Promise<string>>()
      .mockResolvedValue('success');

    await expect(
      breaker.execute(recoveryOperation),
    ).resolves.toBe('success');

    expect(recoveryOperation).toHaveBeenCalledTimes(1);
  });

  it('should close the circuit after a successful HALF_OPEN request', async () => {
    jest.useFakeTimers();

    const breaker = new CircuitBreaker();

    const failingOperation = jest
      .fn<() => Promise<string>>()
      .mockRejectedValue(new Error('API error'));

    for (let i = 0; i < 5; i++) {
      await expect(
        breaker.execute(failingOperation),
      ).rejects.toThrow('API error');
    }

    jest.advanceTimersByTime(120000);

    const recoveryOperation = jest
      .fn<() => Promise<string>>()
      .mockResolvedValue('success');

    await expect(
      breaker.execute(recoveryOperation),
    ).resolves.toBe('success');

    expect(breaker.canExecute()).toBe(true);
  });

  it('should reopen the circuit when a HALF_OPEN request fails', async () => {
    jest.useFakeTimers();

    const breaker = new CircuitBreaker();

    const failingOperation = jest
      .fn<() => Promise<string>>()
      .mockRejectedValue(new Error('API error'));

    for (let i = 0; i < 5; i++) {
      await expect(
        breaker.execute(failingOperation),
      ).rejects.toThrow('API error');
    }

    jest.advanceTimersByTime(120000);

    await expect(
      breaker.execute(failingOperation),
    ).rejects.toThrow('API error');

    expect(breaker.canExecute()).toBe(false);
  });

  it('should not allow a second execution while HALF_OPEN request is in progress', async () => {
    jest.useFakeTimers();

    const breaker = new CircuitBreaker();

    const failingOperation = jest
      .fn<() => Promise<string>>()
      .mockRejectedValue(new Error('API error'));

    for (let i = 0; i < 5; i++) {
      await expect(
        breaker.execute(failingOperation),
      ).rejects.toThrow('API error');
    }

    jest.advanceTimersByTime(120000);

    let resolveOperation!: (value: string) => void;

    const halfOpenOperation = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveOperation = resolve;
        }),
    );

    const firstRequest =
      breaker.execute(halfOpenOperation);

    expect(breaker.canExecute()).toBe(false);

    const secondRequest =
      breaker.execute(halfOpenOperation);

    await expect(secondRequest)
    .rejects.toThrow('Circuit Breaker is Open.');

    expect(halfOpenOperation).toHaveBeenCalledTimes(1);

    resolveOperation('success');

    await expect(firstRequest).resolves.toBe('success');
  });

  it('should log when the circuit opens', async () => {
    const breaker = new CircuitBreaker();

    const loggerSpy = jest
      .spyOn(breaker['logger'], 'warn')
      .mockImplementation(() => {});

    const operation = jest
      .fn<() => Promise<string>>()
      .mockRejectedValue(new Error('API error'));

    for (let i = 0; i < 5; i++) {
      await expect(
        breaker.execute(operation),
      ).rejects.toThrow('API error');
    }

    expect(loggerSpy).toHaveBeenCalledWith(
      'Circuit Breaker Opened after 5 consecutive failures.'
    );
  });

  it('should log when the circuit transitions from OPEN to HALF_OPEN', async () => {
    jest.useFakeTimers();

    const breaker = new CircuitBreaker();

    const loggerSpy = jest
      .spyOn(breaker['logger'], 'log')
      .mockImplementation(() => {});

    const operation = jest
      .fn<() => Promise<string>>()
      .mockRejectedValue(new Error('API error'));

    for (let i = 0; i < 5; i++) {
      await expect(
        breaker.execute(operation),
      ).rejects.toThrow('API error');
    }

    jest.advanceTimersByTime(120000);

    const recoveryOperation = jest
      .fn<() => Promise<string>>()
      .mockResolvedValue('success');

    await breaker.execute(recoveryOperation);

    expect(loggerSpy).toHaveBeenCalledWith(
      'Circuit Breaker transitioned from OPEN to HALF_OPEN.'
    );
  });

  it('should log when the circuit transitions from HALF_OPEN to CLOSED', async () => {
    jest.useFakeTimers();

    const breaker = new CircuitBreaker();

    const loggerSpy = jest
      .spyOn(breaker['logger'], 'log')
      .mockImplementation(() => {});

    const operation = jest
      .fn<() => Promise<string>>()
      .mockRejectedValue(new Error('API error'));

    for (let i = 0; i < 5; i++) {
      await expect(
        breaker.execute(operation),
      ).rejects.toThrow('API error');
    }

    jest.advanceTimersByTime(120000);

    const recoveryOperation = jest
      .fn<() => Promise<string>>()
      .mockResolvedValue('success');

    await breaker.execute(recoveryOperation);

    expect(loggerSpy).toHaveBeenCalledWith(
      'Circuit Breaker transitioned from HALF_OPEN to CLOSED.'
    );
  });

  it('should log when the circuit reopens after a HALF_OPEN failure', async () => {
    jest.useFakeTimers();

    const breaker = new CircuitBreaker();

    const loggerSpy = jest
      .spyOn(breaker['logger'], 'warn')
      .mockImplementation(() => {});

    const operation = jest
      .fn<() => Promise<string>>()
      .mockRejectedValue(new Error('API error'));

    for (let i = 0; i < 5; i++) {
      await expect(
        breaker.execute(operation),
      ).rejects.toThrow('API error');
    }

    jest.advanceTimersByTime(120000);

    await expect(
      breaker.execute(operation),
    ).rejects.toThrow('API error');

    expect(loggerSpy).toHaveBeenCalledWith(
      'Circuit Breaker Reopened after HALF_OPEN attempt failed.'
    );
  });

  it('should log when rejecting a request while the circuit is open', async () => {
    const breaker = new CircuitBreaker();

    const loggerSpy = jest
      .spyOn(breaker['logger'], 'warn')
      .mockImplementation(() => {});

    const operation = jest
      .fn<() => Promise<string>>()
      .mockRejectedValue(new Error('API error'));

    for (let i = 0; i < 5; i++) {
      await expect(
        breaker.execute(operation),
      ).rejects.toThrow('API error');
    }

    await expect(
      breaker.execute(operation),
    ).rejects.toThrow('Circuit Breaker is Open.');

    expect(loggerSpy).toHaveBeenCalledWith(
      'Circuit Breaker rejected request because it is OPEN.'
    );
  });

  it('should log when rejecting a concurrent HALF_OPEN request', async () => {
    jest.useFakeTimers();

    const breaker = new CircuitBreaker();

    const loggerSpy = jest
      .spyOn(breaker['logger'], 'warn')
      .mockImplementation(() => {});

    const failingOperation = jest
      .fn<() => Promise<string>>()
      .mockRejectedValue(new Error('API error'));

    for (let i = 0; i < 5; i++) {
      await expect(
        breaker.execute(failingOperation),
      ).rejects.toThrow('API error');
    }

    jest.advanceTimersByTime(120000);

    let resolveOperation!: (value: string) => void;

    const halfOpenOperation = jest.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveOperation = resolve;
        }),
    );

    const firstRequest =
      breaker.execute(halfOpenOperation);

    await expect(
      breaker.execute(halfOpenOperation),
    ).rejects.toThrow('Circuit Breaker is Open.');

    expect(loggerSpy).toHaveBeenCalledWith(
      'Circuit Breaker rejected concurrent HALF_OPEN request.'
    );

    resolveOperation('success');

    await firstRequest;
  });
});