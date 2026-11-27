import { paginate } from './pagination';

describe('paginate', () => {
  function queryBuilder(rows: unknown[], total: number) {
    return {
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([rows, total]),
    };
  }

  it('uses page 1 and limit 10 when the caller omits both', async () => {
    const qb = queryBuilder([{ id: 'a' }], 1);
    const page = await paginate(qb as never);
    expect(qb.skip).toHaveBeenCalledWith(0);
    expect(qb.take).toHaveBeenCalledWith(10);
    expect(page.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
  });

  it('clamps the page to at least 1 and the limit to the 1..100 range', async () => {
    const low = queryBuilder([], 0);
    await paginate(low as never, 0, 0);
    expect(low.skip).toHaveBeenCalledWith(0);
    expect(low.take).toHaveBeenCalledWith(1);
    expect((await paginate(low as never, -4, 0)).meta.totalPages).toBe(0);

    const high = queryBuilder([], 250);
    const page = await paginate(high as never, 3, 500);
    expect(high.skip).toHaveBeenCalledWith(200);
    expect(high.take).toHaveBeenCalledWith(100);
    expect(page.meta).toEqual({ page: 3, limit: 100, total: 250, totalPages: 3 });
  });
});
