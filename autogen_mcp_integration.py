"""
AutoGen + MCP Integration for HybridMind
This shows how AutoGen agents can use your MCP server to access HybridMind
"""

import autogen
import os
import json
from typing import Annotated

print("=" * 80)
print("🔗 AutoGen + MCP Integration for HybridMind")
print("=" * 80)
print("\nThis demo shows AutoGen agents using your MCP server to:")
print("  📊 Read HybridMind data (border waits, news, weather, etc.)")
print("  💾 Store data back to HybridMind")
print("  🔧 Use HybridMind tools and features")
print("  🧠 Make intelligent decisions based on your data")
print("=" * 80)
print()

# CONFIGURATION
config_list = [
    {
        "model": "meta-llama/llama-3.1-8b-instruct:free",
        "base_url": "https://openrouter.ai/api/v1",
        "api_key": os.environ.get("OPENROUTER_API_KEY", "your-key-here")
    }
]

llm_config = {
    "config_list": config_list,
    "temperature": 0.7,
}

# MCP SERVER INTEGRATION FUNCTIONS
# These are the "tools" that AutoGen agents can use to access HybridMind

def get_border_wait_data() -> str:
    """
    Connect to HybridMind MCP server to get current border wait times.
    In production, this would call your actual MCP server.
    """
    # This is where you'd actually call your MCP server
    # For demo purposes, reading the local file
    try:
        with open("border_waits.json", "r") as f:
            data = json.load(f)
        return json.dumps(data, indent=2)
    except Exception as e:
        return f"Error accessing MCP server: {e}"

def get_news_data() -> str:
    """
    Connect to HybridMind MCP server to get latest news.
    """
    try:
        with open("news.json", "r") as f:
            data = json.load(f)
        return json.dumps(data, indent=2)
    except Exception as e:
        return f"Error accessing MCP server: {e}"

def analyze_dashboard_status() -> str:
    """
    Call HybridMind MCP server to get overall dashboard status.
    This would use your MCP's analysis tools.
    """
    return """
    Dashboard Status (via MCP):
    - Border Wait Times: Active, no delays
    - News Feed: 5 articles from past 24h
    - Weather: Current conditions available
    - Transit: Live updates available
    - Events: 3 upcoming community events
    """

def update_hybridmind_config(setting: str, value: str) -> str:
    """
    Update HybridMind configuration through MCP server.
    """
    return f"Updated HybridMind setting '{setting}' to '{value}' via MCP server"

# REGISTER FUNCTIONS WITH AUTOGEN
# This tells AutoGen agents they can call these functions

try:
    # Create Assistant Agent with access to MCP tools
    assistant = autogen.AssistantAgent(
        name="HybridMindAssistant",
        system_message="""You are an AI assistant for HybridMind.
        You have access to the HybridMind MCP server through these functions:
        - get_border_wait_data(): Get current border crossing data
        - get_news_data(): Get latest news articles
        - analyze_dashboard_status(): Get overall system status
        - update_hybridmind_config(setting, value): Update configuration
        
        Use these tools to help users with HybridMind tasks.
        Be helpful and provide clear explanations.""",
        llm_config=llm_config,
    )

    # Create User Proxy that can execute the MCP functions
    user_proxy = autogen.UserProxyAgent(
        name="User",
        human_input_mode="NEVER",
        max_consecutive_auto_reply=10,
        is_termination_msg=lambda x: "TERMINATE" in x.get("content", "").upper(),
        code_execution_config=False,  # We're using function calls, not code execution
        function_map={
            "get_border_wait_data": get_border_wait_data,
            "get_news_data": get_news_data,
            "analyze_dashboard_status": analyze_dashboard_status,
            "update_hybridmind_config": update_hybridmind_config,
        }
    )

    # REGISTER THE FUNCTIONS
    # This tells the LLM what functions are available
    
    # Function schemas for the LLM
    functions = [
        {
            "name": "get_border_wait_data",
            "description": "Get current border wait times from HybridMind MCP server",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        },
        {
            "name": "get_news_data",
            "description": "Get latest news from HybridMind MCP server",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        },
        {
            "name": "analyze_dashboard_status",
            "description": "Get overall HybridMind dashboard status",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        },
        {
            "name": "update_hybridmind_config",
            "description": "Update HybridMind configuration setting",
            "parameters": {
                "type": "object",
                "properties": {
                    "setting": {"type": "string", "description": "Setting name"},
                    "value": {"type": "string", "description": "New value"}
                },
                "required": ["setting", "value"]
            }
        }
    ]

    # Update llm_config with functions
    llm_config["functions"] = functions

    print("🚀 Starting HybridMind agent with MCP integration...\n")
    print("=" * 80)

    # TEST TASK - Agent uses MCP server to access HybridMind
    task = """
    Please help me understand the current status of HybridMind:
    
    1. Check the border wait times
    2. Check what news we have
    3. Give me an overall dashboard status
    
    Then provide a brief summary for a user checking the dashboard.
    
    When done, say TERMINATE.
    """

    # Start the conversation
    user_proxy.initiate_chat(
        assistant,
        message=task
    )

    print("\n" + "=" * 80)
    print("✅ MCP Integration Demo Complete!")
    print("=" * 80)

except Exception as e:
    print(f"\n❌ Error: {e}\n")
    print("=" * 80)
    print("🔧 SETUP FOR MCP INTEGRATION")
    print("=" * 80)
    print("""
To use AutoGen with your HybridMind MCP server:

1. Make sure your MCP server is running:
   py -3.13 your_mcp_server.py

2. Update the functions in this file to call your actual MCP server:
   - Use MCP client library to connect
   - Call your MCP server's tools and resources
   - Return results to AutoGen agents

3. Set your OpenRouter API key:
   $env:OPENROUTER_API_KEY="your-key-here"

4. Run this demo:
   py -3.13 autogen_mcp_integration.py

This creates a powerful combo:
✅ AutoGen agents make decisions and orchestrate tasks
✅ MCP server provides data and HybridMind functionality  
✅ Agents can read/write to your actual HybridMind system
✅ Full integration between AI agents and your application!
    """)

print("\n💡 What This Enables:")
print("""
With AutoGen + MCP integration, you can:

🤖 Natural Language Interface:
   "What's the border wait time right now?"
   → Agent calls MCP → Gets data → Responds naturally

🔄 Automated Tasks:
   "Check the news every hour and summarize"
   → Agent schedules → Calls MCP → Processes → Reports

🧠 Intelligent Analysis:
   "Are there any patterns in the border wait times?"
   → Agent gets data from MCP → Analyzes → Provides insights

🛠️ System Management:
   "Update the refresh rate to 5 minutes"
   → Agent calls MCP → Updates config → Confirms

🎯 Multi-Agent Workflows:
   Data Collector Agent → Gets data via MCP
   Analyzer Agent → Processes it
   Reporter Agent → Creates summaries
   Publisher Agent → Updates dashboard via MCP

This is the FUTURE of HybridMind - AI agents that understand and
manage your entire system through the MCP interface! 🚀
""")
