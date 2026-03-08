"""
Test Suite for MCP Tools Integration
Tests Python AutoGen agents using MCP tools through Node.js bridge
"""

import requests
import json
import time

PYTHON_SERVICE = "http://localhost:8000"
NODEJS_BACKEND = "http://localhost:3000"

def print_header(text):
    print("\n" + "=" * 70)
    print(text)
    print("=" * 70)

def print_test(number, name):
    print(f"\n📋 Test {number}: {name}")

def print_success(message):
    print(f"✅ {message}")

def print_error(message):
    print(f"❌ {message}")

def print_info(message):
    print(f"ℹ️  {message}")

def test_python_service_health():
    """Test 1: Python service is running"""
    print_test(1, "Python Service Health Check")
    try:
        response = requests.get(f"{PYTHON_SERVICE}/health", timeout=5)
        if response.status_code == 200:
            print_success("Python service is healthy")
            return True
        else:
            print_error(f"Python service returned status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Python service not available: {e}")
        print_info("Make sure to run: python hybridmind-python-service/main.py")
        return False

def test_nodejs_backend_health():
    """Test 2: Node.js backend is running"""
    print_test(2, "Node.js Backend Health Check")
    try:
        response = requests.get(f"{NODEJS_BACKEND}/api/health", timeout=5)
        if response.status_code == 200 or response.status_code == 404:  # 404 is ok, means server running
            print_success("Node.js backend is running")
            return True
        else:
            print_error(f"Backend returned status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Node.js backend not available: {e}")
        print_info("Make sure to run: npm start or start-backend.bat")
        return False

def test_available_tools():
    """Test 3: List available MCP tools"""
    print_test(3, "Get Available MCP Tools")
    try:
        response = requests.get(f"{PYTHON_SERVICE}/tools/available", timeout=5)
        data = response.json()
        
        print_success(f"Found {data['total']} MCP tools")
        print_info("Tool categories:")
        for category, count in data['categories'].items():
            print(f"   - {category}: {count} tools")
        
        return True
    except Exception as e:
        print_error(f"Failed to get tools: {e}")
        return False

def test_web_search_tool():
    """Test 4: Agent uses web search tool"""
    print_test(4, "Agent with Web Search Tool")
    try:
        response = requests.post(
            f"{PYTHON_SERVICE}/agent/execute-with-tools",
            json={
                "task": "Search the web for 'Python AutoGen framework' and summarize the first result",
                "agent_type": "reasoner",
                "tool_set": "web_search",
                "temperature": 0.7,
                "max_iterations": 5
            },
            timeout=60
        )
        
        data = response.json()
        
        if data.get("success"):
            print_success(f"Agent completed task in {data['execution_time']:.2f}s")
            print_info(f"Tools available: {data['tools_available']}")
            print_info(f"Result preview: {data['result'][:150]}...")
            return True
        else:
            print_error(f"Agent failed: {data.get('error')}")
            return False
            
    except Exception as e:
        print_error(f"Web search test failed: {e}")
        return False

def test_research_task():
    """Test 5: Research task with multiple tools"""
    print_test(5, "Research Task (Web + Memory + M365)")
    try:
        response = requests.post(
            f"{PYTHON_SERVICE}/agent/research-task",
            json={
                "task": "Research: What are the key features of Microsoft Teams bots?"
            },
            timeout=60
        )
        
        data = response.json()
        
        if data.get("success"):
            print_success(f"Research completed in {data['execution_time']:.2f}s")
            print_info(f"Available tools: {', '.join(data['tools_available'])}")
            print_info(f"Result preview: {data['result'][:150]}...")
            return True
        else:
            print_error(f"Research failed: {data.get('error')}")
            return False
            
    except Exception as e:
        print_error(f"Research test failed: {e}")
        return False

def test_filesystem_tools():
    """Test 6: Agent reads files from workspace"""
    print_test(6, "Filesystem Tools (Read Files)")
    try:
        response = requests.post(
            f"{PYTHON_SERVICE}/agent/execute-with-tools",
            json={
                "task": "Read the README.md file from e:/IThero/HybridMind/ and summarize its main points",
                "agent_type": "reasoner",
                "tool_set": "filesystem",
                "temperature": 0.7,
                "max_iterations": 5
            },
            timeout=60
        )
        
        data = response.json()
        
        if data.get("success"):
            print_success(f"Agent read and summarized file in {data['execution_time']:.2f}s")
            print_info(f"Tools used: {data['tools_used']}")
            print_info(f"Result preview: {data['result'][:150]}...")
            return True
        else:
            print_error(f"Filesystem test failed: {data.get('error')}")
            return False
            
    except Exception as e:
        print_error(f"Filesystem test failed: {e}")
        return False

