"""
Test Suite for Advanced Features
Tests code execution sandbox, multi-agent coordination, analytics, and custom tools
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

def test_code_execution_sandbox():
    """Test code execution with automatic testing"""
    print("\n🔒 Testing Code Execution Sandbox...")
    
    test_cases = [
        {
            "name": "Simple Python function",
            "task": "Create a function that calculates fibonacci sequence",
            "language": "python",
            "max_iterations": 3,
            "use_team_review": False
        },
        {
            "name": "Code with team review",
            "task": "Create a function to validate email addresses with regex",
            "language": "python",
            "max_iterations": 2,
            "use_team_review": True
        }
    ]
    
    for test_case in test_cases:
        print(f"\n  Testing: {test_case['name']}")
        
        try:
            response = requests.post(
                f"{BASE_URL}/agent/execute-with-sandbox",
                json=test_case,
                timeout=120
            )
            result = response.json()
            
            if result.get("success"):
                print(f"  ✅ {test_case['name']}: SUCCESS")
                print(f"     - Iterations: {result.get('iterations', 'N/A')}")
                print(f"     - Execution time: {result.get('execution_time', 'N/A')}s")
                print(f"     - Final code works: {'Yes' if result.get('all_tests_passed') else 'No'}")
            else:
                print(f"  ❌ {test_case['name']}: FAILED - {result.get('error', 'Unknown error')}")
        
        except Exception as e:
            print(f"  ❌ {test_case['name']}: ERROR - {e}")

def test_multi_agent_coordination():
    """Test multi-agent coordination patterns"""
    print("\n🤝 Testing Multi-Agent Coordination...")
    
    # Test 1: Sequential pipeline
    print("\n  Testing: Sequential Pipeline (Research→Plan→Code→Review)")
    
    try:
        response = requests.post(
            f"{BASE_URL}/agent/coordinated-pipeline",
            json={
                "task": "Create a data validation system with error handling"
            },
            timeout=180
        )
        result = response.json()
        
        if result.get("success"):
            print("  ✅ Sequential Pipeline: SUCCESS")
            print(f"     - Phases completed: {len(result.get('phases', []))}")
            print(f"     - Execution time: {result.get('execution_time')}s")
            
            # Show phase results
            for phase in result.get("phases", []):
                print(f"     - {phase['agent']}: {phase['result'][:80]}...")
        else:
            print(f"  ❌ Sequential Pipeline: FAILED - {result.get('error')}")
    
    except Exception as e:
        print(f"  ❌ Sequential Pipeline: ERROR - {e}")
    
    # Test 2: Parallel exploration
    print("\n  Testing: Parallel Exploration")
    
    try:
        response = requests.post(
            f"{BASE_URL}/agent/parallel-explore",
            json={
                "problem": "Design a caching system for API responses",
                "approaches": [
                    "In-memory cache with LRU eviction",
                    "Redis-based distributed cache",
                    "File-based cache with TTL"
                ]
            },
            timeout=180
        )
        result = response.json()
        
        if result.get("success"):
            print("  ✅ Parallel Exploration: SUCCESS")
            print(f"     - Approaches explored: {len(result.get('explorations', []))}")
            print(f"     - Winning approach: {result.get('chosen_approach', 'N/A')}")
            print(f"     - Execution time: {result.get('execution_time')}s")
        else:
            print(f"  ❌ Parallel Exploration: FAILED - {result.get('error')}")
    
    except Exception as e:
        print(f"  ❌ Parallel Exploration: ERROR - {e}")
    
    # Test 3: Collaborative debugging
    print("\n  Testing: Collaborative Debugging")
    
    buggy_code = """
def calculate_average(numbers):
    total = sum(numbers)
    return total / len(numbers)

