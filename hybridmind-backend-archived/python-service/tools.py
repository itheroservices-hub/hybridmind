"""
MCP Tools Bridge for AutoGen Agents

Connects Python AutoGen agents to Node.js MCP servers:
- Filesystem (read/write files)
- Terminal (execute commands)
- Web Search (search internet)
- Graphiti Memory (knowledge storage)
- M365 Agents (Microsoft 365 documentation)

All tools call the Node.js backend which routes to appropriate MCP servers.
"""

from typing import Annotated, Optional, Dict, Any, List
import requests
import json
import os
from datetime import datetime

# Node.js backend URL
NODEJS_BACKEND = os.getenv("NODEJS_BACKEND_URL", "http://localhost:3000")

# Request timeout
TIMEOUT = 30

class MCPToolsError(Exception):
    """Raised when MCP tool call fails"""
    pass

#############################################################################
# FILESYSTEM TOOLS
#############################################################################

def filesystem_read_file(
    path: Annotated[str, "Absolute file path to read"]
) -> str:
    """
    Read contents of a file from the workspace.
    
    Args:
        path: Absolute file path
        
    Returns:
        File contents as string
        
    Example:
        content = filesystem_read_file("e:/IThero/HybridMind/README.md")
    """
    try:
        response = requests.post(
            f"{NODEJS_BACKEND}/api/mcp/filesystem/read",
            json={"uri": f"file://{path}"},
            timeout=TIMEOUT
        )
        response.raise_for_status()
        
        data = response.json()
        if data.get("success"):
            return data.get("content", "")
        else:
            raise MCPToolsError(f"Failed to read file: {data.get('error')}")
            
    except requests.RequestException as e:
        raise MCPToolsError(f"Network error reading file: {str(e)}")

def filesystem_write_file(
    path: Annotated[str, "Absolute file path to write"],
    content: Annotated[str, "Content to write to file"]
) -> str:
    """
    Write content to a file in the workspace.
    
    Args:
        path: Absolute file path
        content: Content to write
        
    Returns:
        Success message
        
    Example:
        result = filesystem_write_file("e:/IThero/HybridMind/test.txt", "Hello!")
    """
    try:
        response = requests.post(
            f"{NODEJS_BACKEND}/api/mcp/filesystem/write",
            json={
                "uri": f"file://{path}",
                "content": content
            },
            timeout=TIMEOUT
        )
        response.raise_for_status()
        
        data = response.json()
        if data.get("success"):
            return f"Successfully wrote to {path}"
        else:
            raise MCPToolsError(f"Failed to write file: {data.get('error')}")
            
    except requests.RequestException as e:
        raise MCPToolsError(f"Network error writing file: {str(e)}")

def filesystem_list_directory(
    path: Annotated[str, "Directory path to list"]
) -> str:
    """
    List contents of a directory.
    
    Args:
        path: Directory path
        
    Returns:
        JSON string with directory contents
        
    Example:
        files = filesystem_list_directory("e:/IThero/HybridMind/")
    """
    try:
        response = requests.post(
            f"{NODEJS_BACKEND}/api/mcp/filesystem/list",
            json={"uri": f"file://{path}"},
            timeout=TIMEOUT
        )
        response.raise_for_status()
        
        data = response.json()
        if data.get("success"):
            entries = data.get("entries", [])
            return json.dumps(entries, indent=2)
        else:
            raise MCPToolsError(f"Failed to list directory: {data.get('error')}")
            
    except requests.RequestException as e:
        raise MCPToolsError(f"Network error listing directory: {str(e)}")

#############################################################################
# TERMINAL TOOLS
#############################################################################

def terminal_execute_command(
    command: Annotated[str, "Shell command to execute"]
) -> str:
    """
    Execute a terminal command in the workspace.
    
    Args:
        command: Shell command (e.g., "npm test", "git status")
        
    Returns:
        Command output
        
    Example:
        output = terminal_execute_command("npm --version")
    """
    try:
        response = requests.post(
            f"{NODEJS_BACKEND}/api/mcp/terminal/execute",
            json={"command": command},
            timeout=TIMEOUT
        )
        response.raise_for_status()
        
        data = response.json()
        if data.get("success"):
            return data.get("output", "")
        else:
            raise MCPToolsError(f"Command failed: {data.get('error')}")
            
    except requests.RequestException as e:
        raise MCPToolsError(f"Network error executing command: {str(e)}")

