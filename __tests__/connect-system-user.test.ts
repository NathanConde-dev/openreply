import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock dependencies
const mockAuth = vi.fn();
const mockPrisma = {
  workspaceMember: {
    findFirst: vi.fn(),
  },
  instagramAccount: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
  operationalEvent: {
    create: vi.fn(() => ({
      catch: vi.fn(),
    })),
  },
};
const mockCanConnectInstagramAccount = vi.fn();
const mockDiscoverInstagramAccountsFromSUAT = vi.fn();
const mockSubscribeInstagramAccountToWebhooks = vi.fn();
const mockDebugToken = vi.fn();
const mockEncryptToken = vi.fn();
const mockCanManageWorkspace = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/instagram-accounts", () => ({
  canConnectInstagramAccount: mockCanConnectInstagramAccount,
}));
vi.mock("@/lib/meta/client", () => ({
  discoverInstagramAccountsFromSUAT: mockDiscoverInstagramAccountsFromSUAT,
  subscribeInstagramAccountToWebhooks: mockSubscribeInstagramAccountToWebhooks,
  debugToken: mockDebugToken,
}));
vi.mock("@/lib/meta/oauth", () => ({ encryptToken: mockEncryptToken }));
vi.mock("@/lib/workspace-access", () => ({
  canManageWorkspace: mockCanManageWorkspace,
}));
vi.mock("@/lib/env", () => ({
  requireEnv: (key: string) => {
    if (key === "INSTAGRAM_APP_ID") return "test-app-id";
    if (key === "INSTAGRAM_APP_SECRET") return "test-app-secret";
    return "";
  },
}));

describe("POST /api/instagram/connect-system-user", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { POST } = await import(
      "@/app/api/instagram/connect-system-user/route"
    );
    const request = new Request("http://localhost:3000/api/instagram/connect-system-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: "test-token" }),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Não autenticado");
  });

  it("should return 403 if user is not admin/owner", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-123" } });
    mockPrisma.workspaceMember.findFirst.mockResolvedValue({
      workspaceId: "workspace-123",
      userId: "user-123",
      role: "MEMBER",
    });
    mockCanManageWorkspace.mockReturnValue(false);

    const { POST } = await import(
      "@/app/api/instagram/connect-system-user/route"
    );
    const request = new Request("http://localhost:3000/api/instagram/connect-system-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: "test-token" }),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Acesso negado");
  });

  it("should return 400 if token is invalid", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-123" } });
    mockPrisma.workspaceMember.findFirst.mockResolvedValue({
      workspaceId: "workspace-123",
      userId: "user-123",
      role: "OWNER",
    });
    mockCanManageWorkspace.mockReturnValue(true);
    mockDebugToken.mockResolvedValue({
      data: { is_valid: false },
    });

    const { POST } = await import(
      "@/app/api/instagram/connect-system-user/route"
    );
    const request = new Request("http://localhost:3000/api/instagram/connect-system-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: "invalid-token" }),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("inválido");
  });

  it("should return 400 if no Instagram accounts found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-123" } });
    mockPrisma.workspaceMember.findFirst.mockResolvedValue({
      workspaceId: "workspace-123",
      userId: "user-123",
      role: "OWNER",
    });
    mockCanManageWorkspace.mockReturnValue(true);
    mockDebugToken.mockResolvedValue({
      data: { is_valid: true, app_id: "test-app-id", type: "SYSTEM_USER" },
    });
    mockDiscoverInstagramAccountsFromSUAT.mockResolvedValue([]);

    const { POST } = await import(
      "@/app/api/instagram/connect-system-user/route"
    );
    const request = new Request("http://localhost:3000/api/instagram/connect-system-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: "valid-token" }),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("não tem contas do Instagram");
    expect(mockPrisma.instagramAccount.create).not.toHaveBeenCalled();
  });

  it("should connect account and subscribe webhooks on success", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-123" } });
    mockPrisma.workspaceMember.findFirst.mockResolvedValue({
      workspaceId: "workspace-123",
      userId: "user-123",
      role: "OWNER",
    });
    mockCanManageWorkspace.mockReturnValue(true);
    mockDebugToken.mockResolvedValue({
      data: { is_valid: true, app_id: "test-app-id", type: "SYSTEM_USER" },
    });
    mockDiscoverInstagramAccountsFromSUAT.mockResolvedValue([
      {
        instagramId: "ig-123",
        username: "test_user",
        name: "Test User",
        pageId: null,
        pageAccessToken: null,
      },
    ]);
    mockCanConnectInstagramAccount.mockResolvedValue({ allowed: true });
    mockEncryptToken.mockReturnValue("encrypted-token");
    mockSubscribeInstagramAccountToWebhooks.mockResolvedValue({ success: true });
    mockPrisma.instagramAccount.findUnique.mockResolvedValue(null);
    mockPrisma.instagramAccount.create.mockResolvedValue({});

    const { POST } = await import(
      "@/app/api/instagram/connect-system-user/route"
    );
    const request = new Request("http://localhost:3000/api/instagram/connect-system-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: "valid-token" }),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.username).toBe("test_user");
    expect(data.instagramId).toBe("ig-123");
    expect(mockPrisma.instagramAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        username: "test_user",
        instagramId: "ig-123",
        authProvider: "FACEBOOK_LOGIN",
        webhookSubscribed: true,
      }),
    });
    expect(mockSubscribeInstagramAccountToWebhooks).toHaveBeenCalledWith(
      "ig-123",
      null,
      "valid-token",
      "FACEBOOK_LOGIN"
    );
  });

  it("should not log token in responses or errors", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-123" } });
    mockPrisma.workspaceMember.findFirst.mockResolvedValue({
      workspaceId: "workspace-123",
      userId: "user-123",
      role: "OWNER",
    });
    mockCanManageWorkspace.mockReturnValue(true);
    mockDebugToken.mockRejectedValue(new Error("API error"));

    const { POST } = await import(
      "@/app/api/instagram/connect-system-user/route"
    );
    const request = new Request("http://localhost:3000/api/instagram/connect-system-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: "secret-token-12345" }),
    });

    const response = await POST(request as any);
    const data = await response.json();

    // Check that response doesn't contain the token
    const responseText = JSON.stringify(data);
    expect(responseText).not.toContain("secret-token-12345");
  });
});
