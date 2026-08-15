"""
Task Decomposition System

Agents automatically break down complex tasks into trackable subtasks.
Monitors progress and manages task execution workflow.
"""

from typing import List, Dict, Any, Optional, Annotated
from datetime import datetime
from enum import Enum
import json
import os
import uuid
import autogen

class TaskStatus(Enum):
    """Task status enumeration"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    BLOCKED = "blocked"

class SubTask:
    """Represents a single subtask"""
    
    def __init__(
        self,
        id: str,
        title: str,
        description: str,
        dependencies: List[str] = None,
        estimated_complexity: str = "medium",
        agent_type: str = "code_generator"
    ):
        self.id = id
        self.title = title
        self.description = description
        self.dependencies = dependencies or []
        self.estimated_complexity = estimated_complexity  # low, medium, high
        self.agent_type = agent_type
        self.status = TaskStatus.PENDING
        self.result = None
        self.error = None
        self.started_at = None
        self.completed_at = None
        self.execution_time = None
    
    def start(self):
        """Mark subtask as in progress"""
        self.status = TaskStatus.IN_PROGRESS
        self.started_at = datetime.now()
    
    def complete(self, result: str):
        """Mark subtask as completed"""
        self.status = TaskStatus.COMPLETED
        self.result = result
        self.completed_at = datetime.now()
        if self.started_at:
            self.execution_time = (self.completed_at - self.started_at).total_seconds()
    
    def fail(self, error: str):
        """Mark subtask as failed"""
        self.status = TaskStatus.FAILED
        self.error = error
        self.completed_at = datetime.now()
    
    def block(self, reason: str):
        """Mark subtask as blocked"""
        self.status = TaskStatus.BLOCKED
        self.error = reason
    
    def can_execute(self, completed_subtasks: List[str]) -> bool:
        """Check if all dependencies are completed"""
        return all(dep in completed_subtasks for dep in self.dependencies)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "dependencies": self.dependencies,
            "estimated_complexity": self.estimated_complexity,
            "agent_type": self.agent_type,
            "status": self.status.value,
            "result": self.result,
            "error": self.error,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "execution_time": self.execution_time
        }

class Task:
    """Represents a main task with subtasks"""
    
    def __init__(
        self,
        task_id: str,
        description: str,
        subtasks: List[SubTask],
        metadata: Dict[str, Any] = None
    ):
        self.id = task_id
        self.description = description
        self.subtasks = {st.id: st for st in subtasks}
        self.metadata = metadata or {}
        self.created_at = datetime.now()
        self.started_at = None
        self.completed_at = None
        self.current_subtask_id = None
    
    def get_progress(self) -> Dict[str, Any]:
        """Get task progress"""
        total = len(self.subtasks)
        completed = sum(1 for st in self.subtasks.values() if st.status == TaskStatus.COMPLETED)
        in_progress = sum(1 for st in self.subtasks.values() if st.status == TaskStatus.IN_PROGRESS)
        failed = sum(1 for st in self.subtasks.values() if st.status == TaskStatus.FAILED)
        blocked = sum(1 for st in self.subtasks.values() if st.status == TaskStatus.BLOCKED)
        
        progress_percentage = (completed / total * 100) if total > 0 else 0
        
        return {
            "task_id": self.id,
            "description": self.description,
            "total_subtasks": total,
            "completed": completed,
            "in_progress": in_progress,
            "failed": failed,
            "blocked": blocked,
            "pending": total - completed - in_progress - failed - blocked,
            "progress_percentage": round(progress_percentage, 1),
            "is_complete": completed == total,
            "created_at": self.created_at.isoformat(),
            "current_subtask": self.get_subtask(self.current_subtask_id).title if self.current_subtask_id else None
        }
    
    def get_subtask(self, subtask_id: str) -> Optional[SubTask]:
        """Get a specific subtask"""
        return self.subtasks.get(subtask_id)
    
    def get_next_subtask(self) -> Optional[SubTask]:
        """Get the next subtask that can be executed"""
        completed_ids = [
            st_id for st_id, st in self.subtasks.items() 
            if st.status == TaskStatus.COMPLETED
        ]
        
        for subtask in self.subtasks.values():
            if subtask.status == TaskStatus.PENDING and subtask.can_execute(completed_ids):
                return subtask
        
        return None
    
    def get_all_subtasks(self) -> List[Dict[str, Any]]:
        """Get all subtasks as dictionaries"""
        return [st.to_dict() for st in self.subtasks.values()]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "id": self.id,
            "description": self.description,
            "subtasks": self.get_all_subtasks(),
            "progress": self.get_progress(),
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat()
        }

class TaskDecomposer:
    """
    Decomposes complex tasks into manageable subtasks using AI agents.
    """
    
    def __init__(self, llm_config: Dict[str, Any]):
        self.llm_config = llm_config
        
        # Create decomposer agent
        self.decomposer = autogen.AssistantAgent(
            name="TaskDecomposer",
            system_message="""You are an expert at breaking down complex tasks into smaller, manageable subtasks.
            
Your job is to:
1. Analyze the given task
2. Break it into logical subtasks
3. Identify dependencies between subtasks
4. Estimate complexity (low, medium, high)
5. Suggest which agent type should handle each subtask

Format your response as a JSON array of subtasks:
[
  {
    "title": "Brief subtask title",
    "description": "Detailed description of what needs to be done",
    "dependencies": ["subtask-1-id"],
    "estimated_complexity": "medium",
    "agent_type": "code_generator"
  }
]

Agent types available: code_generator, code_reviewer, architect, reasoner

