"""
Custom Tools System

Framework for adding custom tools to AutoGen agents.
Makes it easy to extend agent capabilities with domain-specific tools.
"""

from typing import Annotated, Callable, Dict, Any, List
import inspect
from datetime import datetime

class CustomTool:
    """Base class for custom tools"""
    
    def __init__(
        self,
        name: str,
        description: str,
        function: Callable,
        category: str = "custom"
    ):
        self.name = name
        self.description = description
        self.function = function
        self.category = category
        self.call_count = 0
        self.created_at = datetime.now()
    
    def __call__(self, *args, **kwargs):
        """Execute the tool"""
        self.call_count += 1
        return self.function(*args, **kwargs)
    
    def get_info(self) -> Dict[str, Any]:
        """Get tool information"""
        return {
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "call_count": self.call_count,
            "created_at": self.created_at.isoformat()
        }

class CustomToolRegistry:
    """
    Registry for managing custom tools.
    Allows easy addition and management of domain-specific tools.
    """
    
    def __init__(self):
        self.tools = {}
        self.categories = {}
    
    def register_tool(
        self,
        name: str,
        description: str,
        function: Callable,
        category: str = "custom"
    ) -> CustomTool:
        """
        Register a new custom tool.
        
        Example:
            def my_tool(x: int, y: int) -> int:
                '''Add two numbers'''
                return x + y
            
            registry.register_tool(
                name="add_numbers",
                description="Adds two numbers together",
                function=my_tool,
                category="math"
            )
        """
        
        tool = CustomTool(name, description, function, category)
        self.tools[name] = tool
        
        if category not in self.categories:
            self.categories[category] = []
        self.categories[category].append(name)
        
        return tool
    
    def register_from_function(self, category: str = "custom"):
        """
        Decorator to register a function as a tool.
        
        Example:
            @registry.register_from_function(category="math")
            def multiply(x: int, y: int) -> int:
                '''Multiply two numbers'''
                return x * y
        """
        def decorator(func):
            # Extract description from docstring
            description = inspect.getdoc(func) or f"Custom tool: {func.__name__}"
            
            self.register_tool(
                name=func.__name__,
                description=description,
                function=func,
                category=category
            )
            
            return func
        
        return decorator
    
    def get_tool(self, name: str) -> CustomTool:
        """Get a tool by name"""
        return self.tools.get(name)
    
    def get_tools_by_category(self, category: str) -> List[CustomTool]:
        """Get all tools in a category"""
        tool_names = self.categories.get(category, [])
        return [self.tools[name] for name in tool_names]
    
    def get_all_tools(self) -> List[Callable]:
        """Get all tool functions (for AutoGen)"""
        return [tool.function for tool in self.tools.values()]
    
    def get_tools_list(self) -> List[Dict[str, Any]]:
        """Get list of all tools with info"""
        return [tool.get_info() for tool in self.tools.values()]
    
    def remove_tool(self, name: str) -> bool:
        """Remove a tool from registry"""
        if name in self.tools:
            tool = self.tools[name]
            category = tool.category
            
            del self.tools[name]
            
            if category in self.categories:
                self.categories[category].remove(name)
            
            return True
        
        return False
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get registry statistics"""
        return {
            "total_tools": len(self.tools),
            "categories": len(self.categories),
            "category_breakdown": {
                cat: len(tools) for cat, tools in self.categories.items()
            },
            "most_used_tools": sorted(
                [(tool.name, tool.call_count) for tool in self.tools.values()],
                key=lambda x: x[1],
                reverse=True
            )[:5]
        }

# Global registry
registry = CustomToolRegistry()

# Example custom tools

@registry.register_from_function(category="data_processing")
def parse_json_string(json_string: Annotated[str, "JSON string to parse"]) -> str:
    """Parse and validate a JSON string"""
    import json
    try:
        data = json.loads(json_string)
        return json.dumps(data, indent=2)
    except json.JSONDecodeError as e:
        return f"Invalid JSON: {str(e)}"

@registry.register_from_function(category="data_processing")
def csv_to_json(csv_data: Annotated[str, "CSV data"]) -> str:
    """Convert CSV data to JSON format"""
    import csv
    import json
    import io
    
    reader = csv.DictReader(io.StringIO(csv_data))
    data = list(reader)
    return json.dumps(data, indent=2)

@registry.register_from_function(category="text_processing")
def word_count(text: Annotated[str, "Text to count words in"]) -> str:
    """Count words in text"""
    words = text.split()
    return f"Word count: {len(words)}"

@registry.register_from_function(category="text_processing")
def extract_emails(text: Annotated[str, "Text to extract emails from"]) -> str:
    """Extract email addresses from text"""
    import re
    emails = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', text)
    return f"Found emails: {', '.join(emails)}" if emails else "No emails found"

@registry.register_from_function(category="math")
def calculate_percentage(
    part: Annotated[float, "Part value"],
    total: Annotated[float, "Total value"]
) -> str:
    """Calculate percentage"""
    if total == 0:
        return "Cannot divide by zero"
    percentage = (part / total) * 100
    return f"{part} is {percentage:.2f}% of {total}"

@registry.register_from_function(category="datetime")
def days_between_dates(
    date1: Annotated[str, "First date (YYYY-MM-DD)"],
    date2: Annotated[str, "Second date (YYYY-MM-DD)"]
) -> str:
    """Calculate days between two dates"""
    from datetime import datetime
    
    try:
        d1 = datetime.strptime(date1, "%Y-%m-%d")
        d2 = datetime.strptime(date2, "%Y-%m-%d")
        delta = abs((d2 - d1).days)
        return f"Days between dates: {delta}"
    except ValueError as e:
        return f"Invalid date format: {str(e)}"

@registry.register_from_function(category="validation")
def validate_email(email: Annotated[str, "Email to validate"]) -> str:
    """Validate email address format"""
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    
    if re.match(pattern, email):
        return f"✓ Valid email: {email}"
    else:
        return f"✗ Invalid email: {email}"

@registry.register_from_function(category="validation")
def validate_url(url: Annotated[str, "URL to validate"]) -> str:
    """Validate URL format"""
    import re
    pattern = r'^https?://[^\s/$.?#].[^\s]*$'
    
    if re.match(pattern, url):
        return f"✓ Valid URL: {url}"
    else:
        return f"✗ Invalid URL: {url}"

# Helper function to add custom tools
def add_custom_tool(
    name: str,
    description: str,
    function: Callable,
    category: str = "custom"
):
    """
    Helper function to add a custom tool.
    
    Usage:
        def my_tool(param: str) -> str:
            return f"Processed: {param}"
        
        add_custom_tool(
            "process_data",
            "Process data with my custom logic",
            my_tool,
            "processing"
        )
    """
    return registry.register_tool(name, description, function, category)

# Get tools for AutoGen
def get_custom_tools_for_agents(categories: List[str] = None) -> List[Callable]:
    """
    Get custom tools for AutoGen agents.
    
    Args:
        categories: List of categories to include, or None for all
        
    Returns:
        List of tool functions
    """
    if categories:
        tools = []
        for category in categories:
            tools.extend([t.function for t in registry.get_tools_by_category(category)])
        return tools
    else:
        return registry.get_all_tools()
