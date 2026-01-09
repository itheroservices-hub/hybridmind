# HybridMind

A fast, multi‑provider AI coding assistant with a clean workflow and a rock‑solid v1.0 foundation. HybridMind brings flexible model switching, smart completions, and a streamlined developer experience — with premium features coming in v1.1.

## 🏗️ Architecture

HybridMind consists of two parts:
1. **Backend Server** (Node.js API) - Handles AI model orchestration
2. **VS Code Extension** - User interface in your editor

Both must be running for the extension to work.

## 🚀 Quick Start

### 1. Install VS Code Extension
Install from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=hybridmind.hybridmind)

### 2. Set Up Backend
```bash
# Clone this repository
git clone https://github.com/itheroservices-hub/hybridmind.git
cd hybridmind

# Install dependencies
npm install

# Configure API keys
cp .env.example .env
# Edit .env with your API keys

# Start backend server
npm start
```

**Or use the quick-start scripts:**
- Windows: `start-backend.bat`
- Mac/Linux: `./start-backend.sh`

### 3. Use the Extension
1. Select code in VS Code
2. Press `Ctrl+Shift+P`
3. Type "HybridMind" and choose a command

## 📚 Documentation
See [Extension README](hybridmind-extension/README.md) for full documentation.
