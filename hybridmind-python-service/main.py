"""
HybridMind Python AI Service - FastAPI + AutoGen
Provides advanced AI capabilities to the Node.js backend
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import autogen
import os
from datetime import datetime
import asyncio

# Import MCP tools bridge
from tools import (
    ALL_MCP_TOOLS,
    ESSENTIAL_TOOLS,
    RESEARCH_TOOLS,
    DEVELOPMENT_TOOLS,
    FILESYSTEM_TOOLS,
    TERMINAL_TOOLS,
    WEBSEARCH_TOOLS,
    MEMORY_TOOLS,
    M365_TOOLS,
    get_tool_descriptions
)

# Import advanced features
from code_execution import CodeExecutionSandbox
from multi_agent_coordination import MultiAgentCoordinator
from tool_analytics import analytics, ToolAnalytics
from custom_tools import registry, get_custom_tools_for_agents, add_custom_tool
from task_decomposition import TaskDecomposer, TaskManager, task_manager, TaskStatus

app = FastAPI(
    title="HybridMind Python AI Service",
    description="Advanced AI agent service using AutoGen",
    version="1.0.0"
)

# CORS for Node.js backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response Models
class AgentRequest(BaseModel):
    task: str
    agent_type: str  # 'code_generator', 'code_reviewer', 'architect', 'reasoner'
    context: Optional[Dict[str, Any]] = {}
    max_iterations: Optional[int] = 10
    temperature: Optional[float] = 0.7

class AgentResponse(BaseModel):
    success: bool
    result: str
    agent_type: str
    iterations: int
    execution_time: float
    metadata: Dict[str, Any]

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    service: str

# AutoGen Configuration
def get_llm_config(temperature: float = 0.7, tools: List = None):
    """Get LLM configuration - supports OpenAI, Ollama, or OpenRouter"""
    
    # Try OpenRouter first (HybridMind's multi-provider)
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    if openrouter_key:
        config = {
            "config_list": [{
                "model": "anthropic/claude-3.5-sonnet",
                "api_key": openrouter_key,
                "base_url": "https://openrouter.ai/api/v1"
            }],
            "temperature": temperature,
            "timeout": 120,
        }
    else:
        # Fallback to Ollama (free local)
        config = {
            "config_list": [{
                "model": "llama3.2",
                "base_url": "http://localhost:11434/v1",
                "api_key": "ollama"
            }],
            "temperature": temperature,
            "timeout": 120,
        }
    
    # Add tools if provided
    if tools:
        config["functions"] = tools
    
    return config

# Agent Factory
class AgentFactory:
    """Creates specialized AutoGen agents based on type"""
    
    @staticmethod
    def create_code_generator(llm_config):
        """Code generation specialist"""
        return autogen.AssistantAgent(
            name="CodeGenerator",
            system_message="""You are an expert code generator for HybridMind.
            
Your role:
- Generate high-quality, production-ready code
- Follow JavaScript/TypeScript best practices
- Include error handling and validation
- Add helpful comments
- Consider Edge cases

Always provide complete, runnable code.""",
            llm_config=llm_config,
        )
    
    @staticmethod
    def create_code_reviewer(llm_config):
        """Code review specialist"""
        return autogen.AssistantAgent(
            name="CodeReviewer",
            system_message="""You are an expert code reviewer for HybridMind.
            
Your role:
- Review code for bugs, security issues, performance problems
- Check for best practices and patterns
- Verify error handling
- Suggest improvements
- Rate code quality (1-10)

Provide constructive, specific feedback.""",
            llm_config=llm_config,
        )
    
    @staticmethod
    def create_architect(llm_config):
        """System architecture specialist"""
        return autogen.AssistantAgent(
            name="Architect",
            system_message="""You are a system architect for HybridMind.
            
Your role:
- Design scalable, maintainable solutions
- Consider integration points
- Plan data flow and APIs
- Identify potential issues
- Create implementation plans

Think holistically about the system.""",
            llm_config=llm_config,
        )
    
    @staticmethod
    def create_reasoner(llm_config):
        """Complex reasoning specialist"""
        return autogen.AssistantAgent(
            name="Reasoner",
            system_message="""You are a reasoning specialist for HybridMind.
            
Your role:
- Break down complex problems
- Analyze trade-offs and options
- Provide step-by-step solutions
- Consider edge cases
- Make informed recommendations

