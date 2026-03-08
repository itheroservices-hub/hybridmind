"""
🚀 AutoGen for HybridMind Development
This demo shows how multiple AI agents can collaborate on actual development tasks
"""

import autogen
import os

print("=" * 80)
print("🤖 AutoGen Multi-Agent Team for HybridMind Development")
print("=" * 80)
print("\nThis demo creates a team of specialized agents:")
print("  👨‍💻 Developer Agent - Writes code and proposes solutions")
print("  🔍 Code Reviewer Agent - Reviews code for quality and best practices")
print("  📋 Product Manager Agent - Ensures features meet requirements")
print("  🧪 Tester Agent - Plans tests and finds edge cases")
print("=" * 80)
print()

# CONFIGURATION - Using OpenRouter
config_list = [
    {
        "model": "meta-llama/llama-3.1-8b-instruct:free",  # FREE model!
        # For better quality, upgrade to:
        # "model": "google/gemini-pro-1.5",
        # "model": "anthropic/claude-3.5-sonnet",
        "base_url": "https://openrouter.ai/api/v1",
        "api_key": os.environ.get("OPENROUTER_API_KEY", "your-key-here")
    }
]

llm_config = {
    "config_list": config_list,
    "temperature": 0.7,
    "timeout": 120,
}

try:
    # AGENT 1: Developer - Writes code
    developer = autogen.AssistantAgent(
        name="Developer",
        system_message="""You are a senior Python developer.
        Your role is to write clean, efficient code.
        You follow best practices and write well-documented code.
        You propose solutions and implement features.
        When you're done with your part, say 'NEXT' to pass to the next agent.""",
        llm_config=llm_config,
    )

    # AGENT 2: Code Reviewer - Reviews code quality
    code_reviewer = autogen.AssistantAgent(
        name="CodeReviewer",
        system_message="""You are an expert code reviewer.
        Your role is to review code for:
        - Code quality and readability
        - Potential bugs or issues
        - Performance improvements
        - Best practices
        Provide constructive feedback. When satisfied, say 'APPROVED' or suggest changes.""",
        llm_config=llm_config,
    )

    # AGENT 3: Product Manager - Ensures requirements are met
    product_manager = autogen.AssistantAgent(
        name="ProductManager",
        system_message="""You are a product manager.
        Your role is to ensure the solution meets the requirements.
        Check if:
        - User needs are addressed
        - Features are practical and useful
        - Implementation aligns with project goals
        Provide feedback from a user perspective.""",
        llm_config=llm_config,
    )

    # AGENT 4: User Proxy - Manages the workflow
    user_proxy = autogen.UserProxyAgent(
        name="ProjectLead",
        human_input_mode="NEVER",  # Fully automated
        max_consecutive_auto_reply=15,
        is_termination_msg=lambda x: "TERMINATE" in x.get("content", "").upper(),
        code_execution_config={
            "work_dir": "hybridmind_dev",
            "use_docker": False,
        },
    )

    # GROUP CHAT - All agents can talk to each other
    groupchat = autogen.GroupChat(
        agents=[user_proxy, developer, code_reviewer, product_manager],
        messages=[],
        max_round=12
    )

    manager = autogen.GroupChatManager(groupchat=groupchat, llm_config=llm_config)

    # THE TASK - A real HybridMind development scenario
    task = """
    We need to improve the border wait times display on the Sarnia Dashboard.
    
    Current data structure:
    {
        "canada": {
            "passenger": {"USbound": "No wait times reported", "CAbound": "No Delay"},
            "commercial": {"USbound": "No wait times reported", "CAbound": "No Delay"}
        }
    }
    
    Requirements:
    1. Create a Python function that analyzes this data
    2. Function should return user-friendly status messages
    3. Handle cases where data might be "N/A" or missing
    4. Make it reusable for other data sources
    
    Developer: Create the function
    Code Reviewer: Review it
    Product Manager: Ensure it meets user needs
    
    When everyone agrees, say TERMINATE.
    """

    print("🚀 Starting team collaboration...\n")
    print("=" * 80)
    
    # Start the multi-agent conversation
    user_proxy.initiate_chat(
        manager,
        message=task
    )
    
    print("\n" + "=" * 80)
    print("✅ Team collaboration completed!")
    print("=" * 80)

except Exception as e:
    print(f"\n❌ Error: {e}\n")
    print("=" * 80)
    print("🔧 SETUP NEEDED")
    print("=" * 80)
    print("""
To run this demo:

1. Get your OpenRouter API key:
   → Go to: https://openrouter.ai/keys
   → Create a free account
   → Copy your API key

2. Set it in PowerShell:
   $env:OPENROUTER_API_KEY="your-key-here"

3. Run this script:
   py -3.13 autogen_hybridmind_demo.py

✨ This will show multiple AI agents collaborating on your code!

The FREE model works great for this demo.
For better results, upgrade to gemini-pro-1.5 or claude-3.5-sonnet.
    """)
    print("=" * 80)

print("\n💡 What You Just Saw:")
print("""
✅ Multiple specialized agents working together
✅ Each agent has their own expertise and perspective
✅ Agents review and improve each other's work
✅ Fully automated - no human intervention needed

This is PERFECT for HybridMind because:
- Agents can help design features
- Agents can write and review code
- Agents can test and validate
- Agents can document everything

🚀 Ready to build more? Tell me what HybridMind feature you want help with!
""")
