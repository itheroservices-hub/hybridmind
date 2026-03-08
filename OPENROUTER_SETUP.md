# 🚀 OpenRouter Setup for AutoGen

## Why OpenRouter is PERFECT for HybridMind:

✅ **One API Key** = Access to 100+ AI models  
✅ **FREE Models Available** (Meta Llama, Google Gemini, etc.)  
✅ **Pay-as-you-go** for premium models (GPT-4, Claude, etc.)  
✅ **No subscriptions** - Only pay for what you use  
✅ **Better rates** than going direct to OpenAI

---

## 🔑 Getting Your OpenRouter API Key

### Step 1: Sign Up
1. Go to: **https://openrouter.ai**
2. Click "Sign In" (can use GitHub, Google, or email)
3. No credit card required to start!

### Step 2: Get API Key
1. Go to: **https://openrouter.ai/keys**
2. Click "Create Key"
3. Copy the key (starts with `sk-or-v1-...`)

### Step 3: Add Credits (Optional)
- OpenRouter has **FREE models** you can use immediately!
- For premium models (GPT-4, Claude), add credits at: https://openrouter.ai/credits
- Start with $5-10 to test

---

## 🔧 Using OpenRouter in AutoGen

### Option 1: Set as Environment Variable (Recommended)

**In PowerShell:**
```powershell
$env:OPENROUTER_API_KEY="sk-or-v1-your-key-here"
```

**In your Python code:**
```python
import os

config_list = [
    {
        "model": "meta-llama/llama-3.1-8b-instruct:free",  # FREE!
        "base_url": "https://openrouter.ai/api/v1",
        "api_key": os.environ.get("OPENROUTER_API_KEY")
    }
]
```

### Option 2: Directly in Code

```python
config_list = [
    {
        "model": "meta-llama/llama-3.1-8b-instruct:free",
        "base_url": "https://openrouter.ai/api/v1",
        "api_key": "sk-or-v1-your-actual-key-here"
    }
]
```

---

## 🆓 FREE Models You Can Use Right Now:

```python
# 100% Free Models (no credits needed):
"meta-llama/llama-3.1-8b-instruct:free"      # Fast, good for most tasks
"google/gemini-flash-1.5:free"                # Good balance
"mistralai/mistral-7b-instruct:free"         # Fast, efficient

# Very Cheap Models (pennies per use):
"google/gemini-pro-1.5"                       # Great quality, cheap
"anthropic/claude-3-haiku"                    # Fast Claude

# Premium Models (best quality):
"anthropic/claude-3.5-sonnet"                 # Best overall
"openai/gpt-4-turbo"                          # OpenAI's best
"google/gemini-pro-1.5-exp"                   # Experimental, powerful
```

---

## 💡 For HybridMind Development:

### Development/Testing Phase:
- Use **FREE models** for testing workflows
- `meta-llama/llama-3.1-8b-instruct:free` is great for development

### Production/Final Work:
- Use `google/gemini-pro-1.5` (very affordable, great quality)
- Use `anthropic/claude-3.5-sonnet` (best for complex tasks)

### Cost Estimates:
- **Free models**: $0.00 (unlimited with rate limits)
- **Gemini Pro 1.5**: ~$0.001 per 1K input tokens (~$1 for 1M tokens)
- **Claude 3.5 Sonnet**: ~$0.003 per 1K tokens  
- **GPT-4 Turbo**: ~$0.01 per 1K tokens

---

## 🎯 Quick Start Command:

**1. Set your API key:**
```powershell
$env:OPENROUTER_API_KEY="your-key-here"
```

**2. Run the demo:**
```powershell
py -3.13 autogen_basic_demo.py
```

---

## 🔍 Checking Your Usage:

Go to: **https://openrouter.ai/activity**  
- See all your requests
- Track costs
- Monitor usage

---

## 💪 Next Steps:

Once you have your API key working:
1. Test with the basic demo
2. Try the advanced multi-agent demo
3. Build custom agents for your HybridMind project!

**Ask me:** "Create AutoGen agents to help build HybridMind features"
