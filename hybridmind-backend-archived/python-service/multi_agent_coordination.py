"""
Multi-Agent Tool Coordination

Agents collaborate by sharing tool results and coordinating actions.
Example: Researcher searches web → Architect designs → Coder implements → Tester validates
"""

from typing import List, Dict, Any, Optional
import autogen
from datetime import datetime
import os

def get_llm_config(temperature: float = 0.7):
    """Get LLM configuration"""
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    
    if openrouter_key:
        return {
            "config_list": [{
                "model": "anthropic/claude-3.5-sonnet",
                "api_key": openrouter_key,
                "base_url": "https://openrouter.ai/api/v1"
            }],
            "temperature": temperature,
            "timeout": 120,
        }
    
    return {
        "config_list": [{
            "model": "llama3.2",
            "base_url": "http://localhost:11434/v1",
            "api_key": "ollama"
        }],
        "temperature": temperature,
        "timeout": 120,
    }

class MultiAgentCoordinator:
    """
    Coordinates multiple agents working together with shared tools.
    Agents can pass results and build on each other's work.
    """
    
    def __init__(self, tools: List = None):
        self.tools = tools or []
        self.coordination_history = []
    
    async def research_plan_code_pipeline(
        self,
        task: str,
        tools_available: List,
        temperature: float = 0.7
    ) -> Dict[str, Any]:
        """
        Complete pipeline: Research → Plan → Code → Review
        Each agent uses tools and passes results to next agent.
        """
        
        start_time = datetime.now()
        
        llm_config = get_llm_config(temperature)
        
        # Create specialized agents
        researcher = autogen.AssistantAgent(
            name="Researcher",
            system_message="""You are a research specialist.

Your role in the pipeline:
1. Use web_search to find relevant information
2. Use memory_search to check past knowledge
3. Use m365_get_knowledge for Microsoft docs
4. Summarize findings for the team
5. Pass clear, organized research to Architect

Focus on finding best practices and current approaches.""",
            llm_config=llm_config
        )
        
        architect = autogen.AssistantAgent(
            name="Architect",
            system_message="""You are a system architect.

Your role in the pipeline:
1. Review research from Researcher
2. Design solution architecture
3. Plan implementation steps
4. Identify files to create/modify using filesystem_list_directory
5. Pass detailed plan to Coder

Focus on clean, maintainable design.""",
            llm_config=llm_config
        )
        
        coder = autogen.AssistantAgent(
            name="Coder",
            system_message="""You are an expert developer.

Your role in the pipeline:
1. Review architecture from Architect
2. Use filesystem_read_file to understand existing code
3. Generate implementation code
4. Use filesystem_write_file to save code
5. Use terminal_execute_command to test
6. Pass working code to Reviewer

Focus on production-ready code.""",
            llm_config=llm_config
        )
        
        reviewer = autogen.AssistantAgent(
            name="Reviewer",
            system_message="""You are a code reviewer.

Your role in the pipeline:
1. Review code from Coder
2. Use filesystem_read_file to check implementation
3. Verify best practices
4. Use memory_store_knowledge to save learnings
5. Approve or request changes

Focus on quality and correctness.""",
            llm_config=llm_config
        )
        
        # Tool executor
        executor = autogen.UserProxyAgent(
            name="ToolExecutor",
            human_input_mode="NEVER",
            max_consecutive_auto_reply=25,
            code_execution_config=False,
            function_map={tool.__name__: tool for tool in tools_available}
        )
        
        # Create sequential pipeline
        groupchat = autogen.GroupChat(
            agents=[researcher, architect, coder, reviewer, executor],
            messages=[],
            max_round=30,
            speaker_selection_method="round_robin"  # Sequential processing
        )
        
        manager = autogen.GroupChatManager(groupchat=groupchat, llm_config=llm_config)
        
        # Start pipeline
        pipeline_task = f"""
Task: {task}

Pipeline Process:
1. Researcher: Research best practices and approaches
2. Architect: Design solution based on research
3. Coder: Implement the solution
4. Reviewer: Review and approve

Each agent should use available tools and build on previous work.
"""
        
        chat_result = executor.initiate_chat(
            manager,
            message=pipeline_task
        )
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        # Log coordination
        self.coordination_history.append({
            "task": task,
            "agents": ["researcher", "architect", "coder", "reviewer"],
            "pipeline_type": "sequential",
            "execution_time": execution_time,
            "messages": len(groupchat.messages),
            "timestamp": datetime.now().isoformat()
        })
        
        return {
            "success": True,
            "pipeline_type": "research_plan_code_review",
            "agents_involved": 4,
            "messages": groupchat.messages,
            "execution_time": execution_time,
            "final_result": groupchat.messages[-1]["content"] if groupchat.messages else ""
        }
    
    async def parallel_exploration(
        self,
        task: str,
        approaches: List[str],
        tools_available: List,
        temperature: float = 0.7
    ) -> Dict[str, Any]:
        """
        Multiple agents explore different approaches in parallel.
        Then vote on best solution.
        """
        
        start_time = datetime.now()
        
        llm_config = get_llm_config(temperature)
        
        # Create agents for each approach
        explorers = []
        for i, approach in enumerate(approaches):
            agent = autogen.AssistantAgent(
                name=f"Explorer_{i+1}",
                system_message=f"""You are exploring this approach: {approach}

Use available tools to:
1. Research this approach
2. Prototype implementation
3. Test viability
4. Report pros/cons

Be specific and thorough.""",
                llm_config=llm_config
            )
            explorers.append(agent)
        
        # Create judge agent
        judge = autogen.AssistantAgent(
            name="Judge",
            system_message="""You are a technical judge.

Review all approaches presented by explorers:
1. Compare implementations
2. Evaluate trade-offs
3. Consider maintainability
4. Select best approach
5. Explain decision clearly

Be objective and thorough.""",
            llm_config=llm_config
        )
        
        # Tool executor
        executor = autogen.UserProxyAgent(
            name="ToolExecutor",
            human_input_mode="NEVER",
            max_consecutive_auto_reply=20,
            code_execution_config=False,
            function_map={tool.__name__: tool for tool in tools_available}
        )
        
        # Create group chat with all explorers + judge
        all_agents = explorers + [judge, executor]
        
        groupchat = autogen.GroupChat(
            agents=all_agents,
            messages=[],
            max_round=25,
            speaker_selection_method="auto"
        )
        
        manager = autogen.GroupChatManager(groupchat=groupchat, llm_config=llm_config)
        
        # Start parallel exploration
        exploration_task = f"""
Task: {task}

Explore these approaches in parallel:
{chr(10).join(f'{i+1}. {app}' for i, app in enumerate(approaches))}

Each explorer should:
- Research and prototype your assigned approach
- Use tools to validate
- Report findings

Judge will select the best approach after all explorations complete.
"""
        
        chat_result = executor.initiate_chat(
            manager,
            message=exploration_task
        )
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        # Log coordination
        self.coordination_history.append({
            "task": task,
            "agents": len(explorers) + 1,  # explorers + judge
            "coordination_type": "parallel_exploration",
            "approaches": len(approaches),
            "execution_time": execution_time,
            "timestamp": datetime.now().isoformat()
        })
        
        return {
            "success": True,
            "coordination_type": "parallel_exploration",
            "approaches_explored": len(approaches),
            "agents_involved": len(explorers) + 1,
            "conversation": groupchat.messages,
            "execution_time": execution_time,
            "decision": groupchat.messages[-1]["content"] if groupchat.messages else ""
        }
    
    async def collaborative_debugging(
        self,
        code: str,
        error_message: str,
        tools_available: List,
        temperature: float = 0.7
    ) -> Dict[str, Any]:
        """
        Multiple agents collaborate to debug and fix code.
        """
        
        start_time = datetime.now()
        
        llm_config = get_llm_config(temperature)
        
        # Create debugging team
        analyzer = autogen.AssistantAgent(
            name="Analyzer",
            system_message="""You are a bug analyst.

Your role:
1. Analyze the error message
2. Use web_search for similar issues
3. Use memory_search for past solutions
4. Identify root cause
5. Suggest fix approach

Be systematic and thorough.""",
            llm_config=llm_config
        )
        
        fixer = autogen.AssistantAgent(
            name="Fixer",
            system_message="""You are a bug fixer.

Your role:
1. Review analysis from Analyzer
2. Implement fix
3. Use filesystem operations if needed
4. Test the fix
5. Verify it works

Focus on minimal, clean fixes.""",
            llm_config=llm_config
        )
        
        validator = autogen.AssistantAgent(
            name="Validator",
            system_message="""You are a validation specialist.

Your role:
1. Review the fix
2. Test edge cases
3. Verify no regressions
4. Use terminal_execute_command to run tests
5. Approve or request changes

Be thorough and cautious.""",
            llm_config=llm_config
        )
        
        executor = autogen.UserProxyAgent(
            name="ToolExecutor",
            human_input_mode="NEVER",
            max_consecutive_auto_reply=20,
            code_execution_config=False,
            function_map={tool.__name__: tool for tool in tools_available}
        )
        
        groupchat = autogen.GroupChat(
            agents=[analyzer, fixer, validator, executor],
            messages=[],
            max_round=20,
            speaker_selection_method="round_robin"
        )
        
        manager = autogen.GroupChatManager(groupchat=groupchat, llm_config=llm_config)
        
        debug_task = f"""
Debug this code:

```
{code}
```

Error: {error_message}

Team process:
1. Analyzer: Find root cause
2. Fixer: Implement solution
3. Validator: Verify fix works
"""
        
        chat_result = executor.initiate_chat(
            manager,
            message=debug_task
        )
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        return {
            "success": True,
            "coordination_type": "collaborative_debugging",
            "agents_involved": 3,
            "execution_time": execution_time,
            "fixed_code": self._extract_final_code(groupchat.messages),
            "conversation": groupchat.messages
        }
    
    def _extract_final_code(self, messages: List) -> str:
        """Extract final code version from messages"""
        for message in reversed(messages):
            content = message.get("content", "")
            if "```" in content:
                blocks = content.split("```")
                for block in blocks[1::2]:  # Odd indices are code blocks
                    lines = block.split('\n')
                    if len(lines) > 1:
                        return '\n'.join(lines[1:]).strip()
        return ""
    
    def get_coordination_stats(self) -> Dict[str, Any]:
        """Get coordination statistics"""
        if not self.coordination_history:
            return {"message": "No coordinations yet"}
        
        total = len(self.coordination_history)
        
        coordination_types = {}
        for coord in self.coordination_history:
            coord_type = coord.get("coordination_type", coord.get("pipeline_type", "unknown"))
            coordination_types[coord_type] = coordination_types.get(coord_type, 0) + 1
        
        avg_time = sum(c["execution_time"] for c in self.coordination_history) / total
        total_agents = sum(c.get("agents", c.get("agents_involved", 0)) for c in self.coordination_history)
        
        return {
            "total_coordinations": total,
            "coordination_types": coordination_types,
            "average_execution_time": round(avg_time, 2),
            "total_agents_used": total_agents,
            "average_agents_per_task": round(total_agents / total, 1)
        }

# Global coordinator instance
coordinator = MultiAgentCoordinator()
