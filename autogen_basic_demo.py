"""
AutoGen Basic Demo - Simple Conversation Between Agents
This shows the fundamental concept of how AutoGen works
"""

import autogen

print("=" * 70)
print("🤖 AutoGen Basic Demo - Agents Having a Conversation")
print("=" * 70)
print("\nThis demo shows two agents working together:")
print("1. Assistant Agent - Solves problems and writes code")
print("2. User Proxy Agent - Represents you and executes code")
print("=" * 70)
print()

# CONFIGURATION
# Choose one of these options:

# OPTION 1: Using OpenRouter 🔥 RECOMMENDED! (One API key, many models!)
# Get your key from: https://openrouter.ai/keys
config_list_openrouter = [
    {
        "model": "meta-llama/llama-3.1-8b-instruct:free",  # FREE MODEL!
        # Other options:
        # "model": "google/gemini-pro-1.5",  # Good and cheap
        # "model": "anthropic/claude-3.5-sonnet",  # Best quality
        # "model": "openai/gpt-4-turbo",  # OpenAI through OpenRouter
        "base_url": "https://openrouter.ai/api/v1",
        "api_key": "your-openrouter-key-here"  # Get from openrouter.ai/keys
    }
]

# OPTION 2: Using Ollama (FREE! Runs locally - no API key needed)
# Run: ollama pull llama3
config_list_ollama = [
    {
        "model": "llama3",
        "base_url": "http://localhost:11434/v1",
        "api_key": "ollama"
    }
]

# OPTION 3: Using LM Studio (FREE! Runs locally - no API key needed)
config_list_lmstudio = [
    {
        "model": "local-model",
        "base_url": "http://localhost:1234/v1", 
        "api_key": "lm-studio"
    }
]

# Choose which config to use (default: OpenRouter)
# Change to config_list_ollama or config_list_lmstudio for local/free options
llm_config = {
    "config_list": config_list_openrouter,
    "temperature": 0.7,
}

try:
    # CREATE AGENT 1: Assistant
    # This agent thinks about problems and proposes solutions
    assistant = autogen.AssistantAgent(
        name="Assistant",
        system_message="""You are a helpful AI assistant. 
        You help solve problems by breaking them down into steps.
        You can write Python code when needed.
        Be clear and concise in your responses.""",
        llm_config=llm_config,
    )

    # CREATE AGENT 2: User Proxy
    # This agent represents the user and can execute code
    user_proxy = autogen.UserProxyAgent(
        name="User",
        human_input_mode="TERMINATE",  # Will stop when task is done
        max_consecutive_auto_reply=10,
        is_termination_msg=lambda x: x.get("content", "").rstrip().endswith("TERMINATE"),
        code_execution_config={
            "work_dir": "autogen_output",
            "use_docker": False,  # Set to True for safer execution
        },
    )

    # START THE CONVERSATION
    print("\n🚀 Starting conversation between agents...\n")
    print("=" * 70)
    
    # Give the agents a task
    task = """
    Analyze this data about border wait times and create a simple summary:
    
    Blue Water Bridge:
    - Canada-bound passengers: No Delay
    - US-bound passengers: No wait times reported
    - Commercial traffic: No Delay both directions
    
    Write a 2-3 sentence summary that would be helpful for travelers.
    
    When done, reply with TERMINATE.
    """
    
    # This starts the conversation!
    user_proxy.initiate_chat(
        assistant,
        message=task
    )
    
    print("\n" + "=" * 70)
    print("✅ Conversation completed!")
    print("=" * 70)

except Exception as e:
    print(f"\n❌ Error: {e}\n")
    print("=" * 70)
    print("🔧 SETUP NEEDED")
    print("=" * 70)
    print("""
To run this demo, you need to configure an LLM backend:

OPTION 1 - OpenRouter 🔥 RECOMMENDED! (One key, many models):
    1. Get FREE API key from: https://openrouter.ai/keys
    2. Update line 23 with your key
    3. Has FREE models! Or access to GPT-4, Claude, Gemini, etc.
    4. Run: py -3.13 autogen_basic_demo.py

OPTION 2 - Ollama (100% FREE! Runs on your computer):
    1. Install from: https://ollama.ai
    2. Run: ollama pull llama3
    3. Change line 54 to: "config_list": config_list_ollama
    4. Run: py -3.13 autogen_basic_demo.py

OPTION 3 - LM Studio (100% FREE! Runs on your computer):
    1. Download from: https://lmstudio.ai
    2. Load a model in LM Studio
    3. Start the local server
    4. Change line 54 to: "config_list": config_list_lmstudio
    5. Run: py -3.13 autogen_basic_demo.py

Need help? Ask me: "How do I set up OpenRouter?" or "Show me Ollama setup"
    """)
    print("=" * 70)

print("\n💡 What just happened?")
print("""
The Assistant Agent:
- Read the task
- Analyzed the border wait data
- Created a traveler-friendly summary
- Responded back

The User Proxy Agent:
- Managed the conversation
- Would execute any code if needed
- Terminated when task was complete

This is the FOUNDATION of AutoGen - agents working together!
""")