Use clear, logical reasoning.""",
            llm_config=llm_config,
        )
    
    @staticmethod
    def create_user_proxy(max_iterations: int = 10):
        """User proxy for agent interaction"""
        return autogen.UserProxyAgent(
            name="HybridMindProxy",
            human_input_mode="NEVER",
            max_consecutive_auto_reply=max_iterations,
            code_execution_config={"use_docker": False},
        )

# API Endpoints
@app.get("/", response_model=HealthResponse)
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "HybridMind Python AI Service"
    }

@app.get("/health", response_model=HealthResponse)
async def health():
    """Detailed health check"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "HybridMind Python AI Service"
    }

@app.post("/agent/execute", response_model=AgentResponse)
async def execute_agent(request: AgentRequest):
    """Execute an AutoGen agent task"""
    
    start_time = datetime.now()
    
    try:
        # Get LLM config
        llm_config = get_llm_config(request.temperature)
        
        # Create agents based on type
        agent_creators = {
            'code_generator': AgentFactory.create_code_generator,
            'code_reviewer': AgentFactory.create_code_reviewer,
            'architect': AgentFactory.create_architect,
            'reasoner': AgentFactory.create_reasoner,
        }
        
        if request.agent_type not in agent_creators:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid agent_type. Must be one of: {list(agent_creators.keys())}"
            )
        
        # Create specialist agent
        agent = agent_creators[request.agent_type](llm_config)
        
        # Create user proxy
        user_proxy = AgentFactory.create_user_proxy(request.max_iterations)
        
        # Execute task
        chat_result = user_proxy.initiate_chat(
            agent,
            message=request.task,
        )
        
        # Extract result
        result = chat_result.summary if hasattr(chat_result, 'summary') else str(chat_result)
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        return {
            "success": True,
            "result": result,
            "agent_type": request.agent_type,
            "iterations": len(chat_result.chat_history) if hasattr(chat_result, 'chat_history') else 1,
            "execution_time": execution_time,
            "metadata": {
                "context": request.context,
                "temperature": request.temperature,
                "max_iterations": request.max_iterations,
            }
        }
        
    except Exception as e:
        execution_time = (datetime.now() - start_time).total_seconds()
        
        return {
            "success": False,
            "result": str(e),
            "agent_type": request.agent_type,
            "iterations": 0,
            "execution_time": execution_time,
            "metadata": {
                "error": str(e),
                "error_type": type(e).__name__
            }
        }

@app.post("/agent/team-collaboration")
async def team_collaboration(request: Dict[str, Any]):
    """Execute multi-agent collaboration"""
    
    start_time = datetime.now()
    
    try:
        task = request.get("task")
        agents_needed = request.get("agents", ["architect", "code_generator", "code_reviewer"])
        temperature = request.get("temperature", 0.7)
        
        if not task:
            raise HTTPException(status_code=400, detail="Task is required")
        
        llm_config = get_llm_config(temperature)
        
        # Create team of agents
        team = []
        for agent_type in agents_needed:
            if agent_type == "architect":
                team.append(AgentFactory.create_architect(llm_config))
            elif agent_type == "code_generator":
                team.append(AgentFactory.create_code_generator(llm_config))
            elif agent_type == "code_reviewer":
                team.append(AgentFactory.create_code_reviewer(llm_config))
            elif agent_type == "reasoner":
                team.append(AgentFactory.create_reasoner(llm_config))
        
        # Create group chat
        groupchat = autogen.GroupChat(
            agents=team,
            messages=[],
            max_round=10
        )
        
        manager = autogen.GroupChatManager(groupchat=groupchat, llm_config=llm_config)
        
        # Execute collaboration
        user_proxy = AgentFactory.create_user_proxy()
        chat_result = user_proxy.initiate_chat(
            manager,
            message=task
        )
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        return {
            "success": True,
            "result": chat_result.summary if hasattr(chat_result, 'summary') else "Collaboration completed",
            "agents_used": agents_needed,
            "execution_time": execution_time,
            "chat_history": chat_result.chat_history if hasattr(chat_result, 'chat_history') else []
        }
        
    except Exception as e:
        execution_time = (datetime.now() - start_time).total_seconds()
        return {
            "success": False,
            "error": str(e),
            "execution_time": execution_time
        }

@app.get("/agent/types")
async def get_agent_types():
    """Get available agent types"""
    return {
        "agent_types": [
            {
                "type": "code_generator",
                "description": "Generates production-ready code",
                "use_when": "Creating new features, components, or modules"
            },
            {
                "type": "code_reviewer",
                "description": "Reviews code for quality and issues",
                "use_when": "Validating code quality, finding bugs"
            },
            {
                "type": "architect",
                "description": "Designs system architecture and solutions",
                "use_when": "Planning new features, refactoring, system design"
            },
            {
                "type": "reasoner",
                "description": "Handles complex reasoning and problem-solving",
                "use_when": "Complex logic, trade-off analysis, planning"
            }
        ]
    }

