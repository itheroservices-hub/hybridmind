"""
AutoGen for HybridMind - Team of Development Agents
This shows how multiple specialized agents can work together on your project
"""

import autogen

print("=" * 70)
print("🧠 AutoGen for HybridMind Development")
print("=" * 70)
print("\nBuilding a team of specialized agents to help develop HybridMind!")
print()
print("👥 Meet your development team:")
print("  🏗️  System Architect - Designs solutions")
print("  💻 Developer - Writes code")
print("  🔍 Code Reviewer - Reviews quality")
print("  🧪 QA Tester - Tests functionality")
print("=" * 70)
print()

# CONFIGURATION
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
    "config_list": config_list_openai,  # Switch to ollama for FREE
    "temperature": 0.7,
}

try:
    # AGENT 1: System Architect
    architect = autogen.AssistantAgent(
        name="Architect",
        system_message="""You are a system architect for the HybridMind project.
        Your role:
        - Design clean, maintainable solutions
        - Consider error handling and edge cases
        - Plan the structure before coding
        - Ensure scalability
        
        You work with the Developer to implement your designs.""",
        llm_config=llm_config,
    )

    # AGENT 2: Developer
    developer = autogen.AssistantAgent(
        name="Developer",
        system_message="""You are a Python developer for HybridMind.
        Your role:
        - Write clean, well-documented code
        - Follow the architect's design
        - Implement error handling
        - Write efficient code
        
        You work with the Architect's plans and Reviewer's feedback.""",
        llm_config=llm_config,
    )

    # AGENT 3: Code Reviewer
    reviewer = autogen.AssistantAgent(
        name="Reviewer",
        system_message="""You are a code reviewer for HybridMind.
        Your role:
        - Review code for quality and best practices
        - Check for potential bugs
        - Suggest improvements
        - Ensure code is maintainable
        
        Be constructive and specific in your feedback.""",
        llm_config=llm_config,
    )

    # AGENT 4: QA Tester
    tester = autogen.AssistantAgent(
        name="QA_Tester",
        system_message="""You are a QA tester for HybridMind.
        Your role:
        - Think of edge cases
        - Suggest test scenarios
        - Verify functionality
        - Ensure robustness
        
        You help ensure the code works in all situations.""",
        llm_config=llm_config,
    )

    # MANAGER: Coordinates the team
    manager = autogen.UserProxyAgent(
        name="Project_Manager",
        human_input_mode="TERMINATE",
        max_consecutive_auto_reply=20,
        is_termination_msg=lambda x: x.get("content", "").rstrip().endswith("TERMINATE"),
        code_execution_config={
            "work_dir": "hybridmind_dev",
            "use_docker": False,
        },
    )

    # Create the group chat
    groupchat = autogen.GroupChat(
        agents=[manager, architect, developer, reviewer, tester],
        messages=[],
        max_round=20
    )
    
    group_chat_manager = autogen.GroupChatManager(
        groupchat=groupchat,
        llm_config=llm_config
    )

    print("\n🎯 PROJECT TASK: Improve News Scraper")
    print("=" * 70)
    
    # Real HybridMind task
    project_task = """
    Task: Improve the Sarnia news scraper
    
    Current issues:
    1. Sometimes scraping fails without clear error messages
    2. No retry logic for failed requests
    3. Data validation is minimal
    
    Requirements:
    1. Add comprehensive error handling
    2. Implement retry logic with exponential backoff
    3. Add data validation
    4. Create a summary of what was scraped
    5. Add logging for debugging
    
    Team, please work together to:
    - Architect: Design the solution
    - Developer: Implement it
    - Reviewer: Check the code quality
    - Tester: Suggest test cases
    
    When complete, reply with TERMINATE.
    """
    
    print("\n🚀 Team is collaborating...\n")
    print("=" * 70)
    
    # Start the team collaboration!
    manager.initiate_chat(
        group_chat_manager,
        message=project_task
    )
    
    print("\n" + "=" * 70)
    print("✅ Team collaboration complete!")
    print("=" * 70)

except Exception as e:
    print(f"\n❌ Error: {e}\n")
    print("=" * 70)
    print("🔧 SETUP FOR HYBRIDMIND DEVELOPMENT")
    print("=" * 70)
    print("""
To use AutoGen teams for HybridMind development:

RECOMMENDED - FREE Option (Ollama):

1. Install Ollama: https://ollama.ai
   
2. Pull a good coding model:
   ollama pull codellama
   OR
   ollama pull llama3
   
3. Update line 30 in this file:
   "config_list": config_list_ollama
   
4. Run:
   py -3.13 autogen_for_hybridmind.py

What You Get:
✅ Free AI development team
✅ Agents that design, code, review, test
✅ Run locally - no internet needed after setup
✅ Perfect for iterative development

Real Use Cases for HybridMind:
- "Add rate limiting to my scraper"
- "Implement caching for border wait data"
- "Create a data validator for news articles"
- "Build an error recovery system"
- "Add unit tests for my modules"
- "Optimize database queries"
- "Create an API endpoint for weather data"
    """)

print("\n💡 How This Helps HybridMind:")
print("""
Instead of coding alone, you have a TEAM:

Traditional:                  With AutoGen:
You design                 → Architect designs
You code                   → Developer codes  
You review yourself        → Reviewer critiques
You test                   → QA finds edge cases
You iterate                → Team iterates together

Benefits:
- Faster development
- Better code quality
- Fewer bugs
- Multiple perspectives
- Automated best practices

Perfect for building complex systems like HybridMind!
""")

print("\n🎯 Try These Commands:")
print("""
1. Simple task:
   "Add error logging to border_waits scraper"

2. Complex task:
   "Build a data pipeline: fetch → validate → transform → store"

3. Code review:
   "Review my news scraper code and suggest improvements"

4. New feature:
   "Add sentiment analysis to news articles"

Ask me to run any of these with your team of agents!
""")
