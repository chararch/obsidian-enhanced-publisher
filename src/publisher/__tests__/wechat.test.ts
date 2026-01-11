import { WechatPublisher } from '../wechat';
import { App, requestUrl, Notice, TFile } from 'obsidian';

// Mock dependencies
const mockApp = new App();

const mockPlugin = {
    app: mockApp,
    settings: {
        wechatAppId: 'mock-app-id',
        wechatAppSecret: 'mock-app-secret',
    }
} as any;

describe('WechatPublisher', () => {
    let publisher: WechatPublisher;

    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        publisher = new WechatPublisher(mockApp, mockPlugin);
        const logger = (publisher as any).logger; // 或者通过 Logger.getInstance(mockApp) 获取
        logger.setDebugMode(true);
    });

    describe('getAccessToken', () => {
        test('should return token from cache if valid', async () => {
            const token = 'cached-token';
            const expireTime = Date.now() + 10000;
            localStorage.setItem('wechat_token_cache', JSON.stringify({ token, expireTime }));

            const result = await publisher.getAccessToken();
            expect(result).toBe(token);
            expect(requestUrl).not.toHaveBeenCalled();
        });

        test('should fetch new token if cache expired', async () => {
            const mockResponse = {
                json: {
                    access_token: 'new-token',
                    expires_in: 7200
                }
            };
            (requestUrl as jest.Mock).mockResolvedValue(mockResponse);

            const result = await publisher.getAccessToken();
            expect(result).toBe('new-token');
            expect(requestUrl).toHaveBeenCalledWith(expect.objectContaining({
                url: 'https://api.weixin.qq.com/cgi-bin/stable_token'
            }));
        });
    });

    describe('Retry Logic (requestWithTokenRetry)', () => {
        test('should retry when encountering 40001 error', async () => {
            // Mock initial token fetch
            const getAccessTokenSpy = jest.spyOn(publisher, 'getAccessToken');
            getAccessTokenSpy.mockResolvedValueOnce('old-token'); // First call
            getAccessTokenSpy.mockResolvedValueOnce('new-token'); // Retry call (forceRefresh=true)

            // Mock API responses
            (requestUrl as jest.Mock)
                .mockResolvedValueOnce({ // First request fails with 40001
                    json: { errcode: 40001, errmsg: 'invalid credential' }
                })
                .mockResolvedValueOnce({ // Retry request succeeds
                    json: { errcode: 0, item: [], total_count: 5 }
                });

            const result = await publisher.getWechatMaterials();

            expect(result.totalCount).toBe(5);

            // Verify execution flow
            // 1. requestWithTokenRetry calls getAccessToken() -> 'old-token'
            // 2. requestUrl called with 'old-token' -> returns 40001
            // 3. requestWithTokenRetry catches 40001, calls getAccessToken(true) -> 'new-token'
            // 4. requestUrl called with 'new-token' -> returns success

            expect(getAccessTokenSpy).toHaveBeenCalledTimes(2);
            expect(getAccessTokenSpy).toHaveBeenLastCalledWith(true);
            expect(requestUrl).toHaveBeenCalledTimes(2);
        });

        test('should handle other errors using handleWechatError', async () => {
            jest.spyOn(publisher, 'getAccessToken').mockResolvedValue('valid-token');

            (requestUrl as jest.Mock).mockResolvedValue({
                json: { errcode: 40013, errmsg: 'invalid appid' }
            });

            const result = await publisher.getWechatMaterials();

            expect(result.items).toEqual([]);
            // Should have called handleWechatError (which logs an error)
            // We can check if Notice was instantiated if we want, but logging is safer to check via spy if we had one
        });
    });
});


// Integration Tests (Real API)
// Run with: WECHAT_APP_ID=your_id WECHAT_APP_SECRET=your_secret npm test -- -t "Integration"
// IMPORTANT: These tests make real network requests!
import fetch from 'node-fetch';

const appId = process.env.WECHAT_APP_ID;
const appSecret = process.env.WECHAT_APP_SECRET;