@app.get("/tools/available")
async def get_available_tools():
    """Get list of available MCP tools"""
    return {
        "tools": get_tool_descriptions(),
        "total": len(ALL_MCP_TOOLS),
        "categories": {
            "filesystem": len(FILESYSTEM_TOOLS),
            "terminal": len(TERMINAL_TOOLS),
            "web_search": len(WEBSEARCH_TOOLS),
            "memory": len(MEMORY_TOOLS),
            "m365": len(M365_TOOLS)
        }
    }

@app.post("/agent/execute-with-tools")
async def execute_agent_with_tools(request: Dict[str, Any]):
    """Execute agent with access to MCP tools"""
    
    start_time = datetime.now()
    
    try:
        task = request.get("task")
        agent_type = request.get("agent_type", "code_generator")
        tool_set = request.get("tool_set", "essential")  # essential, research, development, all
        temperature = request.get("temperature", 0.7)
        max_iterations = request.get("max_iterations", 10)
        
        if not task:
            raise HTTPException(status_code=400, detail="Task is required")
        
        # Select tools based on tool_set
        tools_map = {
            "essential": ESSENTIAL_TOOLS,
            "research": RESEARCH_TOOLS,
            "development": DEVELOPMENT_TOOLS,
            "filesystem": FILESYSTEM_TOOLS,
            "terminal": TERMINAL_TOOLS,
            "web_search": WEBSEARCH_TOOLS,
            "memory": MEMORY_TOOLS,
            "m365": M365_TOOLS,
            "all": ALL_MCP_TOOLS
        }
        
        selected_tools = tools_map.get(tool_set, ESSENTIAL_TOOLS)
        
        # Get LLM config with tools
        llm_config = get_llm_config(temperature, tools=selected_tools)
        
        # Create agent based on type
        agent_creators = {
            'code_generator': AgentFactory.create_code_generator,
            'code_reviewer': AgentFactory.create_code_reviewer,
            'architect': AgentFactory.create_architect,
            'reasoner': AgentFactory.create_reasoner,
        }
        
        if agent_type not in agent_creators:
            raise HTTPException(status_code=400, detail=f"Invalid agent_type: {agent_type}")
        
        agent = agent_creators[agent_type](llm_config)
        
        # Create user proxy that can execute functions
        user_proxy = autogen.UserProxyAgent(
            name="ToolExecutor",
            human_input_mode="NEVER",
            max_consecutive_auto_reply=max_iterations,
            code_execution_config=False,  # We're using function calling, not code execution
            function_map={tool.__name__: tool for tool in selected_tools}
        )
        
        # Execute task
        chat_result = user_proxy.initiate_chat(
            agent,
            message=task
        )
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        return {
            "success": True,
            "result": chat_result.summary if hasattr(chat_result, 'summary') else str(chat_result),
            "agent_type": agent_type,
            "tools_used": tool_set,
            "tools_available": len(selected_tools),
            "iterations": len(chat_result.chat_history) if hasattr(chat_result, 'chat_history') else 1,
            "execution_time": execution_time,
            "metadata": {
                "temperature": temperature,
                "max_iterations": max_iterations
            }
        }
        
    except Exception as e:
        execution_time = (datetime.now() - start_time).total_seconds()
        return {
            "success": False,
            "error": str(e),
            "execution_time": execution_time
        }

@app.post("/agent/research-task")
async def research_task(request: Dict[str, Any]):
    """Execute research task with web search and memory tools"""
    
    start_time = datetime.now()
    
    try:
        task = request.get("task")
        if not task:
            raise HTTPException(status_code=400, detail="Task is required")
        
        # Create researcher with research tools
        llm_config = get_llm_config(0.7, tools=RESEARCH_TOOLS)
        
        researcher = autogen.AssistantAgent(
            name="Researcher",
            system_message="""You are a research specialist.
            
Use available tools to:
- Search the web for current information
- Fetch relevant documentation
- Search memory for past knowledge
- Query M365 documentation if relevant

Provide comprehensive, well-researched answers.""",
            llm_config=llm_config
        )
        
        executor = autogen.UserProxyAgent(
            name="ResearchExecutor",
            human_input_mode="NEVER",
            max_consecutive_auto_reply=10,
            function_map={tool.__name__: tool for tool in RESEARCH_TOOLS}
        )
        
        chat_result = executor.initiate_chat(researcher, message=task)
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        return {
            "success": True,
            "result": chat_result.summary if hasattr(chat_result, 'summary') else str(chat_result),
            "tools_available": ["web_search", "web_fetch_page", "memory_search", "m365_get_knowledge"],
            "execution_time": execution_time
        }
        
    except Exception as e:
        execution_time = (datetime.now() - start_time).total_seconds()
        return {
            "success": False,
            "error": str(e),
            "execution_time": execution_time
        }

