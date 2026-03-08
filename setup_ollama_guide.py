"""
🆓 FREE AutoGen Setup with Ollama - No API Costs!
Run AI agents locally on your own computer
"""

print("""
╔══════════════════════════════════════════════════════════════════════╗
║     🆓 FREE AutoGen Setup with Ollama - Local AI Agents             ║
╚══════════════════════════════════════════════════════════════════════╝

Why Ollama?
✅ Completely FREE
✅ Runs locally (no internet needed after setup)
✅ Privacy - your code never leaves your machine
✅ No API costs ever
✅ Fast with good hardware

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📥 STEP 1: Install Ollama
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Go to: https://ollama.ai
2. Click "Download" for Windows
3. Run the installer
4. Ollama will start automatically

To verify installation:
   ollama --version

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 STEP 2: Choose & Download a Model
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RECOMMENDED MODELS FOR HYBRIDMIND DEVELOPMENT:

For General Tasks (Good Balance):
   ollama pull llama3
   Size: ~4.7GB
   Best for: General development, conversations

For Coding Tasks (Best for HybridMind):
   ollama pull codellama
   Size: ~3.8GB
   Best for: Writing code, debugging, development

For Fast Testing:
   ollama pull llama3.2:1b
   Size: ~1.3GB
   Best for: Quick tests, limited resources

For Best Quality:
   ollama pull llama3:70b
   Size: ~40GB (needs powerful GPU)
   Best for: Production quality if you have the hardware

My Recommendation: Start with codellama for HybridMind development!

Run this now:
   ollama pull codellama

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ STEP 3: Test Ollama
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Test in terminal:
   ollama run codellama "Write a Python function to read JSON"

If you see code output, it works! Press Ctrl+D to exit.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 STEP 4: Configure AutoGen to Use Ollama
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

In any AutoGen example file, find this section:

# BEFORE (Uses paid OpenAI):
llm_config = {
    "config_list": config_list_openai,
    ...
}

# AFTER (Uses FREE Ollama):
llm_config = {
    "config_list": config_list_ollama,
    ...
}

That's it! Now your agents run locally and free!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 STEP 5: Run Your First Free Agent Team!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Update any example file to use Ollama config
2. Run:
   py -3.13 autogen_basic_demo.py

Watch your local AI agents work! No costs, no API limits!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Configuration Details
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The Ollama configuration that makes it work:

config_list_ollama = [
    {
        "model": "codellama",  # or "llama3" or any model you pulled
        "base_url": "http://localhost:11434/v1",  # Ollama's API endpoint
        "api_key": "ollama"  # Any value works, just needs to be set
    }
]

llm_config = {
    "config_list": config_list_ollama,
    "temperature": 0.7,  # Lower = more focused, Higher = more creative
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 Perfect for HybridMind Development
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

With Ollama + AutoGen, you can:

✅ Generate scrapers: "Create a scraper for Via Rail"
✅ Debug code: "Why is my news scraper failing?"
✅ Add features: "Add retry logic to border wait scraper"
✅ Review code: "Review my data validation logic"
✅ Optimize: "Make this scraper faster"
✅ Document: "Add docstrings to all functions"
✅ Test: "Create test cases for this module"

ALL COMPLETELY FREE! 🎉

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ Performance Tips
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Faster Response:
- Use smaller models (llama3.2:1b) for simple tasks
- Use codellama for coding tasks
- Close other GPU-intensive applications

Better Quality:
- Use larger models if you have RAM/GPU
- Lower temperature (0.3-0.5) for coding
- Higher temperature (0.7-0.9) for creative tasks

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Troubleshooting
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"Model not found":
   → Run: ollama pull codellama

"Connection refused":
   → Check if Ollama is running: ollama list
   → Restart Ollama

"Out of memory":
   → Use a smaller model: ollama pull llama3.2:1b
   → Close other applications

"Slow responses":
   → Normal for CPU-only systems
   → GPU significantly faster
   → Consider smaller models

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎓 Quick Start Commands
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Install and setup
ollama pull codellama

# List installed models
ollama list

# Test a model
ollama run codellama

# Update a model
ollama pull codellama

# Remove a model (free up space)
ollama rm codellama

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ Next Steps
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ✅ Install Ollama
2. ✅ Pull codellama model  
3. ✅ Update example files to use config_list_ollama
4. ✅ Run autogen_basic_demo.py
5. 🚀 Start building HybridMind with your AI team!

Ready? Run this now:
   ollama pull codellama

Then tell me: "Run the basic demo with Ollama" and I'll execute it!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
""")

print("\n💬 Ask me:")
print('   "Check if Ollama is installed"')
print('   "Pull codellama for me"')
print('   "Update examples to use Ollama"')
print('   "Run the basic demo"')
print()