#############################################################################
# WEB SEARCH TOOLS
#############################################################################

def web_search(
    query: Annotated[str, "Search query"],
    max_results: Annotated[Optional[int], "Maximum results to return"] = 5
) -> str:
    """
    Search the web for information.
    
    Args:
        query: What to search for
        max_results: Maximum number of results (default 5)
        
    Returns:
        JSON string with search results
        
    Example:
        results = web_search("Python AutoGen tutorial")
    """
    try:
        response = requests.post(
            f"{NODEJS_BACKEND}/api/mcp/web-search/search",
            json={
                "query": query,
                "maxResults": max_results
            },
            timeout=TIMEOUT
        )
        response.raise_for_status()
        
        data = response.json()
        if data.get("success"):
            results = data.get("results", [])
            return json.dumps(results, indent=2)
        else:
            raise MCPToolsError(f"Search failed: {data.get('error')}")
            
    except requests.RequestException as e:
        raise MCPToolsError(f"Network error searching web: {str(e)}")

def web_fetch_page(
    url: Annotated[str, "URL to fetch"]
) -> str:
    """
    Fetch content from a web page.
    
    Args:
        url: Web page URL
        
    Returns:
        Page content
        
    Example:
        content = web_fetch_page("https://docs.python.org/3/")
    """
    try:
        response = requests.post(
            f"{NODEJS_BACKEND}/api/mcp/web-search/fetch",
            json={"url": url},
            timeout=TIMEOUT
        )
        response.raise_for_status()
        
        data = response.json()
        if data.get("success"):
            return data.get("content", "")
        else:
            raise MCPToolsError(f"Fetch failed: {data.get('error')}")
            
    except requests.RequestException as e:
        raise MCPToolsError(f"Network error fetching page: {str(e)}")

#############################################################################
# GRAPHITI MEMORY TOOLS
#############################################################################

def memory_store_knowledge(
    content: Annotated[str, "Content to store in memory"],
    entity_name: Annotated[str, "Name of entity this relates to"],
    tags: Annotated[Optional[List[str]], "Tags for categorization"] = None
) -> str:
    """
    Store knowledge in Graphiti memory system.
    
    Args:
        content: Information to remember
        entity_name: What this is about
        tags: Optional categorization tags
        
    Returns:
        Success message with memory ID
        
    Example:
        memory_store_knowledge("Use React hooks for state", "React", ["react", "hooks"])
    """
    try:
        response = requests.post(
            f"{NODEJS_BACKEND}/api/mcp/graphiti/store",
            json={
                "content": content,
                "entityName": entity_name,
                "tags": tags or []
            },
            timeout=TIMEOUT
        )
        response.raise_for_status()
        
        data = response.json()
        if data.get("success"):
            return f"Stored in memory: {data.get('memoryId')}"
        else:
            raise MCPToolsError(f"Memory storage failed: {data.get('error')}")
            
    except requests.RequestException as e:
        raise MCPToolsError(f"Network error storing memory: {str(e)}")

def memory_search(
    query: Annotated[str, "What to search for in memory"],
    limit: Annotated[Optional[int], "Maximum results"] = 5
) -> str:
    """
    Search stored knowledge in Graphiti memory.
    
    Args:
        query: Search query
        limit: Maximum results
        
    Returns:
        JSON string with matching memories
        
    Example:
        results = memory_search("React hooks patterns")
    """
    try:
        response = requests.post(
            f"{NODEJS_BACKEND}/api/mcp/graphiti/search",
            json={
                "query": query,
                "limit": limit
            },
            timeout=TIMEOUT
        )
        response.raise_for_status()
        
        data = response.json()
        if data.get("success"):
            results = data.get("results", [])
            return json.dumps(results, indent=2)
        else:
            raise MCPToolsError(f"Memory search failed: {data.get('error')}")
            
    except requests.RequestException as e:
        raise MCPToolsError(f"Network error searching memory: {str(e)}")

#############################################################################
# MICROSOFT 365 AGENTS TOOLS
#############################################################################

