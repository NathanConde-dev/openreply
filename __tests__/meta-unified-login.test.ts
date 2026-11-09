import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { getAuthorizationUrl, exchangeCodeForToken } from "@/lib/meta/oauth";
import {
  discoverInstagramAccountsFromSUAT,
  sendPrivateReply,
  sendDirectMessage,
  subscribeInstagramAccountToWebhooks,
} from "@/lib/meta/client";

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

    it("should use /me/assigned_instagram_accounts as primary discovery method", async () => {
      const userToken = "user-token-123";
      const fetchMock = vi.fn();
      global.fetch = fetchMock;

      // Mock /me/assigned_instagram_accounts response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: "ig-account-123", username: "test_user", name: "Test User" },
            { id: "ig-account-456", username: "test_user2", name: "Test User 2" },
          ],
        }),
      });

      // Mock profile details for first account (profile_picture_url, followers_count)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          profile_picture_url: "https://example.com/pic1.jpg",
          followers_count: 1000,
        }),
      });

      // Mock profile details for second account
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          profile_picture_url: "https://example.com/pic2.jpg",
          followers_count: 2000,
        }),
      });

      const accounts = await discoverInstagramAccountsFromSUAT(userToken);

      expect(accounts).toHaveLength(2);
      expect(accounts[0].instagramId).toBe("ig-account-123");
      expect(accounts[0].username).toBe("test_user");
      expect(accounts[1].instagramId).toBe("ig-account-456");
      
      // Verify /me/assigned_instagram_accounts was called first
      const firstCall = fetchMock.mock.calls[0][0];
      expect(firstCall).toContain("/me/assigned_instagram_accounts");
      expect(firstCall).toContain("fields=id%2Cusername%2Cname");
    });

    it("should paginate /me/assigned_instagram_accounts", async () => {
      const userToken = "user-token-123";
      const fetchMock = vi.fn();
      global.fetch = fetchMock;

      // First page
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: "ig-1", username: "user1", name: "User 1" },
          ],
          paging: {
            next: "https://graph.facebook.com/v25.0/me/assigned_instagram_accounts?after=cursor1",
          },
        }),
      });

      // Second page
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: "ig-2", username: "user2", name: "User 2" },
          ],
        }),
      });

      // Profile details for both accounts
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const accounts = await discoverInstagramAccountsFromSUAT(userToken);

      expect(accounts).toHaveLength(2);
      expect(accounts[0].instagramId).toBe("ig-1");
      expect(accounts[1].instagramId).toBe("ig-2");
    });

    it("should soft-fail profile_picture_url and followers_count", async () => {
      const userToken = "user-token-123";
      const fetchMock = vi.fn();
      global.fetch = fetchMock;

      // Mock /me/assigned_instagram_accounts response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: "ig-account-123", username: "test_user", name: "Test User" },
          ],
        }),
      });

      // Mock profile details failing (e.g., field not accessible)
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: {
            message: "(#100) Tried accessing nonexisting field (profile_picture_url)",
            type: "OAuthException",
            code: 100,
          },
        }),
      });

      const accounts = await discoverInstagramAccountsFromSUAT(userToken);

      expect(accounts).toHaveLength(1);
      expect(accounts[0].instagramId).toBe("ig-account-123");
      expect(accounts[0].username).toBe("test_user");
    });

    it("should use app access token for debug_token when /me/assigned_instagram_accounts fails", async () => {
      const userToken = "user-token-123";
      const fetchMock = vi.fn();
      global.fetch = fetchMock;

      // Mock /me/assigned_instagram_accounts failure
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: "Permission denied" },
        }),
      });

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

      // Mock IG account profile
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
      const debugTokenCall = fetchMock.mock.calls[1][0];
      expect(debugTokenCall).toContain("/debug_token");
      expect(debugTokenCall).toContain("input_token=user-token-123");
      expect(debugTokenCall).toContain("access_token=test-app-id%7Ctest-app-secret");
    });

    it("should fall back to instagram_manage_messages scope when instagram_basic has no target_ids", async () => {
      const userToken = "user-token-123";
      const fetchMock = vi.fn();
      global.fetch = fetchMock;

      // Mock /me/assigned_instagram_accounts failure
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: "No accounts" },
        }),
      });

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

      // Mock IG account profile (base fields) - called by granular_scopes loop
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
      expect(accounts[0].username).toBe("test_user2");
      
      // Verify it used instagram_manage_messages target_ids
      const debugTokenCall = fetchMock.mock.calls[1][0] as string;
      expect(debugTokenCall).toContain("/debug_token");
    });

    it("should fall back to /me/accounts if assigned_instagram_accounts and debug_token fail", async () => {
      const userToken = "user-token-123";
      const fetchMock = vi.fn();
      global.fetch = fetchMock;

      // Mock /me/assigned_instagram_accounts failure
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: "No accounts" },
        }),
      });

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

      const accounts = await discoverInstagramAccountsFromSUAT(userToken);

      expect(accounts).toHaveLength(1);
      expect(accounts[0].username).toBe("fallback_user");
      expect(accounts[0].pageId).toBe("page-789");
      expect(accounts[0].pageAccessToken).toBe("page-token-789");
    });

    it("should discover accounts without Page tokens (SUAT with IG asset only)", async () => {
      const userToken = "suat-token-123";
      const fetchMock = vi.fn();
      global.fetch = fetchMock;

      // Mock /me/assigned_instagram_accounts (primary for SUAT)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: "ig-no-page", username: "no_page_user", name: "No Page User" },
          ],
        }),
      });

      // Mock profile details (soft-fail okay)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const accounts = await discoverInstagramAccountsFromSUAT(userToken);

      expect(accounts).toHaveLength(1);
      expect(accounts[0].username).toBe("no_page_user");
      expect(accounts[0].pageId).toBeNull();
      expect(accounts[0].pageAccessToken).toBeNull();
    });

    it("should NOT fall back to /me (system user ID is not an IG account)", async () => {
      const userToken = "suat-token-123";
      const fetchMock = vi.fn();
      global.fetch = fetchMock;

      // All discovery methods fail
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: "No assigned accounts" },
        }),
      });

      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: "debug_token failed" },
        }),
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [],
        }),
      });

      await expect(
        discoverInstagramAccountsFromSUAT(userToken)
      ).rejects.toThrow("No Instagram Business accounts found");

      // Verify /me was NOT called (no call to /me?fields=id)
      const calls = fetchMock.mock.calls.map((call) => call[0] as string);
      expect(calls.some((url) => url.includes("/me?"))).toBe(false);
    });
  });

  describe("Messaging without Page token (FACEBOOK_LOGIN with SUAT)", () => {
    beforeEach(() => {
      process.env.META_GRAPH_API_VERSION = "v25.0";
    });

    it("should send private reply via /{ig-user-id}/messages when pageId is null", async () => {
      const fetchMock = vi.fn();
      global.fetch = fetchMock;

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          recipient_id: "recipient-123",
          message_id: "msg-123",
        }),
      });

      await sendPrivateReply(
        "suat-token",
        "ig-account-no-page",
        "comment-123",
        "Hello from SUAT",
        "FACEBOOK_LOGIN",
        null // No Page
      );

      const call = fetchMock.mock.calls[0];
      expect(call[0]).toContain("graph.facebook.com");
      expect(call[0]).toContain("/ig-account-no-page/messages");
      expect(call[0]).not.toContain("/page-");
    });

    it("should send direct message via /{ig-user-id}/messages when pageId is null", async () => {
      const fetchMock = vi.fn();
      global.fetch = fetchMock;

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          recipient_id: "user-456",
          message_id: "msg-456",
        }),
      });

      await sendDirectMessage(
        "suat-token",
        "ig-account-no-page",
        "user-456",
        "Direct message from SUAT",
        "FACEBOOK_LOGIN",
        null
      );

      const call = fetchMock.mock.calls[0];
      expect(call[0]).toContain("graph.facebook.com");
      expect(call[0]).toContain("/ig-account-no-page/messages");
    });

    it("should subscribe webhooks via /{ig-user-id}/subscribed_apps when pageId is null", async () => {
      const fetchMock = vi.fn();
      global.fetch = fetchMock;

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
        }),
      });

      await subscribeInstagramAccountToWebhooks(
        "ig-account-no-page",
        null, // No Page
        "suat-token",
        "FACEBOOK_LOGIN"
      );

      const call = fetchMock.mock.calls[0];
      expect(call[0]).toContain("graph.facebook.com");
      expect(call[0]).toContain("/ig-account-no-page/subscribed_apps");
      expect(call[0]).not.toContain("/page-");
    });

    it("should use Page ID when available", async () => {
      const fetchMock = vi.fn();
      global.fetch = fetchMock;

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          recipient_id: "recipient-789",
          message_id: "msg-789",
        }),
      });

      await sendPrivateReply(
        "page-token",
        "ig-account-with-page",
        "comment-789",
        "Hello from Page",
        "FACEBOOK_LOGIN",
        "page-123"
      );

      const call = fetchMock.mock.calls[0];
      expect(call[0]).toContain("graph.facebook.com");
      expect(call[0]).toContain("/page-123/messages");
      expect(call[0]).not.toContain("/ig-account-");
    });
  });
});
