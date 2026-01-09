# HybridMind v1.1 - User Guide

## 🚀 Getting Started

### Installation
1. Install HybridMind from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=hybridmind.hybridmind)
2. Open VS Code
3. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
4. Type "HybridMind" to see all commands

### First-Time Setup
1. Go to **Settings** → **Extensions** → **HybridMind**
2. Add at least one API key:
   - **Groq** (free tier): [console.groq.com/keys](https://console.groq.com/keys)
   - **Gemini** (free tier): [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
   - **OpenAI** (Pro): [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - **Anthropic** (Pro): [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)

---

## 📋 Free Tier Features

### Available Commands (No License Required)

#### 1. Quick Chat
**Command:** `HybridMind: Quick Chat`
- Ask any coding question
- Select from available models
- Get instant AI responses

**How to use:**
1. Press `Ctrl+Shift+P`
2. Type "HybridMind: Quick Chat"
3. Enter your question
4. Select a model
5. View response in new window

---

#### 2. Explain Code
**Command:** `HybridMind: Explain Code`
- Understand complex code sections
- Get line-by-line explanations

**How to use:**
1. Select code in your editor
2. Right-click → "HybridMind: Explain Code"
3. Choose model
4. Read explanation

---

#### 3. Review Code
**Command:** `HybridMind: Review Code`
- Get professional code reviews
- Identify bugs and improvements

**How to use:**
1. Select code
2. Run "HybridMind: Review Code"
3. Get detailed feedback

---

#### 4. Optimize Code
**Command:** `HybridMind: Optimize Code`
- Improve performance
- Reduce complexity
- Follow best practices

---

#### 5. Generate Tests
**Command:** `HybridMind: Generate Tests`
- Auto-generate unit tests
- Cover edge cases

---

#### 6. Fix Bugs
**Command:** `HybridMind: Fix Bugs`
- Identify and fix bugs
- Get corrected code

---

## ⭐ Pro Tier Features

### Upgrade to Pro ($19/month)
**What you get:**
- 🎯 All premium models (GPT-4, Claude 3.5, Gemini Pro)
- 🔗 Agentic workflows (multi-step automation)
- 💬 Persistent chat window
- 🚀 Up to 4 models per request
- 📚 128k context window (vs 8k free)
- ⚡ 1000 requests/hour (vs 100 free)
- 🛡️ Priority support

**How to upgrade:**
1. Visit [hybridmind.dev/pricing](https://hybridmind.dev/pricing)
2. Click "Get Started"
3. Complete Stripe checkout
4. Receive license key via email
5. Activate in VS Code

---

### Activating Your Pro License

**Step-by-step:**
1. Open VS Code
2. Click the HybridMind icon in status bar (bottom-right)
   - Shows "HybridMind Free" before activation
3. Select "Activate Pro License"
4. Paste your license key (format: `HYBRID-XXXX-XXXX-XXXX-XXXX`)
5. Wait for verification
6. Status bar changes to "⭐ HybridMind Pro"

**Alternative method:**
1. Go to Settings → Extensions → HybridMind
2. Find "License Key" field
3. Paste your key
4. Reload VS Code

---

### Pro Feature: Chat Window

**Command:** `HybridMind: Open Chat Window`

**Features:**
- Persistent sidebar chat
- Multi-turn conversations
- Context retention
- Model switching mid-chat
- Quick action buttons

**How to use:**
1. Press `Ctrl+Shift+P`
2. Type "HybridMind: Open Chat"
3. Chat window opens in sidebar

**Chat Actions:**
- **Explain** - Select code → Click "📖 Explain"
- **Refactor** - Select code → Click "♻️ Refactor"
- **Debug** - Select code → Click "🐛 Debug"
- **Chain** - Run multi-step workflows (see below)

**Tips:**
- Use `Shift+Enter` for multi-line messages
- Click **Copy** to copy AI response
- Click **Insert** to insert code at cursor
- Change models anytime with dropdown

---

### Pro Feature: Agentic Workflows

**What are workflows?**
Automated multi-step AI processes that combine multiple models for complex tasks.

**Available Workflows:**

#### 1. Refactor + Comment + Test
**What it does:**
1. Refactors code (Claude 3.5)
2. Adds documentation (GPT-4)
3. Generates tests (DeepSeek)

**How to use:**
1. Select code
2. Open chat window
3. Click "🔗 Chain" button
4. Select "Refactor + Comment + Test"
5. Watch progress in real-time

**Example:**
```javascript
// Before
function calc(a,b){return a+b}

// After (step 3 complete)
/**
 * Adds two numbers together
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Sum of a and b
 */
function add(a, b) {
  return a + b;
}

// Tests generated:
test('add() should sum two positive numbers', () => {
  expect(add(2, 3)).toBe(5);
});
```

---

#### 2. Debug + Fix + Verify
**Steps:**
1. Analyzes code for bugs (GPT-4)
2. Applies fixes (Claude 3.5)
3. Generates verification tests (DeepSeek)

**Use case:** Found a bug but not sure how to fix it

---

#### 3. Architecture Review
**Steps:**
1. Structure analysis (GPT-4)
2. Security audit (Claude 3.5)
3. Performance review (Gemini Pro)
4. Scalability assessment (DeepSeek)

**Use case:** Before deploying to production

---

#### 4. Security Audit + Fix
**Steps:**
1. Security scan (Claude 3.5)
2. Apply security fixes (GPT-4)

**Use case:** Harden code against vulnerabilities

---

#### 5. Performance Optimization
**Steps:**
1. Performance profiling (Gemini Pro)
2. Apply optimizations (DeepSeek)
3. Generate benchmarks (Groq)

**Use case:** Speed up slow code

---

#### 6. Code Migration
**Steps:**
1. Analyze original code (GPT-4)
2. Translate to target language (Claude 3.5)
3. Generate tests (DeepSeek)

**Use case:** Migrate Python to JavaScript

---

#### 7. API Documentation
**Steps:**
1. API analysis (GPT-4)
2. Generate comprehensive docs (Claude 3.5)

**Use case:** Document your REST API

---

#### 8. Code Review Pro
**Steps:**
1. Code quality review (Claude 3.5)
2. Logic & correctness (GPT-4)
3. Best practices check (Gemini Pro)

**Use case:** Pre-merge code review

---

### Pro Feature: Multi-Model Requests

**Select multiple models for one task:**
1. Run any command
2. When prompted for model, hold `Ctrl` and select multiple (up to 4)
3. Get responses from all models
4. Compare outputs side-by-side

**Use cases:**
- Get multiple perspectives on architecture
- Compare refactoring approaches
- Consensus-based bug detection

**Example:**
```
Prompt: "Review this authentication code"

GPT-4 says: "Add rate limiting to prevent brute force"
Claude says: "Use bcrypt for password hashing"
Gemini says: "Add 2FA support"
DeepSeek says: "Implement session timeout"

→ You get 4 expert opinions!
```

---

## 🎨 Customization

### Settings
Access via **Settings** → **Extensions** → **HybridMind**

**Available settings:**
- `hybridmind.licenseKey` - Your Pro license key
- `hybridmind.openaiApiKey` - OpenAI API key
- `hybridmind.anthropicApiKey` - Anthropic API key
- `hybridmind.groqApiKey` - Groq API key
- `hybridmind.geminiApiKey` - Google Gemini API key
- `hybridmind.deepseekApiKey` - DeepSeek API key
- `hybridmind.qwenApiKey` - Qwen API key

---

## 🔧 Troubleshooting

### "No models available"
**Solution:** Add at least one API key in settings

### "Rate limit exceeded"
**Solution:**
- Free tier: Wait for hourly reset (100 req/hour)
- Upgrade to Pro for 1000 req/hour

### "Chat window requires Pro"
**Solution:** Upgrade at [hybridmind.dev/pricing](https://hybridmind.dev/pricing)

### "License verification failed"
**Possible causes:**
1. Invalid license key (check email)
2. Expired subscription (renew via Stripe)
3. Network issues (check internet)

**Solution:**
1. Go to Settings → HybridMind
2. Remove old license key
3. Paste new key from email
4. Reload VS Code

### "Server not running"
**Solution:**
1. Reload VS Code window
2. Check VS Code Output panel → "HybridMind"
3. Report issue if persists

---

## 📊 Understanding Usage

### Checking Your Usage
1. Click status bar item "HybridMind Pro"
2. Select "View License Status"
3. See remaining requests and features

**What counts as a request:**
- Each AI call (Explain, Review, etc.)
- Each chat message sent
- Each workflow step

**Free tier limits:**
- 100 requests/hour
- 500 requests/day

**Pro tier limits:**
- 1000 requests/hour
- 10,000 requests/day

---

## 💡 Pro Tips

### 1. Use workflows for repetitive tasks
Instead of manually running Refactor → Comment → Test, use the workflow!

### 2. Switch models based on task
- **GPT-4**: Complex reasoning, architecture
- **Claude 3.5**: Code quality, refactoring
- **Gemini Pro**: Large contexts, performance
- **DeepSeek**: Fast code generation, tests
- **Groq**: Lightning-fast simple tasks

### 3. Keep chat window open
Pin it to sidebar for quick access

### 4. Combine with Copilot
Use Copilot for autocomplete, HybridMind for complex reasoning

### 5. Experiment with context
More code = better results (up to 128k tokens for Pro)

---

## 🛡️ Privacy & Security

**Your code stays private:**
- Not stored on our servers
- Only sent to AI providers you configured
- No telemetry or tracking

**API keys:**
- Stored locally in VS Code settings
- Encrypted by VS Code
- Never sent to HybridMind servers

**License verification:**
- Only sends license key (no code)
- Cached for 1 hour to reduce calls

---

## 📞 Support

### Free Tier
- GitHub Issues: [github.com/itheroservices-hub/hybridmind/issues](https://github.com/itheroservices-hub/hybridmind/issues)
- Community Discord: [discord.gg/hybridmind](https://discord.gg/hybridmind)

### Pro Tier
- Priority email: support@hybridmind.dev
- Response time: <24 hours
- Direct DM on Twitter: [@hybridmind](https://twitter.com/hybridmind)

---

## 🎓 Video Tutorials

### Getting Started (3 min)
[Watch on YouTube →](#)

### Chat Window Deep Dive (5 min)
[Watch on YouTube →](#)

### Agentic Workflows Masterclass (10 min)
[Watch on YouTube →](#)

---

## 🚀 What's Next?

**Upcoming in v1.2:**
- Advanced debugging workflows
- Code generation from diagrams
- Custom workflow builder

**Upcoming in v2.0:**
- JetBrains support
- Team collaboration
- Self-hosted option

---

## 🤝 Community

Join thousands of developers using HybridMind:
- Twitter: [@hybridmind](https://twitter.com/hybridmind)
- Discord: [discord.gg/hybridmind](https://discord.gg/hybridmind)
- GitHub: [github.com/itheroservices-hub/hybridmind](https://github.com/itheroservices-hub/hybridmind)

---

## 📜 License

HybridMind Extension: MIT License
HybridMind Pro: Commercial License (requires subscription)

---

**Questions?** Email support@hybridmind.dev

**Built with ❤️ for developers, by developers**