@app.post("/agent/code-with-tools")
async def code_with_tools(request: Dict[str, Any]):
    """Execute coding task with file access and terminal tools"""
    
    start_time = datetime.now()
    
    try:
        task = request.get("task")
        if not task:
            raise HTTPException(status_code=400, detail="Task is required")
        
        # Create coder with development tools
        llm_config = get_llm_config(0.7, tools=DEVELOPMENT_TOOLS)
        
        coder = autogen.AssistantAgent(
            name="Developer",
            system_message="""You are an expert developer.
            
Use available tools to:
- Read existing code files
- Write new or modified code
- List directory contents
- Execute commands (tests, linting, etc.)
- Get M365 code snippets when needed

Generate production-ready code with proper error handling.""",
            llm_config=llm_config
        )
        
        executor = autogen.UserProxyAgent(
            name="DevExecutor",
            human_input_mode="NEVER",
            max_consecutive_auto_reply=15,
            function_map={tool.__name__: tool for tool in DEVELOPMENT_TOOLS}
        )
        
        chat_result = executor.initiate_chat(coder, message=task)
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        return {
            "success": True,
            "result": chat_result.summary if hasattr(chat_result, 'summary') else str(chat_result),
            "tools_available": [
                "filesystem_read_file", 
                "filesystem_write_file",
                "filesystem_list_directory",
                "terminal_execute_command",
                "m365_get_code_snippets"
            ],
            "execution_time": execution_time
        }
        
    except Exception as e:
        execution_time = (datetime.now() - start_time).total_seconds()
        return {
            "success": False,
            "error": str(e),
            "execution_time": execution_time
        }

@app.get("/agent/types")
async def get_agent_types():
    """Get available agent types"""
    return {
        "agent_types": [
            {
                "type": "code_generator",
                "description": "Generates production-ready code",
                "use_when": "Creating new features, components, or modules"
            },
            {
                "type": "code_reviewer",
                "description": "Reviews code for quality and issues",
                "use_when": "Validating code quality, finding bugs"
            },
            {
                "type": "architect",
                "description": "Designs system architecture and solutions",
                "use_when": "Planning new features, refactoring, system design"
            },
            {
                "type": "reasoner",
                "description": "Handles complex reasoning and problem-solving",
                "use_when": "Complex logic, trade-off analysis, planning"
            }
        ]
    }

# ============================================================================
# ADVANCED FEATURES - Code Execution, Multi-Agent Coordination, Analytics, Custom Tools
# ============================================================================

# Initialize advanced feature instances
code_sandbox = CodeExecutionSandbox()
coordinator = MultiAgentCoordinator()

@app.post("/agent/execute-with-sandbox")
async def execute_code_with_sandbox(request: Dict[str, Any]):
    """
    Execute code with automatic testing and iteration.
    Agent generates code, tests it, and iterates until it works.
    """
    
    start_time = datetime.now()
    
    try:
        task = request.get("task")
        language = request.get("language", "python")
        max_iterations = request.get("max_iterations", 3)
        use_team_review = request.get("use_team_review", False)
        
        if not task:
            raise HTTPException(status_code=400, detail="Task is required")
        
        # Track tool usage
        analytics.log_tool_call(
            tool_name="code_execution_sandbox",
            success=True,
            execution_time=0,  # Will update at end
            task_type="code_generation",
            agent_name="code_sandbox"
        )
        
        # Execute with testing or team review
        if use_team_review:
            result = code_sandbox.execute_with_team_review(task, language, max_iterations)
        else:
            result = code_sandbox.execute_with_testing(task, language, max_iterations)
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        # Update analytics
        analytics.log_tool_call(
            tool_name="code_execution_sandbox",
            success=result["success"],
            execution_time=execution_time,
            task_type="code_generation",
            agent_name="code_sandbox"
        )
        
        return {
            **result,
            "execution_time": execution_time,
            "feature": "code_execution_sandbox"
        }
        
    except Exception as e:
        execution_time = (datetime.now() - start_time).total_seconds()
        
        analytics.log_tool_call(
            tool_name="code_execution_sandbox",
            success=False,
            execution_time=execution_time,
            task_type="code_generation",
            agent_name="code_sandbox",
            error=str(e)
        )
        
        return {
            "success": False,
            "error": str(e),
            "execution_time": execution_time
        }

