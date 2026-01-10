# 📦 How to Create GitHub Release for v1.4.0

## Step 1: Go to GitHub Releases

1. Navigate to: https://github.com/itheroservices-hub/hybridmind/releases
2. Click **"Draft a new release"**

## Step 2: Fill in Release Details

### Tag
- **Tag version**: `v1.4.0` (already created and pushed)
- **Target**: `main` branch

### Release Title
```
v1.4.0 - Major Model Expansion: 25+ AI Models with OpenRouter Integration
```

### Release Description
Copy the content from `GITHUB_RELEASE_v1.4.0.md` or use this summary:

```markdown
## 🚀 Major Update - 25+ AI Models Now Available!

### ✨ What's New
- **Expanded from 10 to 25+ working AI models**
- **OpenRouter Integration** for premium model access
- **Claude 4.5 series** (Opus, Sonnet, Haiku)
- **Gemini 2.5 series** (Pro, Flash)
- **Grok 4** and advanced reasoning models
- **Specialized coding models** (Codestral 2508, Qwen 3 Coder Plus)
- **Perplexity Sonar Pro** with internet search

### 🎨 UI Improvements
- Organized model categories (Reasoning, Flagship, Fast, Specialized)
- New badge system (FREE, PRO, ULTRA)
- Better visual hierarchy

### 📊 Model Breakdown
**Free Tier (6 models)**
- Llama 3.3 70B, Mixtral 8x7B, Gemini Flash, DeepSeek V3, DeepSeek R1 Distill

**Premium Tier (19 models)**
- 🧠 Reasoning: DeepSeek R1, Phi-4 Reasoning Plus
- 👑 Flagship: GPT-4o, Claude 4.5 series, Gemini 2.5 Pro
- ⚡ Fast: GPT-4o Mini, Claude Haiku 4.5, Gemini 2.5 Flash
- 🎯 Specialized: Codestral 2508, Qwen Coder, Perplexity Sonar, Grok 4

### 🔧 Bug Fixes
- Fixed all broken model IDs
- Updated to latest model versions
- 100% working model guarantee

### 📥 Installation
Download `hybridmind-1.4.0.vsix` and install:
```bash
code --install-extension hybridmind-1.4.0.vsix
```

### 🔑 Setup
Add OpenRouter API key to `.env`:
```
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

Get your key at: https://openrouter.ai

### 📚 Full Documentation
- [CHANGELOG_v1.4.0.md](./CHANGELOG_v1.4.0.md)
- [MODEL_UPDATE_COMPLETE.md](./MODEL_UPDATE_COMPLETE.md)
- [EXPANDED_MODEL_LIBRARY.md](./EXPANDED_MODEL_LIBRARY.md)

### 🐛 Breaking Changes
**Model IDs Updated:**
- `google/gemini-pro-1.5` → `google/gemini-2.5-pro`
- `mistralai/codestral` → `mistralai/codestral-2508`
- `x-ai/grok-2` → `x-ai/grok-4`

**⭐ Star us if you find this useful!**
```

## Step 3: Attach Files

Upload the VSIX file:
1. Click **"Attach binaries"**
2. Upload: `e:\IThero\HybridMind\hybridmind-extension\hybridmind-1.4.0.vsix`
3. Optional: Add a README or other docs

## Step 4: Publish

1. **Check**: "Set as the latest release" ✓
2. **Check**: "Create a discussion for this release" (optional)
3. Click **"Publish release"**

---

## Alternative: Use GitHub CLI

If you have GitHub CLI installed:

```bash
cd e:\IThero\HybridMind

# Create release
gh release create v1.4.0 \
  ./hybridmind-extension/hybridmind-1.4.0.vsix \
  --title "v1.4.0 - Major Model Expansion: 25+ AI Models" \
  --notes-file GITHUB_RELEASE_v1.4.0.md \
  --latest

# Verify release
gh release view v1.4.0
```

---

## Alternative: Manual Upload via Web

1. Go to: https://github.com/itheroservices-hub/hybridmind/releases/new
2. Select tag: `v1.4.0`
3. Fill in title and description (see above)
4. Drag and drop `hybridmind-1.4.0.vsix` into the attachments area
5. Click "Publish release"

---

## After Publishing

### Announce the Release

**Twitter/X:**
```
🚀 HybridMind v1.4.0 is here!

✨ 25+ AI models including:
- Claude 4.5 series
- Gemini 2.5 Pro/Flash
- Grok 4
- DeepSeek R1
- Specialized coding models

Free tier: 6 models
Pro tier: 25+ models

Get it now: https://github.com/itheroservices-hub/hybridmind/releases/tag/v1.4.0

#VSCode #AI #OpenSource
```

**Reddit (r/vscode, r/programming):**
```
Title: HybridMind v1.4.0 Released - 25+ AI Models in VS Code

Just released a major update to HybridMind, a VS Code extension that gives you access to 25+ AI models from multiple providers.

What's new:
- OpenRouter integration (access to 300+ models)
- Claude 4.5 series (Opus, Sonnet, Haiku)
- Gemini 2.5 Pro and Flash
- Grok 4
- Advanced reasoning models (DeepSeek R1, Phi-4)
- Specialized coding models (Codestral 2508, Qwen Coder)
- Perplexity with internet search

6 models free, 19 premium via OpenRouter at pay-as-you-go pricing.

GitHub: https://github.com/itheroservices-hub/hybridmind
```

**Dev.to:**
Create a blog post using `CHANGELOG_v1.4.0.md` content

---

## Files Ready for GitHub Release

✅ `hybridmind-1.4.0.vsix` - Main extension file  
✅ `CHANGELOG_v1.4.0.md` - Full changelog  
✅ `GITHUB_RELEASE_v1.4.0.md` - Release notes  
✅ `MODEL_UPDATE_COMPLETE.md` - Technical details  
✅ Tag `v1.4.0` - Created and pushed  
✅ Code committed and pushed to main  

---

## 🎉 You're Ready!

All files are prepared and pushed to GitHub. Just create the release via the web interface!
