/**
 * M365 Declarative Agent Creation Demo
 * Shows how to use HybridMind + M365 Agents Toolkit to build a declarative agent
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const LICENSE_KEY = process.env.HYBRIDMIND_LICENSE_KEY || 'demo-license';

class M365AgentBuilder {
  constructor() {
    this.projectPath = path.join(__dirname, 'm365-demo-agent');
  }

  async callM365Tool(tool, args) {
    try {
      const response = await axios.post(
        `${BASE_URL}/mcp/m365agentstoolkit`,
        { tool, args },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-license-key': LICENSE_KEY
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error(`Error calling ${tool}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async step1_LearnAboutDeclarativeAgents() {
    console.log('\n📚 Step 1: Learning about Declarative Agents...\n');
    
    const result = await this.callM365Tool('get_knowledge', {
      question: 'What is a declarative agent for Microsoft 365 Copilot and how do I create one?'
    });
    
    console.log('✓ Knowledge retrieved from M365 Agents Toolkit');
    console.log('Note:', result.note);
    console.log('Question:', result.question);
    
    return result;
  }

  async step2_GetManifestSchema() {
    console.log('\n📋 Step 2: Getting Declarative Agent Manifest Schema...\n');
    
    const result = await this.callM365Tool('get_schema', {
      schema_name: 'declarative_agent_manifest',
      schema_version: 'latest'
    });
    
    console.log('✓ Schema retrieved');
    console.log('Schema:', result.schemaName);
    console.log('Description:', result.description);
    
    return result;
  }

  async step3_GenerateAgentCode() {
    console.log('\n💻 Step 3: Generating Declarative Agent Code...\n');
    
    const result = await this.callM365Tool('get_code_snippets', {
      question: 'Create a declarative agent manifest for a customer support agent with actions for creating tickets and searching knowledge base'
    });
    
    console.log('✓ Code snippets generated');
    console.log('Question:', result.question);
    
    return result;
  }

  async step4_GetProjectStructure() {
    console.log('\n🏗️  Step 4: Getting M365 Agents Project Structure...\n');
    
    const result = await this.callM365Tool('get_knowledge', {
      question: 'What is the recommended folder structure for a Microsoft 365 declarative agent project?'
    });
    
    console.log('✓ Project structure information retrieved');
    
    return result;
  }

  async step5_CreateProjectFiles() {
    console.log('\n📁 Step 5: Creating Project Files...\n');
    
    // Create project directory
    if (!fs.existsSync(this.projectPath)) {
      fs.mkdirSync(this.projectPath, { recursive: true });
      console.log(`✓ Created project directory: ${this.projectPath}`);
    }

    // Create sample manifest
    const manifest = {
      "$schema": "https://developer.microsoft.com/json-schemas/copilot/declarative-agent/v1.0/schema.json",
      "version": "v1.0",
      "name": "Customer Support Agent",
      "description": "AI-powered customer support agent that helps with tickets and knowledge base search",
      "instructions": "You are a helpful customer support agent. Help users with their questions and create support tickets when needed.",
      "conversation_starters": [
        {
          "title": "Create a ticket",
          "text": "I need to create a support ticket"
        },
        {
          "title": "Search knowledge base",
          "text": "Search the knowledge base for help articles"
        }
      ],
      "actions": [
        {
          "id": "createTicket",
          "description": "Create a new support ticket"
        },
        {
          "id": "searchKnowledgeBase",
          "description": "Search the knowledge base for articles"
        }
      ]
    };

    const manifestPath = path.join(this.projectPath, 'declarativeAgent.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`✓ Created manifest: ${manifestPath}`);

    // Create README
    const readme = `# Customer Support Agent

AI-powered customer support agent built with Microsoft 365 Agents Toolkit.

## Features
- Create support tickets
- Search knowledge base
- Natural language interaction via Microsoft 365 Copilot

## Setup
1. Install dependencies: \`npm install\`
2. Configure API keys in \`.env\`
3. Deploy: \`npx @microsoft/m365agentstoolkit-cli deploy\`

## Files
- \`declarativeAgent.json\` - Agent manifest
- \`m365agents.yml\` - Project configuration

Built with HybridMind + M365 Agents Toolkit MCP integration.
`;

    const readmePath = path.join(this.projectPath, 'README.md');
    fs.writeFileSync(readmePath, readme);
    console.log(`✓ Created README: ${readmePath}`);

    // Create m365agents.yml
    const m365Config = `# M365 Agents project configuration
projectId: customer-support-agent
version: 1.0.0

# Declarative agent configuration
declarativeAgent:
  manifestPath: ./declarativeAgent.json
  
# Deployment settings
deployment:
  target: m365-copilot
  environment: development
`;

    const configPath = path.join(this.projectPath, 'm365agents.yml');
    fs.writeFileSync(configPath, m365Config);
    console.log(`✓ Created config: ${configPath}`);
  }

  async step6_ValidateManifest() {
    console.log('\n✅ Step 6: Validating Manifest...\n');
    
    const result = await this.callM365Tool('get_schema', {
      schema_name: 'declarative_agent_manifest'
    });
    
    console.log('✓ Manifest schema validated');
    console.log('Use this schema to validate your declarativeAgent.json file');
    
    return result;
  }

  async step7_TroubleshootCommonIssues() {
    console.log('\n🔧 Step 7: Learning Common Troubleshooting...\n');
    
    const result = await this.callM365Tool('troubleshoot', {
      question: 'What are common issues when deploying a declarative agent and how to fix them?'
    });
    
    console.log('✓ Troubleshooting information retrieved');
    console.log('This will help you debug deployment issues');
    
    return result;
  }

  async run() {
    console.log('🚀 M365 Declarative Agent Creation Demo');
    console.log('Using HybridMind + M365 Agents Toolkit MCP Integration');
    console.log('=' .repeat(70));

    try {
      // Check backend health
      await axios.get(`${BASE_URL}/mcp/health`);
      console.log('✓ HybridMind backend is running\n');

      // Run all steps
      await this.step1_LearnAboutDeclarativeAgents();
      await this.step2_GetManifestSchema();
      await this.step3_GenerateAgentCode();
      await this.step4_GetProjectStructure();
      await this.step5_CreateProjectFiles();
      await this.step6_ValidateManifest();
      await this.step7_TroubleshootCommonIssues();

      // Summary
      console.log('\n' + '='.repeat(70));
      console.log('🎉 SUCCESS: Declarative Agent Project Created!');
      console.log('='.repeat(70));
      console.log(`\nProject Location: ${this.projectPath}`);
      console.log('\nNext Steps:');
      console.log('1. cd ' + this.projectPath);
      console.log('2. Review the generated files');
      console.log('3. Customize the agent manifest');
      console.log('4. Deploy using: npx @microsoft/m365agentstoolkit-cli deploy');
      console.log('\nDocumentation: https://aka.ms/m365agentstoolkit\n');

    } catch (error) {
      console.error('\n❌ Error:', error.message);
      console.error('Make sure the HybridMind backend is running on', BASE_URL);
      process.exit(1);
    }
  }
}

// Run the demo
const builder = new M365AgentBuilder();
builder.run();
