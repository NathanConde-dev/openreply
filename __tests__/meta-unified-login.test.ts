import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { getAuthorizationUrl, exchangeCodeForToken } from "@/lib/meta/oauth";
import { discoverInstagramAccountsFromSUAT } from "@/lib/meta/client";

describe("Meta Unified Login", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.NEXTAUTH_SECRET = "test-secret-key-at-least-32-chars-long";
    process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    process.env.INSTAGRAM_APP_ID = "test-app-id";
    process.env.INSTAGRAM_APP_SECRET = "test-app-secret";
    process.env.META_GRAPH_API_VERSION = "v25.0";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getAuthorizationUrl", () => {
    it("should generate Instagram Login URL when META_LOGIN_CONFIG_ID is not set", () => {
      delete process.env.META_LOGIN_CONFIG_ID;
      
      const url = getAuthorizationUrl("https://example.com/callback", "test-state");
      
      expect(url).toContain("https://www.instagram.com/oauth/authorize");
      expect(url).toContain("client_id=test-app-id");
      expect(url).toContain("redirect_uri=https%3A%2F%2Fexample.com%2Fcallback");
      expect(url).toContain("scope=instagram_business_basic");
      expect(url).toContain("state=test-state");
    });

    it("should generate Meta Unified Login URL when META_LOGIN_CONFIG_ID is set", () => {
      process.env.META_LOGIN_CONFIG_ID = "test-config-id";
      
      const url = getAuthorizationUrl("https://example.com/callback", "test-state");
      
      expect(url).toContain("https://www.facebook.com/v25.0/dialog/oauth");
      expect(url).toContain("client_id=test-app-id");
      expect(url).toContain("config_id=test-config-id");
      expect(url).toContain("redirect_uri=https%3A%2F%2Fexample.com%2Fcallback");
      expect(url).toContain("response_type=code");
      expect(url).toContain("override_default_response_type=true");
      expect(url).not.toContain("scope=");
    });

    it("should use Instagram Login when META_LOGIN_CONFIG_ID is empty string", () => {
      process.env.META_LOGIN_CONFIG_ID = "";
      
      const url = getAuthorizationUrl("https://example.com/callback", "test-state");
      
      // Empty string is treated as not set, so should use Instagram Login
      expect(url).toContain("https://www.instagram.com/oauth/authorize");
    });
  });

  describe("exchangeCodeForToken", () => {
    it("should use Instagram token endpoint for legacy flow", async () => {
      delete process.env.META_LOGIN_CONFIG_ID;
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          user_id: 12345,
        }),
      });

      const result = await exchangeCodeForToken("test-code", "https://example.com/callback");

      expect(fetch).toHaveBeenCalledWith(
        "https://api.instagram.com/oauth/access_token",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        })
      );
      expect(result.accessToken).toBe("test-token");
      expect(result.userId).toBe("12345");
    });

    it("should use Facebook Graph API endpoint for Unified Login", async () => {
      process.env.META_LOGIN_CONFIG_ID = "test-config-id";
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "test-suat-token",
        }),
      });

      const result = await exchangeCodeForToken("test-code", "https://example.com/callback");

      expect(fetch).toHaveBeenCalledWith(
        "https://graph.facebook.com/v25.0/oauth/access_token",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        })
      );
      expect(result.accessToken).toBe("test-suat-token");
      expect(result.userId).toBe(""); // SUAT doesn't return user_id directly
    });

    it("should handle token exchange errors for Unified Login", async () => {
      process.env.META_LOGIN_CONFIG_ID = "test-config-id";
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error: {
            message: "Invalid authorization code",
          },
        }),
      });

      await expect(
        exchangeCodeForToken("invalid-code", "https://example.com/callback")
      ).rejects.toThrow("Meta Unified Login token exchange failed");
    });
  });

  describe("discoverInstagramAccountsFromSUAT", () => {
    beforeEach(() => {
      process.env.INSTAGRAM_APP_ID = "test-app-id";
      process.env.INSTAGRAM_APP_SECRET = "test-app-secret";
      process.env.META_GRAPH_API_VERSION = "v25.0";
    });

    it("should use app access token for debug_token call", async () => {
      const userToken = "user-token-123";
      const fetchMock = vi.fn();
      global.fetch = fetchMock;

      // Mock debug_token response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            granular_scopes: [
              {
                scope: "instagram_basic",
                target_ids: ["ig-account-123"],
              },
            ],
          },
        }),
      });

      // Mock /me/accounts response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "page-123",
              access_token: "page-token-123",
              instagram_business_account: { id: "ig-account-123" },
            },
          ],
        }),
      });

      // Mock IG account details response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "ig-account-123",
          username: "test_user",
          name: "Test User",
        }),
      });

      await discoverInstagramAccountsFromSUAT(userToken);

      // Verify debug_token was called with app access token
      const debugTokenCall = fetchMock.mock.calls[0][0];
      expect(debugTokenCall).toContain("/debug_token");
      expect(debugTokenCall).toContain("input_token=user-token-123");
      expect(debugTokenCall).toContain("access_token=test-app-id%7Ctest-app-secret");
    });

    it("should fall back to instagram_manage_messages if instagram_basic has no target_ids", async () => {
      const userToken = "user-token-123";
      const fetchMock = vi.fn();
      global.fetch = fetchMock;

      // Mock debug_token response with only instagram_manage_messages
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            granular_scopes: [
              {
                scope: "instagram_basic",
                target_ids: [],
              },
              {
                scope: "instagram_manage_messages",
                target_ids: ["ig-account-456"],
              },
            ],
          },
        }),
      });

      // Mock /me/accounts response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "page-456",
              access_token: "page-token-456",
              instagram_business_account: { id: "ig-account-456" },
            },
          ],
        }),
      });

      // Mock IG account details response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "ig-account-456",
          username: "test_user2",
          name: "Test User 2",
        }),
      });

      const accounts = await discoverInstagramAccountsFromSUAT(userToken);

      expect(accounts).toHaveLength(1);
      expect(accounts[0].instagramId).toBe("ig-account-456");
    });

    it("should fall back to /me/accounts if debug_token fails", async () => {
      const userToken = "user-token-123";
      const fetchMock = vi.fn();
      global.fetch = fetchMock;

      // Mock debug_token failure
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: "Invalid token" },
        }),
      });

      // Mock /me/accounts with embedded IG account
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "page-789",
              access_token: "page-token-789",
              instagram_business_account: {
                id: "ig-account-789",
                username: "fallback_user",
                name: "Fallback User",
              },
            },
          ],
        }),
      });

      // Mock IG account details (called before Page lookup in the loop)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "ig-account-789",
          username: "fallback_user",
          name: "Fallback User",
        }),
      });

      // Mock /me/accounts for Page lookup
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "page-789",
              access_token: "page-token-789",
              instagram_business_account: { id: "ig-account-789" },
            },
          ],
        }),
      });

      const accounts = await discoverInstagramAccountsFromSUAT(userToken);

      expect(accounts).toHaveLength(1);
      expect(accounts[0].username).toBe("fallback_user");
    });

    it("should save account even if Page is not found", async () => {
      const userToken = "user-token-123";
      const fetchMock = vi.fn();
      global.fetch = fetchMock;

      // Mock debug_token response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            granular_scopes: [
              {
                scope: "instagram_basic",
                target_ids: ["ig-account-no-page"],
              },
            ],
          },
        }),
      });

      // Mock IG account details (called before Page lookup)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "ig-account-no-page",
          username: "no_page_user",
          name: "No Page User",
        }),
      });

      // Mock /me/accounts with no matching Page
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [],
        }),
      });

      const accounts = await discoverInstagramAccountsFromSUAT(userToken);

      expect(accounts).toHaveLength(1);
      expect(accounts[0].username).toBe("no_page_user");
      expect(accounts[0].pageId).toBeNull();
      expect(accounts[0].pageAccessToken).toBeNull();
    });
  });
});
