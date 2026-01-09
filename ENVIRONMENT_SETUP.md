# HybridMind v1.1 - Environment Setup Guide

## 🚀 Quick Start (5 minutes)

### Prerequisites
- Node.js 18+ installed
- VS Code 1.85+ installed
- Git installed
- Stripe account (for payment testing)
- At least one AI provider API key

---

## 📦 Installation Steps

### 1. Backend Server Setup

```bash
# Navigate to backend
cd hybridmind-backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your API keys
nano .env
```

**Required environment variables:**
```bash
# AI Provider API Keys (add at least one)
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-api...
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AI...
DEEPSEEK_API_KEY=sk-...
QWEN_API_KEY=sk-...
MISTRAL_API_KEY=...
XAI_API_KEY=xai-...

# Server Configuration
PORT=3000
NODE_ENV=development
```

**Start the server:**
```bash
npm start
# Server runs on http://localhost:3000
```

---

### 2. Landing Page Setup

```bash
# Navigate to landing page
cd Hybrid-Mind-landingpage

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with Stripe credentials
nano .env
```

**Required environment variables:**
```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_51...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...

# Optional: LemonSqueezy (alternative to Stripe)
LEMONSQUEEZY_API_KEY=...
LEMONSQUEEZY_STORE_ID=...
LEMONSQUEEZY_VARIANT_ID=...

# Database (optional, uses in-memory by default)
DATABASE_URL=postgresql://...
```

**Start the dev server:**
```bash
npm run dev
# Runs on http://localhost:5000
```

---

### 3. VS Code Extension Setup

```bash
# Navigate to extension
cd hybridmind-extension

# Install dependencies
npm install

# Compile TypeScript
npm run compile
```

**Launch extension in development:**
1. Open `hybridmind-extension` folder in VS Code
2. Press `F5` to launch Extension Development Host
3. Test extension in new window

**Or build VSIX package:**
```bash
# Install vsce globally
npm install -g @vscode/vsce

# Package extension
vsce package

# Install locally
code --install-extension hybridmind-1.0.0.vsix
```

---

## 🔑 Getting API Keys

### Free Tier Options (No Credit Card Required)

