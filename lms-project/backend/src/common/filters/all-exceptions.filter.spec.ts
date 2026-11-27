import { ArgumentsHost, BadRequestException, HttpException, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  function host(url = '/api/courses') {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const argumentsHost = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url }),
      }),
    } as unknown as ArgumentsHost;
    return { argumentsHost, status, json };
  }

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('copies a string HttpException body', () => {
    const { argumentsHost, status, json } = host('/api/auth/login');
    filter.catch(new HttpException('Invalid email or password', 401), argumentsHost);
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        message: 'Invalid email or password',
        error: 'HttpException',
        path: '/api/auth/login',
      }),
    );
  });

  it('copies message and error from an object HttpException body', () => {
    const { argumentsHost, json } = host();
    filter.catch(new BadRequestException(['title should not be empty']), argumentsHost);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: ['title should not be empty'],
        error: 'Bad Request',
      }),
    );
  });

  it('falls back to the exception name when the body omits message and error', () => {
    const { argumentsHost, json } = host();
    const exception = new HttpException({}, 418);
    filter.catch(exception, argumentsHost);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 418,
        message: exception.message,
        error: exception.name,
      }),
    );
  });

  it('maps unique and foreign-key database errors to 409', () => {
    const unique = host();
    filter.catch(new QueryFailedError('INSERT', [], { code: '23505' } as unknown as Error), unique.argumentsHost);
    expect(unique.status).toHaveBeenCalledWith(409);
    expect(unique.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'A record with the same unique value already exists',
        error: 'Conflict',
      }),
    );

    const foreignKey = host();
    filter.catch(new QueryFailedError('DELETE', [], { code: '23503' } as unknown as Error), foreignKey.argumentsHost);
    expect(foreignKey.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'This record is still referenced by related data' }),
    );
  });

  it('logs unexpected database errors and other failures as 500', () => {
    const database = host();
    filter.catch(new QueryFailedError('SELECT', [], { code: '42P01' } as unknown as Error), database.argumentsHost);
    expect(database.status).toHaveBeenCalledWith(500);
    expect(database.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal server error', error: 'Internal Server Error' }),
    );

    const generic = host();
    filter.catch(new Error('disk full'), generic.argumentsHost);
    expect(generic.status).toHaveBeenCalledWith(500);

    const unknown = host();
    filter.catch('not-an-error', unknown.argumentsHost);
    expect(unknown.status).toHaveBeenCalledWith(500);
    expect(Logger.prototype.error).toHaveBeenCalled();
  });
});
