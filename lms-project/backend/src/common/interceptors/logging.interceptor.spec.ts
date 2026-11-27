import { ExecutionContext, HttpException, Logger } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  const interceptor = new LoggingInterceptor();
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ method: 'POST', originalUrl: '/api/auth/login' }),
      getResponse: () => ({ statusCode: 200 }),
    }),
  } as unknown as ExecutionContext;

  afterEach(() => jest.restoreAllMocks());

  it('logs the status and duration of a successful request', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    await expect(lastValueFrom(interceptor.intercept(context, { handle: () => of({ ok: true }) }))).resolves.toEqual({
      ok: true,
    });
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^POST \/api\/auth\/login 200 \d+ms$/));
  });

  it('logs an HttpException status and rethrows it', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const error = new HttpException('Invalid email or password', 401);
    await expect(
      lastValueFrom(interceptor.intercept(context, { handle: () => throwError(() => error) })),
    ).rejects.toBe(error);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^POST \/api\/auth\/login 401 \d+ms$/));
  });

  it('logs 500 when the failure is not an HttpException', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const error = new Error('connection reset');
    await expect(
      lastValueFrom(interceptor.intercept(context, { handle: () => throwError(() => error) })),
    ).rejects.toBe(error);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(' 500 '));
  });
});