def m365_get_knowledge(
    query: Annotated[str, "Question about Microsoft 365 development"]
) -> str:
    """
    Query Microsoft 365 Agents Toolkit documentation.
    
    Args:
        query: Question about Teams, Office, or M365 development
        
    Returns:
        Documentation and guidance
        
    Example:
        info = m365_get_knowledge("How to create a Teams bot?")
    """
    try:
        response = requests.post(
            f"{NODEJS_BACKEND}/api/mcp/m365/get_knowledge",
            json={"query": query},
            timeout=TIMEOUT
        )
        response.raise_for_status()
        
        data = response.json()
        if data.get("success"):
            return data.get("result", "")
        else:
            raise MCPToolsError(f"M365 query failed: {data.get('error')}")
            
    except requests.RequestException as e:
        raise MCPToolsError(f"Network error querying M365: {str(e)}")

def m365_get_code_snippets(
    api_or_comment: Annotated[str, "API name or code comment describing what you need"]
) -> str:
    """
    Get code snippets for Microsoft 365 development.
    
    Args:
        api_or_comment: API name or description of code needed
        
    Returns:
        Code snippets and examples
        
    Example:
        code = m365_get_code_snippets("@microsoft/teams-ai TeamsAdapter")
    """
    try:
        response = requests.post(
            f"{NODEJS_BACKEND}/api/mcp/m365/get_code_snippets",
            json={"api_or_comment": api_or_comment},
            timeout=TIMEOUT
        )
        response.raise_for_status()
        
        data = response.json()
        if data.get("success"):
            return data.get("result", "")
        else:
            raise MCPToolsError(f"Code snippets failed: {data.get('error')}")
            
    except requests.RequestException as e:
        raise MCPToolsError(f"Network error getting code: {str(e)}")

#############################################################################
# TOOL COLLECTIONS
#############################################################################

# All filesystem tools
FILESYSTEM_TOOLS = [
    filesystem_read_file,
    filesystem_write_file,
    filesystem_list_directory
]

# All terminal tools
TERMINAL_TOOLS = [
    terminal_execute_command
]

# All web search tools
WEBSEARCH_TOOLS = [
    web_search,
    web_fetch_page
]

# All memory tools
MEMORY_TOOLS = [
    memory_store_knowledge,
    memory_search
]

# All M365 tools
M365_TOOLS = [
    m365_get_knowledge,
    m365_get_code_snippets
]

# All tools combined
ALL_MCP_TOOLS = (
    FILESYSTEM_TOOLS +
    TERMINAL_TOOLS +
    WEBSEARCH_TOOLS +
    MEMORY_TOOLS +
    M365_TOOLS
)

# Essential tools (most commonly used)
ESSENTIAL_TOOLS = [
    filesystem_read_file,
    filesystem_write_file,
    terminal_execute_command,
    web_search
]

# Research tools (for information gathering)
RESEARCH_TOOLS = [
    web_search,
    web_fetch_page,
    memory_search,
    m365_get_knowledge
]

# Development tools (for coding tasks)
DEVELOPMENT_TOOLS = [
    filesystem_read_file,
    filesystem_write_file,
    filesystem_list_directory,
    terminal_execute_command,
    m365_get_code_snippets
]

def get_tool_descriptions() -> List[Dict[str, str]]:
    """Get descriptions of all available tools"""
    return [
        {"name": "filesystem_read_file", "description": "Read file contents"},
        {"name": "filesystem_write_file", "description": "Write content to file"},
        {"name": "filesystem_list_directory", "description": "List directory contents"},
        {"name": "terminal_execute_command", "description": "Execute shell command"},
        {"name": "web_search", "description": "Search the internet"},
        {"name": "web_fetch_page", "description": "Fetch web page content"},
        {"name": "memory_store_knowledge", "description": "Store in knowledge base"},
        {"name": "memory_search", "description": "Search knowledge base"},
        {"name": "m365_get_knowledge", "description": "Query M365 documentation"},
        {"name": "m365_get_code_snippets", "description": "Get M365 code examples"}
    ]

if __name__ == "__main__":
    # Test tools
    print("MCP Tools Bridge - Testing")
    print("=" * 60)
    
    # Test web search
    try:
        print("\n1. Testing web_search...")
        results = web_search("Python programming", max_results=2)
        print(f"✅ Web search works! Results: {results[:100]}...")
    except Exception as e:
        print(f"❌ Web search failed: {e}")
    
    # Test terminal
    try:
        print("\n2. Testing terminal_execute_command...")
        output = terminal_execute_command("echo Hello from Python")
        print(f"✅ Terminal works! Output: {output}")
    except Exception as e:
        print(f"❌ Terminal failed: {e}")
    
    print("\n" + "=" * 60)
    print("Available tools:", len(ALL_MCP_TOOLS))
