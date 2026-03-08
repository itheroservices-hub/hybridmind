"""
AutoGen Coding Example - Agents Writing Code Together
This shows AutoGen's most powerful feature: agents that can code!
"""

import autogen

print("=" * 70)
print("🚀 AutoGen Coding Demo - Agents Writing & Executing Code")
print("=" * 70)
print("\nThis demo shows agents that can:")
print("✅ Write Python code")
print("✅ Execute the code")
print("✅ Debug if there are errors")
print("✅ Iterate until it works")
print("=" * 70)
print()

# CONFIGURATION - Choose your LLM backend
config_list_openai = [
    {
        "model": "gpt-4",
        "api_key": "your-openai-key-here"
    }
]

config_list_ollama = [
    {
        "model": "llama3",
        "base_url": "http://localhost:11434/v1",
        "api_key": "ollama"
    }
]

llm_config = {
    "config_list": config_list_openai,  # Change to config_list_ollama for free!
    "temperature": 0.5,
}

try:
    # AGENT 1: Coding Assistant
    # This agent writes Python code to solve problems
    coder = autogen.AssistantAgent(
        name="Coder",
        system_message="""You are an expert Python developer.
        You write clean, well-commented code.
        You test your code and fix any errors.
        You explain what your code does.""",
        llm_config=llm_config,
    )

    # AGENT 2: Code Executor
    # This agent runs the code and reports results
    executor = autogen.UserProxyAgent(
        name="CodeExecutor",
        human_input_mode="NEVER",  # Runs automatically
        max_consecutive_auto_reply=10,
        is_termination_msg=lambda x: x.get("content", "").rstrip().endswith("TERMINATE"),
        code_execution_config={
            "work_dir": "autogen_code_output",
            "use_docker": False,
        },
    )

    print("\n🎯 TASK: Analyze Border Wait Times Data\n")
    
    # Give the agents a coding task
    coding_task = """
    Write Python code to:
    
    1. Read the border_waits.json file
    2. Extract the key information (passenger and commercial wait times)
    3. Determine the overall status (is there any delays?)
    4. Create a simple text summary
    5. Print the summary
    
    Make the code clean and well-commented.
    
    When the code runs successfully, reply with TERMINATE.
    """
    
    print("=" * 70)
    print("🤖 Agents are now working...")
    print("=" * 70)
    print()
    
    # Start the coding collaboration!
    executor.initiate_chat(
        coder,
        message=coding_task
    )
    
    print("\n" + "=" * 70)
    print("✅ Coding task completed!")
    print("=" * 70)
    print("""
What just happened:
1. Coder Agent wrote Python code
2. Executor Agent ran the code
3. If errors occurred, they discussed and fixed them
4. They iterated until it worked perfectly

Check the 'autogen_code_output' folder to see the generated code!
    """)

except Exception as e:
    print(f"\n❌ Error: {e}\n")
    print("=" * 70)
    print("🔧 QUICK SETUP GUIDE")
    print("=" * 70)
    print("""
FREE OPTION - Use Ollama:

1. Install Ollama:
   Download from: https://ollama.ai
   
2. Install a model:
   ollama pull llama3
   
3. Update this file:
   Line 35: Change config_list_openai to config_list_ollama
   
4. Run:
   py -3.13 autogen_coding_example.py

That's it! No API keys, no costs, all local! 🎉

Why this is AMAZING for HybridMind:
- Agents can write scrapers for you
- Agents can debug your code
- Agents can add features
- Agents can optimize performance
- All automatically!
    """)

print("\n💡 Why This is Powerful:")
print("""
Traditional Development:
  You write code → Test → Debug → Repeat

With AutoGen:
  Describe what you want → Agents write code → Agents test → Done!

Perfect for:
- Building new scrapers
- Adding features to HybridMind
- Debugging issues
- Optimizing code
- Creating utilities
""")
