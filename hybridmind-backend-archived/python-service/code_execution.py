"""
Code Execution Sandbox - AutoGen agents can test code they generate

Uses Docker containers for safe code execution.
Agents write code, test it, fix issues, repeat until working.
"""

from typing import Annotated, Optional, Dict, Any
import autogen
import os
from datetime import datetime

def get_llm_config_for_execution(temperature: float = 0.7):
    """Get LLM config optimized for code execution tasks"""
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    
    if openrouter_key:
        return {
            "config_list": [{
                "model": "anthropic/claude-3.5-sonnet",  # Good at code generation
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

class CodeExecutionSandbox:
    """
    Safe code execution environment using Docker.
    Agents can write, test, and iterate on code until it works.
    """
    
    def __init__(self, use_docker: bool = True, work_dir: str = "./workspace"):
        self.use_docker = use_docker
        self.work_dir = work_dir
        self.execution_history = []
        
        # Ensure workspace exists
        os.makedirs(work_dir, exist_ok=True)
    
    def create_coder_agent(self, llm_config):
        """Create agent that generates code"""
        return autogen.AssistantAgent(
            name="Coder",
            system_message="""You are an expert programmer.

Your role:
- Write clear, working code
- Include error handling
- Add tests when appropriate
- Fix issues based on execution feedback
- Iterate until code works perfectly

Always write complete, runnable code.""",
            llm_config=llm_config
        )
    
    def create_executor_agent(self, max_iterations: int = 10):
        """Create agent that executes and tests code"""
        return autogen.UserProxyAgent(
            name="CodeExecutor",
            human_input_mode="NEVER",
            max_consecutive_auto_reply=max_iterations,
            code_execution_config={
                "use_docker": self.use_docker,
                "timeout": 60,
                "work_dir": self.work_dir,
                "last_n_messages": 3
            }
        )
    
    def create_tester_agent(self, llm_config):
        """Create agent that reviews test results"""
        return autogen.AssistantAgent(
            name="Tester",
            system_message="""You are a QA engineer.

Your role:
- Review code execution results
- Identify issues and bugs
- Suggest improvements
- Verify edge cases
- Approve when code works correctly

Be thorough but constructive.""",
            llm_config=llm_config
        )
    
    async def execute_with_testing(
        self,
        task: str,
        programming_language: str = "python",
        max_iterations: int = 10,
        temperature: float = 0.7
    ) -> Dict[str, Any]:
        """
        Execute task with automatic code testing and iteration.
        
        Flow:
        1. Coder generates code
        2. Executor runs it
        3. If errors, Coder fixes and repeats
        4. Returns working code + results
        """
        
        start_time = datetime.now()
        
        llm_config = get_llm_config_for_execution(temperature)
        
        # Create agents
        coder = self.create_coder_agent(llm_config)
        executor = self.create_executor_agent(max_iterations)
        
        # Enhance task with language specification
        enhanced_task = f"""
{task}

Requirements:
- Programming language: {programming_language}
- Write complete, runnable code
- Include simple tests to verify it works
- Handle errors gracefully

The code will be executed automatically. Iterate until it runs successfully.
"""
        
        # Execute conversation
        chat_result = executor.initiate_chat(
            coder,
            message=enhanced_task
        )
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        # Extract code and results from chat history
        code_blocks = self._extract_code_blocks(chat_result)
        execution_results = self._extract_execution_results(chat_result)
        
        # Log execution
        execution_record = {
            "task": task,
            "language": programming_language,
            "iterations": len(chat_result.chat_history) if hasattr(chat_result, 'chat_history') else 1,
            "execution_time": execution_time,
            "success": not self._has_errors(execution_results),
            "code_blocks": len(code_blocks),
            "timestamp": datetime.now().isoformat()
        }
        self.execution_history.append(execution_record)
        
        return {
            "success": not self._has_errors(execution_results),
            "code": code_blocks[-1] if code_blocks else "",
            "all_code_versions": code_blocks,
            "execution_results": execution_results,
            "iterations": execution_record["iterations"],
            "execution_time": execution_time,
            "chat_history": chat_result.chat_history if hasattr(chat_result, 'chat_history') else [],
            "summary": chat_result.summary if hasattr(chat_result, 'summary') else "Execution completed"
        }
    
    async def execute_with_team_review(
        self,
        task: str,
        programming_language: str = "python",
        temperature: float = 0.7
    ) -> Dict[str, Any]:
        """
        Execute with code review by tester agent.
        
        Flow:
        1. Coder generates code
        2. Executor runs it
        3. Tester reviews results
        4. Repeat until approved
        """
        
        start_time = datetime.now()
        
        llm_config = get_llm_config_for_execution(temperature)
        
        # Create team
        coder = self.create_coder_agent(llm_config)
        executor = self.create_executor_agent(15)
        tester = self.create_tester_agent(llm_config)
        
        # Create group chat
        groupchat = autogen.GroupChat(
            agents=[coder, executor, tester],
            messages=[],
            max_round=20,
            speaker_selection_method="round_robin"
        )
        
        manager = autogen.GroupChatManager(groupchat=groupchat, llm_config=llm_config)
        
        # Execute with team
        enhanced_task = f"""
{task}

Language: {programming_language}

Process:
1. Coder: Write the code
2. Executor: Run and test it
3. Tester: Review results, suggest improvements
4. Repeat until code works perfectly
"""
        
        chat_result = executor.initiate_chat(
            manager,
            message=enhanced_task
        )
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        code_blocks = self._extract_code_blocks(chat_result)
        
        return {
            "success": True,
            "code": code_blocks[-1] if code_blocks else "",
            "iterations": len(groupchat.messages),
            "execution_time": execution_time,
            "team_conversation": groupchat.messages,
            "final_result": groupchat.messages[-1]["content"] if groupchat.messages else ""
        }
    
    def _extract_code_blocks(self, chat_result) -> list:
        """Extract code blocks from chat history"""
        code_blocks = []
        
        if hasattr(chat_result, 'chat_history'):
            for message in chat_result.chat_history:
                content = message.get("content", "")
                # Look for code blocks
                if "```" in content:
                    blocks = content.split("```")
                    for i, block in enumerate(blocks):
                        if i % 2 == 1:  # Odd indices are code blocks
                            # Remove language identifier
                            lines = block.split('\n')
                            if lines[0].strip() in ['python', 'javascript', 'typescript', 'java', 'cpp', 'c', 'go', 'rust']:
                                code = '\n'.join(lines[1:])
                            else:
                                code = block
                            code_blocks.append(code.strip())
        
        return code_blocks
    
    def _extract_execution_results(self, chat_result) -> list:
        """Extract execution results from chat history"""
        results = []
        
        if hasattr(chat_result, 'chat_history'):
            for message in chat_result.chat_history:
                if message.get("name") == "CodeExecutor":
                    content = message.get("content", "")
                    results.append(content)
        
        return results
    
    def _has_errors(self, execution_results: list) -> bool:
        """Check if execution results contain errors"""
        error_keywords = ["error", "exception", "traceback", "failed", "exit code 1"]
        
        for result in execution_results:
            result_lower = result.lower()
            if any(keyword in result_lower for keyword in error_keywords):
                return True
        
        return False
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get execution statistics"""
        if not self.execution_history:
            return {"message": "No executions yet"}
        
        total = len(self.execution_history)
        successful = sum(1 for ex in self.execution_history if ex["success"])
        
        avg_iterations = sum(ex["iterations"] for ex in self.execution_history) / total
        avg_time = sum(ex["execution_time"] for ex in self.execution_history) / total
        
        return {
            "total_executions": total,
            "successful": successful,
            "success_rate": f"{(successful/total)*100:.1f}%",
            "average_iterations": round(avg_iterations, 1),
            "average_time": round(avg_time, 2),
            "languages": list(set(ex["language"] for ex in self.execution_history))
        }

# Global sandbox instance
sandbox = CodeExecutionSandbox(
    use_docker=os.getenv("USE_DOCKER_SANDBOX", "false").lower() == "true",
    work_dir="./workspace"
)