@app.post("/agent/coordinated-pipeline")
async def coordinated_pipeline(request: Dict[str, Any]):
    """
    Sequential multi-agent pipeline: Researcher → Architect → Coder → Reviewer.
    Agents collaborate using shared tools to complete complex tasks.
    """
    
    start_time = datetime.now()
    
    try:
        task = request.get("task")
        tools = request.get("tools", ESSENTIAL_TOOLS)
        
        if not task:
            raise HTTPException(status_code=400, detail="Task is required")
        
        analytics.log_tool_call(
            tool_name="coordinated_pipeline",
            success=True,
            execution_time=0,
            task_type="multi_agent_collaboration",
            agent_name="coordinator"
        )
        
        result = coordinator.research_plan_code_pipeline(task, tools)
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        analytics.log_tool_call(
            tool_name="coordinated_pipeline",
            success=result["success"],
            execution_time=execution_time,
            task_type="multi_agent_collaboration",
            agent_name="coordinator"
        )
        
        return {
            **result,
            "execution_time": execution_time,
            "feature": "multi_agent_coordination"
        }
        
    except Exception as e:
        execution_time = (datetime.now() - start_time).total_seconds()
        
        analytics.log_tool_call(
            tool_name="coordinated_pipeline",
            success=False,
            execution_time=execution_time,
            task_type="multi_agent_collaboration",
            agent_name="coordinator",
            error=str(e)
        )
        
        return {
            "success": False,
            "error": str(e),
            "execution_time": execution_time
        }

@app.post("/agent/parallel-explore")
async def parallel_explore(request: Dict[str, Any]):
    """
    Parallel multi-agent exploration.
    Multiple agents explore different approaches, then a judge picks the best solution.
    """
    
    start_time = datetime.now()
    
    try:
        problem = request.get("problem")
        approaches = request.get("approaches", [])
        tools = request.get("tools", ESSENTIAL_TOOLS)
        
        if not problem:
            raise HTTPException(status_code=400, detail="Problem is required")
        
        if not approaches or len(approaches) < 2:
            raise HTTPException(
                status_code=400, 
                detail="At least 2 approaches required for parallel exploration"
            )
        
        analytics.log_tool_call(
            tool_name="parallel_exploration",
            success=True,
            execution_time=0,
            task_type="multi_agent_collaboration",
            agent_name="coordinator"
        )
        
        result = coordinator.parallel_exploration(problem, approaches, tools)
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        analytics.log_tool_call(
            tool_name="parallel_exploration",
            success=result["success"],
            execution_time=execution_time,
            task_type="multi_agent_collaboration",
            agent_name="coordinator"
        )
        
        return {
            **result,
            "execution_time": execution_time,
            "feature": "multi_agent_coordination"
        }
        
    except Exception as e:
        execution_time = (datetime.now() - start_time).total_seconds()
        
        analytics.log_tool_call(
            tool_name="parallel_exploration",
            success=False,
            execution_time=execution_time,
            task_type="multi_agent_collaboration",
            agent_name="coordinator",
            error=str(e)
        )
        
        return {
            "success": False,
            "error": str(e),
            "execution_time": execution_time
        }

@app.post("/agent/collaborative-debug")
async def collaborative_debug(request: Dict[str, Any]):
    """
    Collaborative debugging team: Analyzer → Fixer → Validator.
    Multiple agents work together to debug and fix code issues.
    """
    
    start_time = datetime.now()
    
    try:
        code = request.get("code")
        error_message = request.get("error_message")
        tools = request.get("tools", DEVELOPMENT_TOOLS)
        
        if not code or not error_message:
            raise HTTPException(
                status_code=400, 
                detail="Both code and error_message are required"
            )
        
        analytics.log_tool_call(
            tool_name="collaborative_debugging",
            success=True,
            execution_time=0,
            task_type="debugging",
            agent_name="coordinator"
        )
        
        result = coordinator.collaborative_debugging(code, error_message, tools)
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        analytics.log_tool_call(
            tool_name="collaborative_debugging",
            success=result["success"],
            execution_time=execution_time,
            task_type="debugging",
            agent_name="coordinator"
        )
        
        return {
            **result,
            "execution_time": execution_time,
            "feature": "multi_agent_coordination"
        }
        
    except Exception as e:
        execution_time = (datetime.now() - start_time).total_seconds()
        
        analytics.log_tool_call(
            tool_name="collaborative_debugging",
            success=False,
            execution_time=execution_time,
            task_type="debugging",
            agent_name="coordinator",
            error=str(e)
        )
        
        return {
            "success": False,
            "error": str(e),
            "execution_time": execution_time
        }

# ============================================================================
# ANALYTICS ENDPOINTS
# ============================================================================

