"""
Test Suite for Task Decomposition System
Tests AI-powered task breakdown, tracking, and execution
"""

import requests
import json
import time

BASE_URL = "http://localhost:8000"

def test_health():
    """Test service health"""
    print("\n🏥 Testing service health...")
    
    try:
        response = requests.get(f"{BASE_URL}/health")
        result = response.json()
        
        if result["status"] == "healthy":
            print("✅ Service is healthy")
            return True
        else:
            print("❌ Service unhealthy")
            return False
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

def test_task_decomposition():
    """Test task decomposition"""
    print("\n📋 Testing Task Decomposition...")
    
    test_tasks = [
        {
            "name": "Simple task",
            "task": "Build a user authentication system with JWT tokens"
        },
        {
            "name": "Complex task",
            "task": "Create a RESTful API for a blog platform with posts, comments, and user management"
        },
        {
            "name": "Feature implementation",
            "task": "Add real-time chat functionality to a web application using WebSockets"
        }
    ]
    
    task_ids = []
    
    for test_task in test_tasks:
        print(f"\n  Testing: {test_task['name']}")
        
        try:
            response = requests.post(
                f"{BASE_URL}/task/decompose",
                json={"task": test_task['task']},
                timeout=60
            )
            result = response.json()
            
            if result.get("success"):
                task_id = result.get("task_id")
                task_ids.append(task_id)
                
                task_data = result.get("task", {})
                subtasks = task_data.get("subtasks", [])
                
                print(f"  ✅ {test_task['name']}: SUCCESS")
                print(f"     - Task ID: {task_id}")
                print(f"     - Subtasks created: {len(subtasks)}")
                
                # Show first 3 subtasks
                for i, subtask in enumerate(subtasks[:3], 1):
                    print(f"     {i}. {subtask['title']} ({subtask['agent_type']})")
                
                if len(subtasks) > 3:
                    print(f"     ... and {len(subtasks) - 3} more")
            else:
                print(f"  ❌ {test_task['name']}: FAILED - {result.get('error')}")
        
        except Exception as e:
            print(f"  ❌ {test_task['name']}: ERROR - {e}")
    
    return task_ids

def test_task_progress(task_id: str):
    """Test task progress tracking"""
    print(f"\n📊 Testing Task Progress (Task: {task_id[:8]}...)...")
    
    try:
        # Get full task status
        response = requests.get(f"{BASE_URL}/task/{task_id}")
        result = response.json()
        
        if result.get("success"):
            task = result.get("task", {})
            progress = task.get("progress", {})
            
            print("  ✅ Task Status: SUCCESS")
            print(f"     - Description: {task.get('description')}")
            print(f"     - Total subtasks: {progress.get('total_subtasks')}")
            print(f"     - Progress: {progress.get('progress_percentage')}%")
            print(f"     - Completed: {progress.get('completed')}")
            print(f"     - Pending: {progress.get('pending')}")
        else:
            print(f"  ❌ Task Status: FAILED - {result.get('error')}")
    
    except Exception as e:
        print(f"  ❌ Task Status: ERROR - {e}")
    
    # Get progress endpoint
    try:
        response = requests.get(f"{BASE_URL}/task/{task_id}/progress")
        result = response.json()
        
        if result.get("success"):
            print("  ✅ Progress Endpoint: SUCCESS")
        else:
            print(f"  ❌ Progress Endpoint: FAILED - {result.get('error')}")
    
    except Exception as e:
        print(f"  ❌ Progress Endpoint: ERROR - {e}")

def test_next_subtask(task_id: str):
    """Test getting next available subtask"""
    print(f"\n➡️  Testing Next Subtask (Task: {task_id[:8]}...)...")
    
    try:
        response = requests.get(f"{BASE_URL}/task/{task_id}/next")
        result = response.json()
        
        if result.get("success"):
            if result.get("task_complete"):
                print("  ✅ All subtasks already completed!")
            else:
                subtask = result.get("subtask", {})
                print("  ✅ Next Subtask: SUCCESS")
                print(f"     - ID: {subtask.get('id')}")
                print(f"     - Title: {subtask.get('title')}")
                print(f"     - Agent: {subtask.get('agent_type')}")
                print(f"     - Complexity: {subtask.get('estimated_complexity')}")
                
                return subtask.get('id')
        else:
            print(f"  ❌ Next Subtask: FAILED - {result.get('error')}")
    
    except Exception as e:
        print(f"  ❌ Next Subtask: ERROR - {e}")
    
    return None