Make subtasks:
- Specific and actionable
- Independent where possible (minimize dependencies)
- Properly ordered by dependencies
- Clear about what constitutes "done"
""",
            llm_config=llm_config
        )
    
    def decompose_task(self, task_description: str) -> Task:
        """
        Decompose a complex task into subtasks.
        
        Args:
            task_description: The main task to decompose
            
        Returns:
            Task object with subtasks
        """
        # Create user proxy for interaction
        user_proxy = autogen.UserProxyAgent(
            name="User",
            human_input_mode="NEVER",
            max_consecutive_auto_reply=1,
            code_execution_config=False
        )
        
        # Ask agent to decompose
        user_proxy.initiate_chat(
            self.decomposer,
            message=f"Decompose this task into subtasks:\n\n{task_description}\n\nProvide only the JSON array, no additional text."
        )
        
        # Extract response
        messages = user_proxy.chat_messages[self.decomposer]
        response = messages[-1]['content']
        
        # Parse subtasks from response
        subtasks = self._parse_subtasks(response, task_description)
        
        # Create task
        task_id = str(uuid.uuid4())
        task = Task(
            task_id=task_id,
            description=task_description,
            subtasks=subtasks,
            metadata={
                "decomposition_method": "ai_agent",
                "decomposer": "TaskDecomposer"
            }
        )
        
        return task
    
    def _parse_subtasks(self, response: str, task_description: str) -> List[SubTask]:
        """Parse subtasks from agent response"""
        try:
            # Extract JSON from response
            start = response.find('[')
            end = response.rfind(']') + 1
            
            if start == -1 or end == 0:
                # Fallback: create generic subtasks
                return self._create_fallback_subtasks(task_description)
            
            json_str = response[start:end]
            subtasks_data = json.loads(json_str)
            
            subtasks = []
            for i, st_data in enumerate(subtasks_data):
                subtask = SubTask(
                    id=f"subtask-{i+1}",
                    title=st_data.get("title", f"Subtask {i+1}"),
                    description=st_data.get("description", ""),
                    dependencies=st_data.get("dependencies", []),
                    estimated_complexity=st_data.get("estimated_complexity", "medium"),
                    agent_type=st_data.get("agent_type", "code_generator")
                )
                subtasks.append(subtask)
            
            return subtasks
            
        except Exception as e:
            print(f"Failed to parse subtasks: {e}")
            return self._create_fallback_subtasks(task_description)
    
    def _create_fallback_subtasks(self, task_description: str) -> List[SubTask]:
        """Create generic subtasks if parsing fails"""
        return [
            SubTask(
                id="subtask-1",
                title="Analyze Requirements",
                description=f"Analyze and understand: {task_description}",
                dependencies=[],
                estimated_complexity="low",
                agent_type="architect"
            ),
            SubTask(
                id="subtask-2",
                title="Implement Solution",
                description=f"Implement the solution for: {task_description}",
                dependencies=["subtask-1"],
                estimated_complexity="high",
                agent_type="code_generator"
            ),
            SubTask(
                id="subtask-3",
                title="Review and Validate",
                description="Review implementation and validate it works correctly",
                dependencies=["subtask-2"],
                estimated_complexity="medium",
                agent_type="code_reviewer"
            )
        ]

class TaskManager:
    """
    Manages task lifecycle and storage.
    """
    
    def __init__(self, storage_file: str = "tasks.json"):
        self.storage_file = storage_file
        self.tasks: Dict[str, Task] = {}
        self.load_tasks()
    
    def create_task(self, task: Task) -> str:
        """Store a new task"""
        self.tasks[task.id] = task
        self.save_tasks()
        return task.id
    
    def get_task(self, task_id: str) -> Optional[Task]:
        """Get a task by ID"""
        return self.tasks.get(task_id)
    
    def update_subtask(
        self,
        task_id: str,
        subtask_id: str,
        status: str = None,
        result: str = None,
        error: str = None
    ) -> bool:
        """Update a subtask's status"""
        task = self.get_task(task_id)
        if not task:
            return False
        
        subtask = task.get_subtask(subtask_id)
        if not subtask:
            return False
        
        if status == "in_progress":
            subtask.start()
            task.current_subtask_id = subtask_id
        elif status == "completed" and result:
            subtask.complete(result)
            task.current_subtask_id = None
        elif status == "failed" and error:
            subtask.fail(error)
            task.current_subtask_id = None
        
        self.save_tasks()
        return True
    
    def get_all_tasks(self) -> List[Dict[str, Any]]:
        """Get all tasks"""
        return [task.to_dict() for task in self.tasks.values()]
    
    def delete_task(self, task_id: str) -> bool:
        """Delete a task"""
        if task_id in self.tasks:
            del self.tasks[task_id]
            self.save_tasks()
            return True
        return False
    
    def save_tasks(self):
        """Save tasks to file"""
        try:
            data = {
                task_id: task.to_dict()
                for task_id, task in self.tasks.items()
            }
            with open(self.storage_file, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Failed to save tasks: {e}")
    
    def load_tasks(self):
        """Load tasks from file"""
        if not os.path.exists(self.storage_file):
            return
        
        try:
            with open(self.storage_file, 'r') as f:
                data = json.load(f)
            
            # Reconstruct tasks (simplified - doesn't restore full state)
            # In production, you'd want more sophisticated serialization
            print(f"Loaded {len(data)} tasks from storage")
            
        except Exception as e:
            print(f"Failed to load tasks: {e}")

# Global instances
task_manager = TaskManager()
