# 🔌 **MCP Setup Guide - Use Baseline Tools with Claude**

## **Quick Start (Works Right Now)**

### **1. Your MCP Server is Ready**
```bash
# Already running at:
# - API Server: http://localhost:3000
# - MCP Server: Ready to accept JSON-RPC calls
```

### **2. How to Use with Claude Desktop**

**Step A: Create Config File**
Create this file: `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

```json
{
  "mcpServers": {
    "baseline-web-features": {
      "command": "node",
      "args": ["C:\\Users\\lokas\\baseline-hackathon\\mcp-server.js"],
      "cwd": "C:\\Users\\lokas\\baseline-hackathon"
    }
  }
}
```

**Step B: Restart Claude Desktop**
- Tools will appear automatically
- No additional setup needed

### **3. Available MCP Tools**

Once connected, Claude gets these tools:

#### **Tool 1: `check_web_feature_safety`**
- **Purpose:** Quick safety check for web features
- **Usage:** "Is fetch() safe to use?"
- **Returns:** Safety level + browser support

#### **Tool 2: `get_feature_details`** 
- **Purpose:** Comprehensive feature information
- **Usage:** "Tell me everything about CSS grid"
- **Returns:** Full Baseline data + recommendations

## **What You Can Ask Claude**

### **Safety Questions:**
- "Is String.replaceAll() safe for production?"
- "Should I use container queries in my project?"
- "What's the Baseline status of subgrid?"

### **Code Analysis:**
- "Analyze this JavaScript for unsafe features"
- "Check if this CSS is Baseline-compatible"
- "What web features are risky in this code?"

### **Recommendations:**
- "What's a safe alternative to replaceAll()?"
- "How can I make this code more compatible?"
- "What fallbacks do I need for this feature?"

## **Example Conversations**

### **Conversation 1: Feature Safety**
👤 **User:** "Is the CSS :has() selector safe to use?"

🤖 **Claude:** *[Calls check_web_feature_safety tool with "has-selector"]*
"The :has() selector has **caution** level safety with **low** Baseline support. While it works in modern browsers (Chrome 105+, Firefox 121+, Safari 15.4+), you should use with caution and consider JavaScript alternatives for broader compatibility."

### **Conversation 2: Code Review**
👤 **User:** "Review this code for Baseline compatibility:"
```javascript
const data = await fetch('/api/users');
const cleaned = text.replaceAll(' ', '_');
```

🤖 **Claude:** *[Calls tools for each feature]*
"I found 2 web features in your code:

✅ **fetch()** - **SAFE** (Baseline high since 2018)
✅ **String.replaceAll()** - **SAFE** (Baseline high since 2024)

Both features are safe for production use! Your code follows modern Baseline standards."

### **Conversation 3: Alternatives**
👤 **User:** "What's a safer alternative to CSS subgrid?"

🤖 **Claude:** *[Calls get_feature_details for "subgrid"]*
"CSS subgrid has **caution** level support (Baseline low). Here are safer alternatives:

1. **Regular CSS Grid** (Baseline high) - Use nested grids
2. **Flexbox** (Baseline high) - For simpler layouts  
3. **CSS Grid with explicit sizing** - More predictable

Would you like me to show code examples for any of these approaches?"

## **Technical Setup Details**

### **MCP Server Status**
- **Protocol:** JSON-RPC 2.0
- **Transport:** stdio (standard input/output)
- **Tools:** 2 available tools
- **Data Source:** Official web-features package
- **Update Frequency:** Real-time Baseline data

### **Configuration Options**
```json
{
  "mcpServers": {
    "baseline-web-features": {
      "command": "node",
      "args": ["path/to/mcp-server.js"],
      "cwd": "path/to/baseline-hackathon",
      "env": {
        "NODE_ENV": "production",
        "API_ENDPOINT": "http://localhost:3000"
      }
    }
  }
}
```

## **Troubleshooting**

### **Common Issues:**

1. **"Tools not appearing"**
   - Check config file location
   - Restart Claude Desktop completely
   - Verify file paths are correct

2. **"Connection error"**  
   - Ensure API server is running: `npm start`
   - Check Node.js is in PATH
   - Verify file permissions

3. **"Feature not found"**
   - Try different feature names (e.g., "grid" not "css-grid")  
   - Check spelling and casing
   - Use common feature names

### **Success Indicators:**
- Claude mentions "using tools" when you ask about web features
- Responses include specific browser support data
- Recommendations are contextual and detailed

---

**🎉 Ready to Use!** Claude now has real-time access to Baseline web feature data and can help make your code more compatible and standards-compliant.