def test_subtask_lifecycle(task_id: str, subtask_id: str):
    """Test subtask lifecycle (start -> complete)"""
    print(f"\n🔄 Testing Subtask Lifecycle...")
    
    # Start subtask
    try:
        response = requests.post(f"{BASE_URL}/task/{task_id}/subtask/{subtask_id}/start")
        result = response.json()
        
        if result.get("success"):
            print("  ✅ Start Subtask: SUCCESS")
        else:
            print(f"  ❌ Start Subtask: FAILED - {result.get('error')}")
    
    except Exception as e:
        print(f"  ❌ Start Subtask: ERROR - {e}")
    
    # Complete subtask
    try:
        response = requests.post(
            f"{BASE_URL}/task/{task_id}/subtask/{subtask_id}/complete",
            json={"result": "Completed successfully in test"}
        )
        result = response.json()
        
        if result.get("success"):
            progress = result.get("progress", {})
            print("  ✅ Complete Subtask: SUCCESS")
            print(f"     - Progress: {progress.get('progress_percentage')}%")
            print(f"     - Completed: {progress.get('completed')}/{progress.get('total_subtasks')}")
        else:
            print(f"  ❌ Complete Subtask: FAILED - {result.get('error')}")
    
    except Exception as e:
        print(f"  ❌ Complete Subtask: ERROR - {e}")

def test_execute_next_subtask(task_id: str):
    """Test automatic execution of next subtask"""
    print(f"\n🤖 Testing Automatic Execution (Task: {task_id[:8]}...)...")
    
    try:
        print("  ⏳ Executing next subtask with AI agent...")
        
        response = requests.post(
            f"{BASE_URL}/task/{task_id}/execute-next",
            timeout=120
        )
        result = response.json()
        
        if result.get("success"):
            if result.get("task_complete"):
                print("  ✅ All subtasks completed!")
            else:
                print("  ✅ Execute Next: SUCCESS")
                print(f"     - Subtask: {result.get('subtask_title')}")
                print(f"     - Result: {result.get('result', '')[:100]}...")
                print(f"     - Execution time: {result.get('execution_time')}s")
                
                progress = result.get("progress", {})
                print(f"     - Progress: {progress.get('progress_percentage')}%")
        else:
            print(f"  ❌ Execute Next: FAILED - {result.get('error')}")
    
    except Exception as e:
        print(f"  ❌ Execute Next: ERROR - {e}")

def test_execute_all_subtasks(task_id: str):
    """Test executing all subtasks automatically"""
    print(f"\n🚀 Testing Execute All Subtasks (Task: {task_id[:8]}...)...")
    
    try:
        print("  ⏳ This may take a while (executing all subtasks with AI)...")
        
        response = requests.post(
            f"{BASE_URL}/task/{task_id}/execute-all",
            timeout=600  # 10 minutes max
        )
        result = response.json()
        
        if result.get("success"):
            print("  ✅ Execute All: SUCCESS")
            print(f"     - Subtasks executed: {result.get('subtasks_executed')}")
            print(f"     - Total time: {result.get('total_execution_time')}s")
            
            progress = result.get("progress", {})
            print(f"     - Final progress: {progress.get('progress_percentage')}%")
            print(f"     - Completed: {progress.get('completed')}/{progress.get('total_subtasks')}")
        else:
            print(f"  ❌ Execute All: FAILED - {result.get('error')}")
    
    except requests.exceptions.Timeout:
        print("  ⚠️  Execute All: TIMEOUT (this is normal for large tasks)")
    except Exception as e:
        print(f"  ❌ Execute All: ERROR - {e}")

def test_list_all_tasks():
    """Test listing all tasks"""
    print("\n📝 Testing List All Tasks...")
    
    try:
        response = requests.get(f"{BASE_URL}/tasks")
        result = response.json()
        
        if result.get("success"):
            tasks = result.get("tasks", [])
            print("  ✅ List Tasks: SUCCESS")
            print(f"     - Total tasks: {result.get('total')}")
            
            # Show summary of each task
            for task in tasks[:5]:  # Show first 5
                progress = task.get("progress", {})
                print(f"     - {task['id'][:8]}: {progress['completed']}/{progress['total_subtasks']} subtasks ({progress['progress_percentage']}%)")
        else:
            print(f"  ❌ List Tasks: FAILED - {result.get('error')}")
    
    except Exception as e:
        print(f"  ❌ List Tasks: ERROR - {e}")

