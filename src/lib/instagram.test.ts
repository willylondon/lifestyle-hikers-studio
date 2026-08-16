import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertMetaCanFetchImage, validateInstagramProfile, waitForContainerReady } from './instagram';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Instagram single-account guard', () => {
  it('accepts the configured Professional account', () => {
    expect(() => validateInstagramProfile(
      { userId: '1789', username: 'LifestyleHikers', accountType: 'BUSINESS' },
      { username: 'lifestylehikers', accountId: '1789' },
    )).not.toThrow();
    expect(() => validateInstagramProfile(
      { userId: '1789', username: '@lifestylehikers', accountType: 'MEDIA_CREATOR' },
      { username: 'LifestyleHikers', accountId: '1789' },
    )).not.toThrow();
  });

  it('rejects a different username, numeric account, or personal account', () => {
    expect(() => validateInstagramProfile(
      { userId: '1789', username: 'someone_else', accountType: 'BUSINESS' },
      { username: 'lifestylehikers', accountId: '1789' },
    )).toThrow('Only @lifestylehikers');
    expect(() => validateInstagramProfile(
      { userId: '9999', username: 'lifestylehikers', accountType: 'BUSINESS' },
      { username: 'lifestylehikers', accountId: '1789' },
    )).toThrow('not the configured');
    expect(() => validateInstagramProfile(
      { userId: '1789', username: 'lifestylehikers', accountType: 'PERSONAL' },
      { username: 'lifestylehikers', accountId: '1789' },
    )).toThrow('Business or Creator');
  });
});

describe('Instagram publishing preflight', () => {
  it('requires a reachable HTTPS image', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array([1]), {
      status: 206,
      headers: { 'content-type': 'image/jpeg' },
    })));
    await expect(assertMetaCanFetchImage('https://storage.example/slide.jpg?signature=hidden')).resolves.toBeUndefined();
    await expect(assertMetaCanFetchImage('http://localhost/slide.jpg')).rejects.toThrow('HTTPS media URL');
  });

  it('waits until a Meta container is finished', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ status_code: 'IN_PROGRESS' }))
      .mockResolvedValueOnce(Response.json({ status_code: 'FINISHED' }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(waitForContainerReady('container-1', 'secret-token', { attempts: 2, intervalMs: 0 })).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('surfaces a failed Meta container without exposing request credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      status_code: 'ERROR',
      status: 'Unsupported image format.',
    })));
    await expect(waitForContainerReady('container-1', 'secret-token', { attempts: 1, intervalMs: 0 }))
      .rejects.toThrow('Unsupported image format.');
  });
});