@app.get("/analytics/tool-usage")
async def get_tool_usage(tool_name: Optional[str] = None):
    """Get tool usage statistics"""
    try:
        if tool_name:
            return analytics.get_tool_stats(tool_name)
        else:
            return {
                "most_used": analytics.get_most_used_tools(10),
                "by_agent": analytics.get_agent_tool_usage(),
                "by_task": analytics.get_task_type_insights(),
                "performance": analytics.get_performance_insights()
            }
    except Exception as e:
        return {"error": str(e)}

@app.get("/analytics/comprehensive-report")
async def get_comprehensive_analytics():
    """Get comprehensive analytics report"""
    try:
        return analytics.get_comprehensive_report()
    except Exception as e:
        return {"error": str(e)}

@app.post("/analytics/clear")
async def clear_analytics(days: int = 30):
    """Clear analytics data older than specified days"""
    try:
        return analytics.clear_old_data(days)
    except Exception as e:
        return {"error": str(e)}

# ============================================================================
# CUSTOM TOOLS ENDPOINTS
# ============================================================================

@app.post("/tools/register-custom")
async def register_custom_tool(request: Dict[str, Any]):
    """
    Register a custom tool.
    
    Example:
        {
            "name": "my_tool",
            "description": "Does something useful",
            "code": "def my_tool(x: int) -> str:\\n    return f'Result: {x}'",
            "category": "custom"
        }
    """
    try:
        name = request.get("name")
        description = request.get("description")
        code = request.get("code")
        category = request.get("category", "custom")
        
        if not name or not description or not code:
            raise HTTPException(
                status_code=400,
                detail="name, description, and code are required"
            )
        
        # Execute code to get function
        exec_globals = {}
        exec(code, exec_globals)
        
        # Find the function (should be the last defined function)
        func = None
        for key, value in exec_globals.items():
            if callable(value) and not key.startswith('_'):
                func = value
                break
        
        if not func:
            raise HTTPException(
                status_code=400,
                detail="No function found in provided code"
            )
        
        # Register tool
        tool = add_custom_tool(name, description, func, category)
        
        return {
            "success": True,
            "message": f"Tool '{name}' registered successfully",
            "tool_info": tool.get_info()
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/tools/custom")
async def get_custom_tools(category: Optional[str] = None):
    """Get custom tools"""
    try:
        if category:
            tools = registry.get_tools_by_category(category)
            return {
                "category": category,
                "tools": [t.get_info() for t in tools]
            }
        else:
            return {
                "all_tools": registry.get_tools_list(),
                "statistics": registry.get_statistics()
            }
    except Exception as e:
        return {"error": str(e)}

@app.delete("/tools/custom/{tool_name}")
async def remove_custom_tool(tool_name: str):
    """Remove a custom tool"""
    try:
        success = registry.remove_tool(tool_name)
        
        if success:
            return {
                "success": True,
                "message": f"Tool '{tool_name}' removed successfully"
            }
        else:
            return {
                "success": False,
                "message": f"Tool '{tool_name}' not found"
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/agent/execute-with-custom-tools")
async def execute_agent_with_custom_tools(request: Dict[str, Any]):
    """Execute agent with custom tools"""
    
    start_time = datetime.now()
    
    try:
        task = request.get("task")
        agent_type = request.get("agent_type", "code_generator")
        tool_categories = request.get("tool_categories", None)  # None = all custom tools
        include_mcp_tools = request.get("include_mcp_tools", True)
        temperature = request.get("temperature", 0.7)
        max_iterations = request.get("max_iterations", 10)
        
        if not task:
            raise HTTPException(status_code=400, detail="Task is required")
        
        # Get custom tools
        custom_tools = get_custom_tools_for_agents(tool_categories)
        
        # Combine with MCP tools if requested
        tools = custom_tools
        if include_mcp_tools:
            tools = tools + ESSENTIAL_TOOLS
        
        # Get LLM config with tools
        llm_config = get_llm_config(temperature, tools=tools)
        
        # Create agent
        agent_creators = {
            'code_generator': AgentFactory.create_code_generator,
            'code_reviewer': AgentFactory.create_code_reviewer,
            'architect': AgentFactory.create_architect,
            'reasoner': AgentFactory.create_reasoner,
        }
        
        if agent_type not in agent_creators:
            raise HTTPException(status_code=400, detail=f"Invalid agent_type: {agent_type}")
        
        agent = agent_creators[agent_type](llm_config)
        
        # Create user proxy
        user_proxy = autogen.UserProxyAgent(
            name="ToolExecutor",
            human_input_mode="NEVER",
            max_consecutive_auto_reply=max_iterations,
            code_execution_config=False,
            function_map={tool.__name__: tool for tool in tools}
        )
        
        # Execute task
        chat_result = user_proxy.initiate_chat(agent, message=task)
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        return {
            "success": True,
            "result": chat_result.summary if hasattr(chat_result, 'summary') else str(chat_result),
            "agent_type": agent_type,
            "custom_tools_count": len(custom_tools),
            "total_tools": len(tools),
            "iterations": len(chat_result.chat_history) if hasattr(chat_result, 'chat_history') else 1,
            "execution_time": execution_time,
            "feature": "custom_tools"
        }
        
    except Exception as e:
        execution_time = (datetime.now() - start_time).total_seconds()
        return {
            "success": False,
            "error": str(e),
            "execution_time": execution_time
        }

# ============================================================================
# TASK DECOMPOSITION - AI agents break down complex tasks automatically
# ============================================================================

@app.post("/task/decompose")
async def decompose_task(request: Dict[str, Any]):
    """
    Decompose a complex task into trackable subtasks.
    AI agent automatically analyzes the task and creates a breakdown.
    
    Example:
        {
            "task": "Build a user authentication system with JWT",
            "temperature": 0.7
        }
    """
    start_time = datetime.now()
    
    try:
        task_description = request.get("task")
        temperature = request.get("temperature", 0.7)
        
        if not task_description:
            raise HTTPException(status_code=400, detail="Task description is required")
        
        # Get LLM config
        llm_config = get_llm_config(temperature)
        
        # Create decomposer
        decomposer = TaskDecomposer(llm_config)
        
        # Decompose task
        task = decomposer.decompose_task(task_description)
        
        # Store task
        task_id = task_manager.create_task(task)
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        return {
            "success": True,
            "task_id": task_id,
            "task": task.to_dict(),
            "execution_time": execution_time,
            "message": "Task decomposed successfully. Use /task/{task_id}/next to get the first subtask."
        }
        
    except Exception as e:
        execution_time = (datetime.now() - start_time).total_seconds()
        return {
            "success": False,
            "error": str(e),
            "execution_time": execution_time
        }

@app.get("/task/{task_id}")
async def get_task_status(task_id: str):
    """Get task status and progress"""
    try:
        task = task_manager.get_task(task_id)
        
        if not task:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
        
        return {
            "success": True,
            "task": task.to_dict()
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/task/{task_id}/progress")
async def get_task_progress(task_id: str):
    """Get simplified task progress"""
    try:
        task = task_manager.get_task(task_id)
        
        if not task:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
        
        progress = task.get_progress()
        
        return {
            "success": True,
            "progress": progress
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/task/{task_id}/next")
async def get_next_subtask(task_id: str):
    """Get the next subtask that can be executed"""
    try:
        task = task_manager.get_task(task_id)
        
        if not task:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
        
        next_subtask = task.get_next_subtask()
        
        if not next_subtask:
            # Check if task is complete
            progress = task.get_progress()
            if progress["is_complete"]:
                return {
                    "success": True,
                    "message": "All subtasks completed!",
                    "task_complete": True
                }
            else:
                return {
                    "success": True,
                    "message": "No subtasks available (check dependencies or blocked tasks)",
                    "task_complete": False
                }
        
        return {
            "success": True,
            "subtask": next_subtask.to_dict(),
            "message": f"Next subtask: {next_subtask.title}"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/task/{task_id}/subtask/{subtask_id}/start")
async def start_subtask(task_id: str, subtask_id: str):
    """Mark a subtask as in progress"""
    try:
        success = task_manager.update_subtask(
            task_id,
            subtask_id,
            status="in_progress"
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Task or subtask not found")
        
        return {
            "success": True,
            "message": f"Subtask {subtask_id} started"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/task/{task_id}/subtask/{subtask_id}/complete")
async def complete_subtask(task_id: str, subtask_id: str, request: Dict[str, Any]):
    """Mark a subtask as completed"""
    try:
        result = request.get("result", "Completed successfully")
        
        success = task_manager.update_subtask(
            task_id,
            subtask_id,
            status="completed",
            result=result
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Task or subtask not found")
        
        # Get updated progress
        task = task_manager.get_task(task_id)
        progress = task.get_progress()
        
        return {
            "success": True,
            "message": f"Subtask {subtask_id} completed",
            "progress": progress
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/task/{task_id}/subtask/{subtask_id}/fail")
async def fail_subtask(task_id: str, subtask_id: str, request: Dict[str, Any]):
    """Mark a subtask as failed"""
    try:
        error = request.get("error", "Unknown error")
        
        success = task_manager.update_subtask(
            task_id,
            subtask_id,
            status="failed",
            error=error
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Task or subtask not found")
        
        return {
            "success": True,
            "message": f"Subtask {subtask_id} marked as failed"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/task/{task_id}/execute-next")
async def execute_next_subtask(task_id: str):
    """
    Automatically execute the next available subtask using appropriate agent.
    This combines get_next + execute with agent in one call.
    """
    start_time = datetime.now()
    
    try:
        task = task_manager.get_task(task_id)
        
        if not task:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
        
        # Get next subtask
        next_subtask = task.get_next_subtask()
        
        if not next_subtask:
            progress = task.get_progress()
            if progress["is_complete"]:
                return {
                    "success": True,
                    "message": "All subtasks completed!",
                    "task_complete": True,
                    "progress": progress
                }
            else:
                return {
                    "success": False,
                    "message": "No subtasks available",
                    "progress": progress
                }
        
        # Mark as in progress
        task_manager.update_subtask(task_id, next_subtask.id, status="in_progress")
        
        # Execute with appropriate agent
        llm_config = get_llm_config(0.7)
        
        agent_creators = {
            'code_generator': AgentFactory.create_code_generator,
            'code_reviewer': AgentFactory.create_code_reviewer,
            'architect': AgentFactory.create_architect,
            'reasoner': AgentFactory.create_reasoner,
        }
        
        agent_creator = agent_creators.get(
            next_subtask.agent_type,
            AgentFactory.create_code_generator
        )
        
        agent = agent_creator(llm_config)
        
        user_proxy = autogen.UserProxyAgent(
            name="Executor",
            human_input_mode="NEVER",
            max_consecutive_auto_reply=10,
            code_execution_config=False
        )
        
        # Execute subtask
        chat_result = user_proxy.initiate_chat(
            agent,
            message=f"{next_subtask.description}\n\nContext: Part of larger task: {task.description}"
        )
        
        result = chat_result.summary if hasattr(chat_result, 'summary') else str(chat_result)
        
        # Mark as completed
        task_manager.update_subtask(
            task_id,
            next_subtask.id,
            status="completed",
            result=result
        )
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        # Get updated progress
        progress = task.get_progress()
        
        return {
            "success": True,
            "subtask_id": next_subtask.id,
            "subtask_title": next_subtask.title,
            "result": result,
            "execution_time": execution_time,
            "progress": progress
        }
        
    except Exception as e:
        # Mark as failed if we started
        if 'next_subtask' in locals():
            task_manager.update_subtask(
                task_id,
                next_subtask.id,
                status="failed",
                error=str(e)
            )
        
        execution_time = (datetime.now() - start_time).total_seconds()
        return {
            "success": False,
            "error": str(e),
            "execution_time": execution_time
        }

@app.post("/task/{task_id}/execute-all")
async def execute_all_subtasks(task_id: str):
    """
    Execute all subtasks in sequence (respecting dependencies).
    This will run the entire task automatically!
    """
    start_time = datetime.now()
    results = []
    
    try:
        task = task_manager.get_task(task_id)
        
        if not task:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
        
        # Execute subtasks one by one
        while True:
            next_subtask = task.get_next_subtask()
            
            if not next_subtask:
                break
            
            # Execute this subtask
            response = await execute_next_subtask(task_id)
            results.append(response)
            
            # Stop if failed
            if not response.get("success"):
                break
        
        execution_time = (datetime.now() - start_time).total_seconds()
        progress = task.get_progress()
        
        return {
            "success": True,
            "task_id": task_id,
            "subtasks_executed": len(results),
            "results": results,
            "progress": progress,
            "total_execution_time": execution_time,
            "message": "All subtasks completed!" if progress["is_complete"] else "Execution stopped (failed or blocked tasks)"
        }
        
    except Exception as e:
        execution_time = (datetime.now() - start_time).total_seconds()
        return {
            "success": False,
            "error": str(e),
            "results": results,
            "total_execution_time": execution_time
        }

@app.get("/tasks")
async def get_all_tasks():
    """Get all tasks"""
    try:
        tasks = task_manager.get_all_tasks()
        
        return {
            "success": True,
            "tasks": tasks,
            "total": len(tasks)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@app.delete("/task/{task_id}")
async def delete_task(task_id: str):
    """Delete a task"""
    try:
        success = task_manager.delete_task(task_id)
        
        if not success:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
        
        return {
            "success": True,
            "message": f"Task {task_id} deleted"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    print("🐍 Starting HybridMind Python AI Service...")
    print("📡 Service will be available at: http://localhost:8000")
    print("📚 API docs at: http://localhost:8000/docs")
    uvicorn.run(app, host="0.0.0.0", port=8000)
