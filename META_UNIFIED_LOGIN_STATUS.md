# Meta Unified Login Implementation Status

## ✅ Implemented & Tested (Unit Tests)

### Core OAuth Flow
- ✅ Authorization URL generation for both flows (Instagram Login vs Facebook Login)
- ✅ Token exchange for both flows (api.instagram.com vs graph.facebook.com)
- ✅ State creation and verification
- ✅ Encryption/decryption of tokens and credentials

### Account Discovery
- ✅ debug_token API call to get granular_scopes
- ✅ Parsing instagram_basic scope for target_ids
- ✅ Page lookup to find Instagram Business Account association
- ✅ Page access token retrieval

### Database Schema
- ✅ AuthProvider enum (INSTAGRAM_LOGIN | FACEBOOK_LOGIN)
- ✅ authProvider column with default INSTAGRAM_LOGIN
- ✅ pageId and pageAccessToken columns (encrypted)
- ✅ Migration created and validated

### API Routing
- ✅ getApiConfig() helper routes to correct base URL
- ✅ All client functions accept authProvider parameter
- ✅ Default to INSTAGRAM_LOGIN for backward compatibility
- ✅ Messaging endpoints route to /{page-id}/messages for Facebook Login
- ✅ Webhook subscription routes to /{page-id}/subscribed_apps for Facebook Login

### Token Management
- ✅ SUAT tokens stored with tokenExpiresAt = null
- ✅ Token refresh job filters `tokenExpiresAt: { not: null }`
- ✅ Cron refresh endpoint also filters correctly
- ✅ SUAT tokens automatically excluded from refresh

## ⚠️ Implemented but NOT Tested with Real Account

These work in code but require a live Meta Unified Login configuration to verify:

### Connection Flow
- ⚠️ OAuth redirect with config_id
- ⚠️ Account discovery via debug_token → Pages → Instagram account
- ⚠️ Page access token storage and encryption
- ⚠️ Webhook subscription with Page token

### Messaging API (graph.facebook.com)
- ⚠️ sendPrivateReply() via /{page-id}/messages
- ⚠️ sendPrivateReplyWithButton() via /{page-id}/messages
- ⚠️ sendDirectMessage() via /{page-id}/messages
- ⚠️ sendDirectMessageWithButton() via /{page-id}/messages
- ⚠️ sendPrivateReplyWithLinkButton() via /{page-id}/messages
- ⚠️ sendDirectMessageWithLinkButton() via /{page-id}/messages

### Read Operations (graph.facebook.com)
- ⚠️ sendCommentReply() via /{comment-id}/replies
- ⚠️ getUserFollowStatus() via /{recipient-id}
- ⚠️ getUserUsername() via /{recipient-id}
- ⚠️ getUserInfo() via /me
- ⚠️ getMediaComments() via /{media-id}/comments
- ⚠️ getRecentMediaComments() with pagination
- ⚠️ getConversations() via /{ig-id}/conversations
- ⚠️ getConversationMessages() via /{conversation-id}
- ⚠️ getUserMedia() via /me/media
- ⚠️ getAllUserMedia() with pagination
- ⚠️ getMediaInsights() via /{media-id}/insights
- ⚠️ getFollowerCountSeries() via /{ig-id}/insights

### Downstream Features
- ⚠️ Webhook handling for accounts with Facebook Login
- ⚠️ Comment-to-DM campaigns
- ⚠️ DM keyword triggers
- ⚠️ Follow-gating logic
- ⚠️ Button postback handling
- ⚠️ Conversation recovery
- ⚠️ Follower snapshot job

## 🔬 Testing Strategy

### What Was Tested
1. **Unit tests**: OAuth flows, URL generation, token exchange, routing logic
2. **TypeScript**: All new code typechecks correctly
3. **Build**: Next.js build passes
4. **Lint**: No new lint errors
5. **Database**: Migration syntax validated

### What Needs Live Testing
1. **Connect a real account** via Unified Login configuration
2. **Send a test DM** to verify /{page-id}/messages endpoint
3. **Post a comment** to verify comment webhooks work
4. **Check follow status** on a real user
5. **Fetch media insights** to verify graph.facebook.com routing
6. **Run follower snapshot** to verify insights API

## 📝 Known Assumptions

1. **Page association required**: Facebook Login requires a Facebook Page linked to the Instagram Business Account. The code assumes this exists and is granted in the configuration.

2. **Page access token works everywhere**: We assume the Page access token works for all Instagram Graph API operations on graph.facebook.com. Meta docs suggest this is correct, but real testing will confirm.

3. **Webhook delivery**: We assume webhooks for Facebook Login accounts are delivered the same way (entry.id = instagramId). Needs verification.

4. **Endpoint parity**: We assume graph.facebook.com supports all the same endpoints as graph.instagram.com with just a host change. If Meta added/removed/changed any endpoints, those will surface in live testing.

## 🚀 Deployment Checklist

Before declaring this "production ready":

- [ ] Create test Meta app with Unified Login configuration
- [ ] Configure all required permissions in configuration
- [ ] Set META_LOGIN_CONFIG_ID in staging environment
- [ ] Connect one Instagram account via new flow
- [ ] Verify account appears in dashboard
- [ ] Create test campaign with keyword trigger
- [ ] Post comment from different account with keyword
- [ ] Confirm private reply arrives
- [ ] Tap button in DM
- [ ] Confirm reveal message arrives
- [ ] Check follow-gating if enabled
- [ ] Verify webhook events logged correctly
- [ ] Run follower snapshot manually
- [ ] Check insights data loads in dashboard
- [ ] Monitor for 24 hours with no errors
- [ ] Compare behavior with Instagram Login account side-by-side

## 📚 Documentation

- ✅ RAILWAY.md updated with Unified Login setup guide
- ✅ .env.example documents META_LOGIN_CONFIG_ID
- ✅ Code comments explain authProvider routing
- ⚠️ English docs (docs/setup.md) not yet updated
- ⚠️ No video walkthrough yet

## 🐛 Risk Areas

1. **Webhook matching**: If webhook entry.id differs for Facebook Login accounts, webhook processing will fail. Needs verification.

2. **Permission scopes**: Configuration permissions may not exactly match Instagram Login scopes. May need adjustment.

3. **Rate limits**: Facebook Login might have different rate limits than Instagram Login.

4. **Token refresh**: SUAT "never expires" needs confirmation - if it does expire, we have no refresh logic.

5. **Conversation ownership**: The "thread owner" issue (PR description) may behave differently with Page tokens.