if (appId && appSecret) {
    describe('Integration Tests (Real API)', () => {
        let publisher: WechatPublisher;
        // In-memory vault storage to simulate file persistence for metadata
        const mockVaultStorage: Record<string, string> = {};

        // Shim for requestUrl using node-fetch
        const realRequestUrl = async (options: any) => {
            const { url, method, body, headers } = options;
            const response = await fetch(url, {
                method: method || 'GET',
                body: body,
                headers: headers
            });
            const json = await response.json().catch(() => ({}));
            return {
                status: response.status,
                json: json,
                text: () => JSON.stringify(json)
            };
        };

        beforeAll(() => {
            mockPlugin.settings.wechatAppId = appId;
            mockPlugin.settings.wechatAppSecret = appSecret;
            publisher = new WechatPublisher(mockApp, mockPlugin);
            const logger = (publisher as any).logger;
            logger.setDebugMode(true);

            // Override requestUrl mock for this suite
            (requestUrl as jest.Mock).mockImplementation(realRequestUrl);

            // Setup in-memory vault mocks to simulate file system
            const vault = mockPlugin.app.vault;

            vault.getAbstractFileByPath.mockImplementation((path: string) => {
                if (mockVaultStorage[path]) {
                    const file = new TFile();
                    file.path = path;
                    // Important: Mock file parent for metadata resolution
                    file.parent = { path: '/' } as any;
                    // Mock basename
                    const parts = path.split('/');
                    const filename = parts[parts.length - 1];
                    file.basename = filename.replace(/\.[^/.]+$/, "");
                    return file;
                }
                return null;
            });

            vault.read.mockImplementation(async (file: TFile) => {
                return mockVaultStorage[file.path] || '';
            });

            vault.create.mockImplementation(async (path: string, data: string) => {
                mockVaultStorage[path] = data;
                const file = new TFile();
                file.path = path;
                return file;
            });

            vault.adapter.write.mockImplementation(async (path: string, data: string) => {
                mockVaultStorage[path] = data;
            });

            vault.adapter.exists.mockImplementation(async (path: string) => {
                return !!mockVaultStorage[path];
            });

            vault.createFolder.mockImplementation(async (path: string) => {
                // No-op for mock
            });
        });

        afterAll(() => {
            jest.restoreAllMocks();
        });

        test('should successfully upload image, publish draft, and update it', async () => {
            // 1. Create a dummy image buffer (Valid small JPEG)
            const base64Image = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAKAAoDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RCYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9U6KKKAP/2Q==';
            const imageBuffer = Buffer.from(base64Image, 'base64');
            const fileName = `test_image_${Date.now()}.jpg`;

            // 2. Upload Image
            console.log(`Uploading image: ${fileName}...`);
            const arrayBuffer = imageBuffer.buffer.slice(imageBuffer.byteOffset, imageBuffer.byteOffset + imageBuffer.byteLength);
            const mediaId = await publisher.uploadImageToWechat(arrayBuffer, fileName);
            expect(mediaId).toBeTruthy();
            console.log(`Image uploaded, Media ID: ${mediaId}`);

            // 3. Publish New Draft
            const title = `Integration Test ${Date.now()}`;
            const content = `<p>This is an automated test draft.</p>`;

            // Mock TFile for metadata
            const file = new TFile();
            file.path = 'integration_test.md';
            file.basename = 'integration_test';
            file.parent = { path: '/' } as any; // Ensure it has a parent path

            console.log(`Publishing new draft: ${title}...`);
            let result = await publisher.publishToWechat(title, content, mediaId, file);
            expect(result).toBe(true);
            console.log('Draft published successfully!');

            // 4. Update the Draft
            // The metadata should now have the media_id from the first publish (persisted in mockVaultStorage).
            // We simulate an update by changing title and content.

            const updatedTitle = `${title} (Updated)`;
            const updatedContent = content + '<p>Updated content.</p>';

            console.log(`Updating draft: ${updatedTitle}...`);
            result = await publisher.publishToWechat(updatedTitle, updatedContent, mediaId, file);

            expect(result).toBe(true);
            console.log('Draft updated successfully!');

        }, 60000); // 60s timeout for network requests
    });
} else {
    describe('Integration Tests', () => {
        test('skipped: WECHAT_APP_ID and WECHAT_APP_SECRET env vars not set', () => {
            console.warn('Skipping integration tests requiring real credentials.');
        });
    });
}