result = calculate_average([])  # Causes ZeroDivisionError
"""
    
    try:
        response = requests.post(
            f"{BASE_URL}/agent/collaborative-debug",
            json={
                "code": buggy_code,
                "error_message": "ZeroDivisionError: division by zero"
            },
            timeout=120
        )
        result = response.json()
        
        if result.get("success"):
            print("  ✅ Collaborative Debugging: SUCCESS")
            print(f"     - Issue found: {result.get('issue', 'N/A')[:80]}")
            print(f"     - Fixed: {'Yes' if result.get('fixed_code') else 'No'}")
            print(f"     - Execution time: {result.get('execution_time')}s")
        else:
            print(f"  ❌ Collaborative Debugging: FAILED - {result.get('error')}")
    
    except Exception as e:
        print(f"  ❌ Collaborative Debugging: ERROR - {e}")

def test_tool_analytics():
    """Test tool usage analytics"""
    print("\n📊 Testing Tool Usage Analytics...")
    
    # Test 1: Get tool usage
    print("\n  Testing: Tool Usage Statistics")
    
    try:
        response = requests.get(f"{BASE_URL}/analytics/tool-usage")
        result = response.json()
        
        print("  ✅ Tool Usage: SUCCESS")
        print(f"     - Most used tools: {len(result.get('most_used', []))}")
        
        # Show top 3 tools
        for i, tool in enumerate(result.get('most_used', [])[:3], 1):
            print(f"     {i}. {tool['tool']}: {tool['calls']} calls ({tool['percentage']})")
    
    except Exception as e:
        print(f"  ❌ Tool Usage: ERROR - {e}")
    
    # Test 2: Comprehensive report
    print("\n  Testing: Comprehensive Analytics Report")
    
    try:
        response = requests.get(f"{BASE_URL}/analytics/comprehensive-report")
        result = response.json()
        
        if result.get("message") == "No tool usage data yet":
            print("  ℹ️  No analytics data yet (run other tests first)")
        else:
            print("  ✅ Comprehensive Report: SUCCESS")
            
            overview = result.get("overview", {})
            print(f"     - Total tool calls: {overview.get('total_tool_calls')}")
            print(f"     - Unique tools: {overview.get('unique_tools')}")
            print(f"     - Success rate: {overview.get('overall_success_rate')}")
    
    except Exception as e:
        print(f"  ❌ Comprehensive Report: ERROR - {e}")

def test_custom_tools():
    """Test custom tools system"""
    print("\n🛠️  Testing Custom Tools...")
    
    # Test 1: Register custom tool
    print("\n  Testing: Register Custom Tool")
    
    custom_tool_code = """
def reverse_string(text: str) -> str:
    '''Reverse a string'''
    return text[::-1]
"""
    
    try:
        response = requests.post(
            f"{BASE_URL}/tools/register-custom",
            json={
                "name": "reverse_string",
                "description": "Reverses a string",
                "code": custom_tool_code,
                "category": "text_processing"
            }
        )
        result = response.json()
        
        if result.get("success"):
            print("  ✅ Register Custom Tool: SUCCESS")
            print(f"     - Tool: {result['tool_info']['name']}")
            print(f"     - Category: {result['tool_info']['category']}")
        else:
            print(f"  ❌ Register Custom Tool: FAILED - {result.get('error')}")
    
    except Exception as e:
        print(f"  ❌ Register Custom Tool: ERROR - {e}")
    
    # Test 2: Get custom tools
    print("\n  Testing: Get Custom Tools")
    
    try:
        response = requests.get(f"{BASE_URL}/tools/custom")
        result = response.json()
        
        print("  ✅ Get Custom Tools: SUCCESS")
        print(f"     - Total custom tools: {len(result.get('all_tools', []))}")
        
        stats = result.get('statistics', {})
        print(f"     - Categories: {stats.get('categories')}")
    
    except Exception as e:
        print(f"  ❌ Get Custom Tools: ERROR - {e}")
    
    # Test 3: Use custom tools with agent
    print("\n  Testing: Execute Agent with Custom Tools")
    
    try:
        response = requests.post(
            f"{BASE_URL}/agent/execute-with-custom-tools",
            json={
                "task": "Reverse the string 'Hello World'",
                "agent_type": "code_generator",
                "tool_categories": ["text_processing"],
                "include_mcp_tools": False,
                "max_iterations": 5
            },
            timeout=60
        )
        result = response.json()
        
        if result.get("success"):
            print("  ✅ Execute with Custom Tools: SUCCESS")
            print(f"     - Custom tools used: {result.get('custom_tools_count')}")
            print(f"     - Result: {result.get('result', '')[:100]}")
        else:
            print(f"  ❌ Execute with Custom Tools: FAILED - {result.get('error')}")
    
    except Exception as e:
        print(f"  ❌ Execute with Custom Tools: ERROR - {e}")

def test_all_features():
    """Run all advanced features tests"""
    print("\n" + "="*70)
    print("🚀 Testing HybridMind Advanced Features")
    print("="*70)
    
    # Check service health first
    if not test_health():
        print("\n❌ Service is not running. Start it with: python main.py")
        return
    
    # Run all tests
    test_code_execution_sandbox()
    test_multi_agent_coordination()
    test_tool_analytics()
    test_custom_tools()
    
    print("\n" + "="*70)
    print("✅ All tests completed!")
    print("="*70)

if __name__ == "__main__":
    test_all_features()