def test_delete_task(task_id: str):
    """Test deleting a task"""
    print(f"\n🗑️  Testing Delete Task (Task: {task_id[:8]}...)...")
    
    try:
        response = requests.delete(f"{BASE_URL}/task/{task_id}")
        result = response.json()
        
        if result.get("success"):
            print("  ✅ Delete Task: SUCCESS")
        else:
            print(f"  ❌ Delete Task: FAILED - {result.get('error')}")
    
    except Exception as e:
        print(f"  ❌ Delete Task: ERROR - {e}")

def run_full_workflow():
    """Run a complete workflow test"""
    print("\n" + "="*70)
    print("🧪 FULL WORKFLOW TEST")
    print("="*70)
    
    # 1. Decompose task
    print("\n1️⃣  Step 1: Decompose Task")
    response = requests.post(
        f"{BASE_URL}/task/decompose",
        json={"task": "Create a simple REST API for a todo list"},
        timeout=60
    )
    result = response.json()
    
    if not result.get("success"):
        print(f"❌ Failed to decompose task: {result.get('error')}")
        return
    
    task_id = result.get("task_id")
    print(f"✅ Task created: {task_id}")
    
    # 2. View initial progress
    print("\n2️⃣  Step 2: View Initial Progress")
    response = requests.get(f"{BASE_URL}/task/{task_id}/progress")
    result = response.json()
    progress = result.get("progress", {})
    print(f"✅ Progress: {progress.get('completed')}/{progress.get('total_subtasks')} subtasks")
    
    # 3. Get first subtask
    print("\n3️⃣  Step 3: Get First Subtask")
    response = requests.get(f"{BASE_URL}/task/{task_id}/next")
    result = response.json()
    first_subtask = result.get("subtask", {})
    print(f"✅ Next: {first_subtask.get('title')}")
    
    # 4. Execute first subtask automatically
    print("\n4️⃣  Step 4: Auto-Execute First Subtask")
    print("⏳ Executing with AI agent...")
    response = requests.post(f"{BASE_URL}/task/{task_id}/execute-next", timeout=120)
    result = response.json()
    
    if result.get("success"):
        print(f"✅ Executed: {result.get('subtask_title')}")
        print(f"   Result: {result.get('result', '')[:80]}...")
    else:
        print(f"❌ Failed: {result.get('error')}")
    
    # 5. View updated progress
    print("\n5️⃣  Step 5: View Updated Progress")
    response = requests.get(f"{BASE_URL}/task/{task_id}/progress")
    result = response.json()
    progress = result.get("progress", {})
    print(f"✅ Progress: {progress.get('completed')}/{progress.get('total_subtasks')} ({progress.get('progress_percentage')}%)")
    
    print("\n" + "="*70)
    print("✅ WORKFLOW COMPLETE")
    print("="*70)
    
    return task_id

def test_all():
    """Run all tests"""
    print("\n" + "="*70)
    print("🚀 Testing HybridMind Task Decomposition System")
    print("="*70)
    
    # Check service health
    if not test_health():
        print("\n❌ Service is not running. Start it with: python main.py")
        return
    
    # Test task decomposition
    task_ids = test_task_decomposition()
    
    if not task_ids:
        print("\n❌ No tasks created, stopping tests")
        return
    
    # Use first task for detailed testing
    test_task_id = task_ids[0]
    
    # Test progress tracking
    test_task_progress(test_task_id)
    
    # Test getting next subtask
    next_subtask_id = test_next_subtask(test_task_id)
    
    # Test subtask lifecycle (if we have a subtask)
    if next_subtask_id:
        test_subtask_lifecycle(test_task_id, next_subtask_id)
    
    # Test automatic execution
    if len(task_ids) > 1:
        test_execute_next_subtask(task_ids[1])
    
    # Test list all tasks
    test_list_all_tasks()
    
    # Run full workflow
    print("\n\n")
    workflow_task_id = run_full_workflow()
    
    print("\n" + "="*70)
    print("✅ All tests completed!")
    print("="*70)
    print("\nCreated tasks:")
    for task_id in task_ids:
        print(f"  - {task_id}")
    if workflow_task_id:
        print(f"  - {workflow_task_id} (workflow test)")
    
    print("\n💡 Try these commands:")
    print(f"  # View task status:")
    print(f"  curl http://localhost:8000/task/{task_ids[0]}")
    print(f"\n  # Execute next subtask:")
    print(f"  curl -X POST http://localhost:8000/task/{task_ids[0]}/execute-next")
    print(f"\n  # Execute all subtasks:")
    print(f"  curl -X POST http://localhost:8000/task/{task_ids[0]}/execute-all")

if __name__ == "__main__":
    test_all()
