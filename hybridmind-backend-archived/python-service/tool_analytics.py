"""
Tool Usage Analytics

Tracks which tools agents use most, success rates, and performance metrics.
Helps optimize tool selection and identify issues.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime
from collections import defaultdict
import json
import os

class ToolAnalytics:
    """
    Tracks tool usage statistics and provides insights.
    """
    
    def __init__(self, log_file: str = "tool_analytics.json"):
        self.log_file = log_file
        self.tool_calls = []
        self.load_from_file()
    
    def log_tool_call(
        self,
        tool_name: str,
        success: bool,
        execution_time: float,
        agent_name: str = "unknown",
        task_type: str = "unknown",
        error: Optional[str] = None
    ):
        """Log a tool call"""
        entry = {
            "tool_name": tool_name,
            "success": success,
            "execution_time": execution_time,
            "agent_name": agent_name,
            "task_type": task_type,
            "error": error,
            "timestamp": datetime.now().isoformat()
        }
        
        self.tool_calls.append(entry)
        
        # Auto-save periodically
        if len(self.tool_calls) % 10 == 0:
            self.save_to_file()
    
    def get_tool_stats(self, tool_name: Optional[str] = None) -> Dict[str, Any]:
        """Get statistics for a specific tool or all tools"""
        
        if not self.tool_calls:
            return {"message": "No tool calls logged yet"}
        
        # Filter by tool if specified
        calls = self.tool_calls
        if tool_name:
            calls = [c for c in calls if c["tool_name"] == tool_name]
            
            if not calls:
                return {"message": f"No calls found for tool: {tool_name}"}
        
        # Calculate statistics
        total_calls = len(calls)
        successful_calls = sum(1 for c in calls if c["success"])
        failed_calls = total_calls - successful_calls
        
        avg_time = sum(c["execution_time"] for c in calls) / total_calls
        
        # Most common errors
        errors = [c["error"] for c in calls if c["error"]]
        error_counts = defaultdict(int)
        for error in errors:
            error_counts[error[:100]] += 1  # First 100 chars
        
        top_errors = sorted(error_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        
        stats = {
            "tool_name": tool_name or "all_tools",
            "total_calls": total_calls,
            "successful": successful_calls,
            "failed": failed_calls,
            "success_rate": f"{(successful_calls/total_calls)*100:.1f}%",
            "average_execution_time": round(avg_time, 3),
            "top_errors": [{"error": err, "count": count} for err, count in top_errors]
        }
        
        return stats
    
    def get_most_used_tools(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get most frequently used tools"""
        
        if not self.tool_calls:
            return []
        
        tool_counts = defaultdict(int)
        for call in self.tool_calls:
            tool_counts[call["tool_name"]] += 1
        
        sorted_tools = sorted(tool_counts.items(), key=lambda x: x[1], reverse=True)
        
        return [
            {
                "tool": tool,
                "calls": count,
                "percentage": f"{(count/len(self.tool_calls))*100:.1f}%"
            }
            for tool, count in sorted_tools[:limit]
        ]
    
    def get_agent_tool_usage(self) -> Dict[str, Any]:
        """Get tool usage breakdown by agent"""
        
        if not self.tool_calls:
            return {}
        
        agent_tools = defaultdict(lambda: defaultdict(int))
        
        for call in self.tool_calls:
            agent = call["agent_name"]
            tool = call["tool_name"]
            agent_tools[agent][tool] += 1
        
        return {
            agent: dict(tools) 
            for agent, tools in agent_tools.items()
        }
    
    def get_task_type_insights(self) -> Dict[str, Any]:
        """Get insights on which tools are used for which task types"""
        
        if not self.tool_calls:
            return {}
        
        task_tools = defaultdict(lambda: defaultdict(int))
        
        for call in self.tool_calls:
            task = call["task_type"]
            tool = call["tool_name"]
            task_tools[task][tool] += 1
        
        return {
            task: dict(tools)
            for task, tools in task_tools.items()
        }
    
    def get_performance_insights(self) -> Dict[str, Any]:
        """Get performance insights about tools"""
        
        if not self.tool_calls:
            return {"message": "No data yet"}
        
        # Find slowest tools
        tool_times = defaultdict(list)
        for call in self.tool_calls:
            tool_times[call["tool_name"]].append(call["execution_time"])
        
        tool_avgs = {
            tool: sum(times) / len(times)
            for tool, times in tool_times.items()
        }
        
        slowest = sorted(tool_avgs.items(), key=lambda x: x[1], reverse=True)[:5]
        fastest = sorted(tool_avgs.items(), key=lambda x: x[1])[:5]
        
        # Find most reliable tools
        tool_success = defaultdict(lambda: {"total": 0, "success": 0})
        for call in self.tool_calls:
            tool = call["tool_name"]
            tool_success[tool]["total"] += 1
            if call["success"]:
                tool_success[tool]["success"] += 1
        
        reliability = {
            tool: stats["success"] / stats["total"]
            for tool, stats in tool_success.items()
        }
        
        most_reliable = sorted(reliability.items(), key=lambda x: x[1], reverse=True)[:5]
        least_reliable = sorted(reliability.items(), key=lambda x: x[1])[:5]
        
        return {
            "slowest_tools": [
                {"tool": tool, "avg_time": round(time, 3)}
                for tool, time in slowest
            ],
            "fastest_tools": [
                {"tool": tool, "avg_time": round(time, 3)}
                for tool, time in fastest
            ],
            "most_reliable": [
                {"tool": tool, "success_rate": f"{rate*100:.1f}%"}
                for tool, rate in most_reliable
            ],
            "least_reliable": [
                {"tool": tool, "success_rate": f"{rate*100:.1f}%"}
                for tool, rate in least_reliable
            ]
        }
    
    def get_time_based_insights(self) -> Dict[str, Any]:
        """Get insights based on time patterns"""
        
        if not self.tool_calls:
            return {}
        
        # Calls per hour
        hour_counts = defaultdict(int)
        for call in self.tool_calls:
            timestamp = datetime.fromisoformat(call["timestamp"])
            hour = timestamp.hour
            hour_counts[hour] += 1
        
        # Recent activity
        recent_24h = [
            c for c in self.tool_calls
            if (datetime.now() - datetime.fromisoformat(c["timestamp"])).total_seconds() < 86400
        ]
        
        return {
            "total_lifetime_calls": len(self.tool_calls),
            "calls_last_24h": len(recent_24h),
            "busiest_hours": sorted(
                hour_counts.items(),
                key=lambda x: x[1],
                reverse=True
            )[:5]
        }
    
    def get_comprehensive_report(self) -> Dict[str, Any]:
        """Get comprehensive analytics report"""
        
        if not self.tool_calls:
            return {"message": "No tool usage data yet"}
        
        return {
            "overview": {
                "total_tool_calls": len(self.tool_calls),
                "unique_tools": len(set(c["tool_name"] for c in self.tool_calls)),
                "unique_agents": len(set(c["agent_name"] for c in self.tool_calls)),
                "overall_success_rate": f"{(sum(1 for c in self.tool_calls if c['success'])/len(self.tool_calls))*100:.1f}%"
            },
            "most_used_tools": self.get_most_used_tools(5),
            "performance": self.get_performance_insights(),
            "by_agent": self.get_agent_tool_usage(),
            "by_task_type": self.get_task_type_insights(),
            "time_insights": self.get_time_based_insights()
        }
    
    def save_to_file(self):
        """Save analytics to file"""
        try:
            with open(self.log_file, 'w') as f:
                json.dump(self.tool_calls, f, indent=2)
        except Exception as e:
            print(f"Failed to save analytics: {e}")
    
    def load_from_file(self):
        """Load analytics from file"""
        if os.path.exists(self.log_file):
            try:
                with open(self.log_file, 'r') as f:
                    self.tool_calls = json.load(f)
            except Exception as e:
                print(f"Failed to load analytics: {e}")
                self.tool_calls = []
    
    def clear_old_data(self, days: int = 30):
        """Clear analytics data older than specified days"""
        cutoff = datetime.now().timestamp() - (days * 86400)
        
        self.tool_calls = [
            c for c in self.tool_calls
            if datetime.fromisoformat(c["timestamp"]).timestamp() > cutoff
        ]
        
        self.save_to_file()
        
        return {"message": f"Cleared data older than {days} days"}

# Global analytics instance
analytics = ToolAnalytics()

def track_tool_call(func):
    """Decorator to automatically track tool calls"""
    def wrapper(*args, **kwargs):
        tool_name = func.__name__
        start_time = datetime.now()
        
        try:
            result = func(*args, **kwargs)
            execution_time = (datetime.now() - start_time).total_seconds()
            
            analytics.log_tool_call(
                tool_name=tool_name,
                success=True,
                execution_time=execution_time,
                agent_name=kwargs.get("agent_name", "unknown"),
                task_type=kwargs.get("task_type", "unknown")
            )
            
            return result
            
        except Exception as e:
            execution_time = (datetime.now() - start_time).total_seconds()
            
            analytics.log_tool_call(
                tool_name=tool_name,
                success=False,
                execution_time=execution_time,
                agent_name=kwargs.get("agent_name", "unknown"),
                task_type=kwargs.get("task_type", "unknown"),
                error=str(e)
            )
            
            raise
    
    return wrapper
