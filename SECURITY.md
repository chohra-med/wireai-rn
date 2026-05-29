# Security Policy — WireAI

## ⚠️ Critical Warning: Mobile API Keys

**Never put cloud LLM API keys (OpenAI, Anthropic, Gemini) directly into your mobile app code or configuration.**

React Native JavaScript bundles are plain text files that can be easily extracted from any `.apk` or `.ipa` file. If you hardcode a key like `sk-...`, it **will** be stolen, leading to:
- **Financial Loss**: Unauthorized usage billed to your account.
- **Service Disruption**: Your key being revoked or rate-limited.
- **Data Exposure**: Attackers potentially accessing your chat history or user data.

## The Recommended Pattern: Webhook Proxy

For production apps using cloud LLMs, you must use a backend proxy. This ensures your API keys remain secure on your server.

1. **Your App**: Uses the `WebhookAdapter` to send messages to your backend.
2. **Your Backend**: Receives the request, validates the user session, and forwards the request to the cloud LLM using your secret key.
3. **Your Backend**: Returns the LLM response to your app.

### Example Configuration

```tsx
// ✅ SAFE: Your backend endpoint holds the key
const config = {
  provider: "webhook",
  baseUrl: "https://api.yourdomain.com/ai/chat",
  model: "gpt-4o",
};

// ❌ DANGEROUS: Key will be exposed in the mobile bundle
const config = {
  provider: "openai",
  apiKey: "sk-...", 
  baseUrl: "https://api.openai.com",
  model: "gpt-4o",
};
```

## Guardrails in WireAI

In development mode (`__DEV__`), the WireAI SDK will automatically log a security warning to your console if it detects an `apiKey` in your configuration. This is intended to prevent accidental exposure before you ship to production.

## Reporting a Vulnerability

If you discover a security vulnerability within the WireAI SDK, please do not open a public issue. Instead, email us at security@getwireai.com. We will acknowledge your report and provide a timeline for a fix.