def test_terminal_tools():
    """Test 7: Agent executes terminal commands"""
    print_test(7, "Terminal Tools (Execute Commands)")
    try:
        response = requests.post(
            f"{PYTHON_SERVICE}/agent/execute-with-tools",
            json={
                "task": "Run the command 'echo Hello from Python Agent' and tell me the output",
                "agent_type": "code_generator",
                "tool_set": "terminal",
                "temperature": 0.7,
                "max_iterations": 3
            },
            timeout=30
        )
        
        data = response.json()
        
        if data.get("success"):
            print_success(f"Agent executed command in {data['execution_time']:.2f}s")
            print_info(f"Result: {data['result'][:100]}...")
            return True
        else:
            print_error(f"Terminal test failed: {data.get('error')}")
            return False
            
    except Exception as e:
        print_error(f"Terminal test failed: {e}")
        return False

def test_code_with_tools():
    """Test 8: Code generation with development tools"""
    print_test(8, "Code Generation with Development Tools")
    try:
        response = requests.post(
            f"{PYTHON_SERVICE}/agent/code-with-tools",
            json={
                "task": "Create a simple JavaScript function that adds two numbers. Store it in memory for future reference."
            },
            timeout=60
        )
        
        data = response.json()
        
        if data.get("success"):
            print_success(f"Code generation completed in {data['execution_time']:.2f}s")
            print_info(f"Tools available: {', '.join(data['tools_available'][:3])}...")
            print_info(f"Result preview: {data['result'][:150]}...")
            return True
        else:
            print_error(f"Code generation failed: {data.get('error')}")
            return False
            
    except Exception as e:
        print_error(f"Code generation test failed: {e}")
        return False

def test_all_tools():
    """Test 9: Agent with access to all MCP tools"""
    print_test(9, "Agent with All MCP Tools")
    try:
        response = requests.post(
            f"{PYTHON_SERVICE}/agent/execute-with-tools",
            json={
                "task": "Tell me what tools you have access to and demonstrate using web search",
                "agent_type": "reasoner",
                "tool_set": "all",
                "temperature": 0.7,
                "max_iterations": 5
            },
            timeout=60
        )
        
        data = response.json()
        
        if data.get("success"):
            print_success(f"Agent completed with {data['tools_available']} tools available")
            print_info(f"Execution time: {data['execution_time']:.2f}s")
            print_info(f"Result preview: {data['result'][:150]}...")
            return True
        else:
            print_error(f"All tools test failed: {data.get('error')}")
            return False
            
    except Exception as e:
        print_error(f"All tools test failed: {e}")
        return False

def run_all_tests():
    """Run complete test suite"""
    print_header("🧪 MCP Tools Integration Test Suite")
    print("Testing Python AutoGen agents with MCP tools")
    print()
    
    results = {
        "passed": 0,
        "failed": 0,
        "total": 9
    }
    
    tests = [
        test_python_service_health,
        test_nodejs_backend_health,
        test_available_tools,
        test_web_search_tool,
        test_research_task,
        test_filesystem_tools,
        test_terminal_tools,
        test_code_with_tools,
        test_all_tools
    ]
    
    for test_func in tests:
        try:
            if test_func():
                results["passed"] += 1
            else:
                results["failed"] += 1
        except Exception as e:
            print_error(f"Test crashed: {e}")
            results["failed"] += 1
        
        time.sleep(1)  # Brief pause between tests
    
    # Summary
    print_header("📊 Test Results Summary")
    print(f"✅ Passed: {results['passed']}/{results['total']}")
    print(f"❌ Failed: {results['failed']}/{results['total']}")
    print("=" * 70)
    
    if results["failed"] == 0:
        print("\n🎉 All tests passed! MCP tools integration is working!")
        print("\n✨ Your Python agents can now:")
        print("   - Read and write files")
        print("   - Execute terminal commands")
        print("   - Search the web")
        print("   - Access memory/knowledge base")
        print("   - Query M365 documentation")
    elif results["passed"] > 0:
        print("\n⚠️  Some tests passed. Check failed tests above.")
        print("   - Make sure both services are running")
        print("   - Check that Node.js MCP handlers are configured")
    else:
        print("\n❌ All tests failed. Check:")
        print("   1. Python service running: python hybridmind-python-service/main.py")
        print("   2. Node.js backend running: npm start")
        print("   3. Environment variables configured (.env files)")

if __name__ == "__main__":
    run_all_tests()