#### 1. Groq (Fastest)
1. Visit [console.groq.com](https://console.groq.com)
2. Sign up (free)
3. Go to **API Keys**
4. Create new key
5. Copy key (starts with `gsk_`)

**Models:** Llama 3, Mixtral

---

#### 2. Google Gemini
1. Visit [aistudio.google.com](https://aistudio.google.com/app/apikey)
2. Sign in with Google
3. Click **Get API Key**
4. Copy key (starts with `AI`)

**Models:** Gemini Pro, Gemini Flash

---

#### 3. DeepSeek
1. Visit [platform.deepseek.com](https://platform.deepseek.com)
2. Sign up
3. Go to **API Keys**
4. Create new key
5. Copy key

**Models:** DeepSeek Coder, DeepSeek Chat

---

### Pro Tier Options (Requires Payment)

#### 4. OpenAI
1. Visit [platform.openai.com](https://platform.openai.com/api-keys)
2. Sign up / Add billing
3. Create new secret key
4. Copy key (starts with `sk-proj-`)

**Models:** GPT-4, GPT-4 Turbo, GPT-4o

**Pricing:** ~$0.03 per 1K tokens (input)

---

#### 5. Anthropic
1. Visit [console.anthropic.com](https://console.anthropic.com/settings/keys)
2. Sign up / Add billing
3. Create new key
4. Copy key (starts with `sk-ant-api`)

**Models:** Claude 3 Opus, Claude 3.5 Sonnet, Claude 3 Haiku

**Pricing:** ~$0.003 per 1K tokens (Sonnet)

---

#### 6. Qwen (Alibaba Cloud)
1. Visit [dashscope.console.aliyun.com](https://dashscope.console.aliyun.com/apiKey)
2. Sign up
3. Create API key
4. Copy key

**Models:** Qwen Max, Qwen Plus

---

## 💳 Stripe Setup (For Payment Testing)

### 1. Create Stripe Account
1. Visit [stripe.com](https://stripe.com)
2. Sign up for free
3. Activate test mode (toggle in dashboard)

### 2. Get API Keys
1. Go to **Developers** → **API Keys**
2. Copy **Secret key** (starts with `sk_test_`)
3. Save to landing page `.env` file

### 3. Create Product & Price
```bash
# Using Stripe CLI (recommended)
stripe products create --name="HybridMind Pro" --description="Monthly Pro subscription"

stripe prices create \
  --unit-amount=1900 \
  --currency=usd \
  --recurring-interval=month \
  --product=prod_XXX  # Use product ID from above

# Copy price ID (starts with price_...)
```

**Or use Stripe Dashboard:**
1. Go to **Products**
2. Click **Add product**
3. Name: "HybridMind Pro"
4. Price: $19.00 USD / month
5. Copy **Price ID**

### 4. Setup Webhooks
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe  # Mac
# or download from stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:5000/webhooks/stripe
```

**Copy webhook secret** (starts with `whsec_`) to `.env`

---

## 🧪 Testing the Complete Flow

### 1. Test Backend
```bash
# Start backend
cd hybridmind-backend
npm start

# Test health endpoint
curl http://localhost:3000/health
# Expected: {"status":"ok"}

# Test model call (requires API key)
curl -X POST http://localhost:3000/api/models/call \
  -H "Content-Type: application/json" \
  -d '{"model":"groq-llama3-70b","prompt":"Hello","code":"","temperature":0.7}'
```

---

### 2. Test Landing Page
```bash
# Start landing page
cd Hybrid-Mind-landingpage
npm run dev

# Visit in browser
open http://localhost:5000

# Test subscription dialog
# Click "Notify Me About v1.1 Premium"
# Enter email, submit
```

---

### 3. Test Payment Flow
```bash
# Make sure Stripe webhook is forwarding
stripe listen --forward-to localhost:5000/webhooks/stripe

# In browser:
# 1. Click "Get Started" on Pro tier card
# 2. Enter test email
# 3. Use test card: 4242 4242 4242 4242
# 4. Any future expiry date
# 5. Any CVC
# 6. Submit

# Check terminal for webhook events
# Check console for license generation
```

---

### 4. Test Extension
```bash
# Start backend (if not running)
cd hybridmind-backend
npm start

# Launch extension
cd hybridmind-extension
npm run compile
# Press F5 in VS Code

# In Extension Development Host:
# 1. Ctrl+Shift+P
# 2. Type "HybridMind: Quick Chat"
# 3. Enter question
# 4. Select model
# 5. Verify response
```

---

### 5. Test Pro License Activation
```bash
# Generate test license
curl -X POST http://localhost:5000/api/license/generate \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","tier":"pro","durationDays":365}'

# Copy license key from response
# Example: HYBRID-A1B2-C3D4-E5F6-G7H8

# In Extension Development Host:
# 1. Click status bar "HybridMind Free"
# 2. Select "Activate Pro License"
# 3. Paste license key
# 4. Verify status changes to "⭐ HybridMind Pro"
```

---

### 6. Test Chat Window (Pro Feature)
```bash
# After activating Pro license:
# 1. Ctrl+Shift+P
# 2. Type "HybridMind: Open Chat"
# 3. Chat window opens in sidebar
# 4. Type message, select model
# 5. Test action buttons (Explain, Refactor, etc.)
```

---

## 🔧 Troubleshooting

### Backend won't start
**Error:** "Port 3000 already in use"
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or change port in .env
PORT=3001
```

---

### Extension compilation errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run compile
```

---

### "No models available" in extension
1. Check backend is running (`http://localhost:3000/health`)
2. Verify API keys in backend `.env`
3. Check VS Code Output panel → "HybridMind"

---

### Stripe webhooks not working
```bash
# Verify Stripe CLI is forwarding
stripe listen --forward-to localhost:5000/webhooks/stripe

# Check webhook secret in .env matches
echo $STRIPE_WEBHOOK_SECRET

# Test webhook manually
stripe trigger payment_intent.succeeded
```

---

### License verification fails
1. Check landing page server is running
2. Verify license API: `curl http://localhost:5000/api/license/stats`
3. Check network in VS Code DevTools (Help → Toggle Developer Tools)

---

## 📊 Development Workflow

### 1. Making Changes

**Backend:**
```bash
cd hybridmind-backend
npm run dev  # Auto-restart on changes
```

**Landing Page:**
```bash
cd Hybrid-Mind-landingpage
npm run dev  # Hot reload
```

**Extension:**
```bash
cd hybridmind-extension
npm run watch  # Auto-compile
# Press Ctrl+R in Extension Development Host to reload
```

---

### 2. Running Tests
```bash
# Backend tests
cd hybridmind-backend
npm test

# Landing page tests
cd Hybrid-Mind-landingpage
npm test

# Extension tests
cd hybridmind-extension
npm test
```

---

### 3. Building for Production

**Backend:**
```bash
npm run build
npm start
```

**Landing Page:**
```bash
npm run build
npm run preview
```

**Extension:**
```bash
vsce package
# Creates hybridmind-X.X.X.vsix
```

---

## 🚀 Deployment

### Backend (Node.js Server)
```bash
# Recommended: Railway, Render, Fly.io

# Example: Deploying to Railway
railway init
railway up
railway variables set OPENAI_API_KEY=sk-...
```

---

### Landing Page (Full-stack)
```bash
# Recommended: Vercel, Netlify

# Example: Deploying to Vercel
npm i -g vercel
vercel
# Follow prompts
# Add environment variables in Vercel dashboard
```

---

### Extension (VS Code Marketplace)
```bash
# 1. Package extension
vsce package

# 2. Create publisher account
vsce create-publisher your-name

# 3. Login
vsce login your-name

# 4. Publish
vsce publish
```

---

## 📝 Environment Variables Reference

### Backend (hybridmind-backend/.env)
```bash
# AI Providers
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GROQ_API_KEY=
GEMINI_API_KEY=
DEEPSEEK_API_KEY=
QWEN_API_KEY=
MISTRAL_API_KEY=
XAI_API_KEY=

# Server
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
```

### Landing Page (Hybrid-Mind-landingpage/.env)
```bash
# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=

# Database (optional)
DATABASE_URL=

# Email (optional)
SENDGRID_API_KEY=

# Server
NODE_ENV=development
PORT=5000
```

---

## 🎉 Success Checklist

- [ ] Backend starts without errors
- [ ] Landing page loads in browser
- [ ] Extension launches in VS Code
- [ ] Can call AI models
- [ ] Stripe checkout works
- [ ] Webhooks receive events
- [ ] License generates successfully
- [ ] License activates in extension
- [ ] Chat window opens (Pro)
- [ ] All commands work

**All checked?** You're ready to go! 🚀

---

## 🤝 Support

- **Issues:** [GitHub Issues](https://github.com/itheroservices-hub/hybridmind/issues)
- **Email:** support@hybridmind.dev
- **Discord:** [discord.gg/hybridmind](https://discord.gg/hybridmind)

---

**Happy coding! 🎨**
