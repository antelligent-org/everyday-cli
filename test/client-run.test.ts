import { EsClient } from '../src/client';

const ok = (json: unknown) => ({ ok: true, status: 200, json: async () => ({ result: { data: { json } } }) });
const node = (id: string, data: Record<string, unknown>) => ({ id, type: 'text_output', data: { label: id, ...data } });

describe('EsClient.run', () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;
  beforeEach(() => {
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });
  afterAll(() => {
    (global as any).fetch = realFetch;
  });

  const client = () => new EsClient({ apiKey: 'k', slug: 's', baseUrl: 'https://es.test' });

  it('returns the hisId and complete for a finished run', async () => {
    fetchMock.mockResolvedValue(ok({ nodes: [node('Out', { value: 'done' })], complete: true, hisId: 'h1' }));
    const res = await client().run('f1', { Name: 'x' });
    expect(res).toMatchObject({ success: true, complete: true, hisId: 'h1' });
    expect(res.data).toEqual([{ label: 'Out', value: 'done' }]);
  });

  it('is not a success when the run stops at an approval', async () => {
    fetchMock.mockResolvedValue(
      ok({
        nodes: [],
        complete: false,
        hisId: 'h2',
        checkoutRequiredFor: 'u1',
        dependenciesNode: node('Approve invoice', { checkoutRequired: true }),
      })
    );
    const res = await client().run('f1', {});
    expect(res).toMatchObject({ success: false, complete: false, hisId: 'h2' });
    expect(res.error).toBe('The run is waiting for approval at "Approve invoice".');
  });

  it('names the failed step when the run stopped on one', async () => {
    fetchMock.mockResolvedValue(ok({ nodes: [node('Call', { value: 'error: Request failed with status code 422' })], complete: false, hisId: 'h3' }));
    const res = await client().run('f1', {});
    expect(res.error).toBe('The run stopped at "Call": error: Request failed with status code 422');
  });

  it("keeps the server's error message", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { json: { message: 'Insufficient AI credits.', data: { code: 'FORBIDDEN' } } } }),
    });
    const res = await client().run('f1', {});
    expect(res).toMatchObject({ success: false, status: 403, error: 'Insufficient AI credits.' });
  });

  it('falls back to the status when the body says nothing', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error('not json'); } });
    expect((await client().run('f1', {})).error).toBe('API request failed with status 502');
  });

  it('gives up after the timeout', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        })
    );
    const res = await client().run('f1', {}, { timeoutMs: 20 });
    expect(res).toMatchObject({ success: false, error: 'No answer within 20 ms' });
  });

  it('can be cancelled with a signal', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        })
    );
    const controller = new AbortController();
    const pending = client().run('f1', {}, { signal: controller.signal });
    controller.abort();
    expect(await pending).toMatchObject({ success: false, error: 'The request was cancelled' });
  });
});

describe('EsClient.findFlowByName', () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;
  beforeEach(() => {
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });
  afterAll(() => {
    (global as any).fetch = realFetch;
  });
  const client = () => new EsClient({ apiKey: 'k', slug: 'team-a', baseUrl: 'https://es.test' });
  const page = (flows: unknown[]) => ({ ok: true, status: 200, json: async () => ({ result: { data: { json: flows } } }) });

  it('finds a flow by exact name, ignoring case and spaces', async () => {
    fetchMock.mockResolvedValue(page([{ id: 'a', name: 'Create proposal v2' }, { id: 'b', name: 'Create Proposal' }]));
    expect(await client().findFlowByName('  create proposal ')).toEqual({ id: 'b', name: 'Create Proposal' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('https://es.test/api/trpc/flows.get?input=');
    expect(JSON.parse(decodeURIComponent(url.split('input=')[1]))).toEqual({ json: { limit: 100, offset: 0, slug: 'team-a' } });
    expect(init.headers.Authorization).toBe('Bearer k');
  });

  it('pages until it finds it', async () => {
    const full = Array.from({ length: 100 }, (_, i) => ({ id: `x${i}`, name: `Flow ${i}` }));
    fetchMock.mockResolvedValueOnce(page(full)).mockResolvedValueOnce(page([{ id: 'z', name: 'Late' }]));
    expect(await client().findFlowByName('Late')).toEqual({ id: 'z', name: 'Late' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null when no flow has that name', async () => {
    fetchMock.mockResolvedValue(page([{ id: 'a', name: 'Other' }]));
    expect(await client().findFlowByName('Missing')).toBeNull();
  });

  it("throws the server's message when the list can't be read", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: { json: { message: 'Invalid API key' } } }) });
    await expect(client().findFlowByName('x')).rejects.toThrow('Invalid API key');
  });
});
