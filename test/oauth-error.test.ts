import { EsDbClient } from '../src/client/dbClient';

// '${provider}' was in single quotes, so the error said "Failed to login
// with ${provider}" literally (v2.1.0).
describe('EsDbClient.loginWithProvider', () => {
  it('names the provider when the login fails', async () => {
    const client = new EsDbClient({ projectId: 'p', endpoint: 'https://appwrite.test/v1' });
    (client as any).account = { createOAuth2Session: jest.fn().mockRejectedValue(new Error('popup blocked')) };
    await expect(client.loginWithProvider('github', 'https://app.test/ok', 'https://app.test/fail')).rejects.toThrow(
      'Failed to login with github: popup blocked'
    );
  });
});
