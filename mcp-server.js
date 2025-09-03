#!/usr/bin/env node

const { checkFeature } = require('./checkFeature');

/**
 * MCP Server for Baseline Web Features
 * Exposes web feature safety checking as agent-callable tools
 */
class BaselineMCPServer {
    constructor() {
        this.tools = [
            {
                name: "check_web_feature_safety",
                description: "Check if a web feature is safe to use based on Baseline browser support data",
                inputSchema: {
                    type: "object",
                    properties: {
                        feature: {
                            type: "string",
                            description: "The name of the web feature to check (e.g., 'flexbox', 'grid', 'fetch')"
                        }
                    },
                    required: ["feature"]
                }
            },
            {
                name: "get_feature_details",
                description: "Get detailed information about a web feature including browser support, specification, and recommendations",
                inputSchema: {
                    type: "object",
                    properties: {
                        feature: {
                            type: "string",
                            description: "The name of the web feature to get details for"
                        }
                    },
                    required: ["feature"]
                }
            }
        ];
    }

    /**
     * Handle tool calls from MCP clients
     */
    async handleToolCall(toolName, args) {
        try {
            switch (toolName) {
                case "check_web_feature_safety":
                    return this.checkFeatureSafety(args.feature);
                
                case "get_feature_details":
                    return this.getFeatureDetails(args.feature);
                
                default:
                    throw new Error(`Unknown tool: ${toolName}`);
            }
        } catch (error) {
            return {
                error: true,
                message: error.message,
                toolName: toolName,
                args: args
            };
        }
    }

    /**
     * Check if a web feature is safe to use
     */
    checkFeatureSafety(featureName) {
        const result = checkFeature(featureName);
        
        if (!result.found) {
            return {
                safe: false,
                found: false,
                feature: featureName,
                message: `Feature "${featureName}" not found in Baseline database`,
                suggestions: result.suggestions
            };
        }

        return {
            safe: result.safety === 'safe',
            canUse: result.safety !== 'unsafe',
            feature: result.feature,
            name: result.name,
            safety: result.safety,
            baseline: result.baseline,
            recommendation: result.recommendation,
            support: result.support,
            dates: {
                baselineLow: result.baselineLowDate,
                baselineHigh: result.baselineHighDate
            }
        };
    }

    /**
     * Get detailed feature information
     */
    getFeatureDetails(featureName) {
        const result = checkFeature(featureName);
        
        if (!result.found) {
            return {
                found: false,
                feature: featureName,
                message: `Feature "${featureName}" not found in Baseline database`,
                suggestions: result.suggestions
            };
        }

        return {
            found: true,
            feature: result.feature,
            name: result.name,
            description: result.description,
            safety: result.safety,
            baseline: result.baseline,
            recommendation: result.recommendation,
            support: result.support,
            spec: result.spec,
            group: result.group,
            dates: {
                baselineLow: result.baselineLowDate,
                baselineHigh: result.baselineHighDate
            }
        };
    }

    /**
     * Get available tools
     */
    getTools() {
        return this.tools;
    }
}

// MCP Server Protocol Implementation
class MCPProtocol {
    constructor() {
        this.server = new BaselineMCPServer();
        this.setupProtocol();
    }

    setupProtocol() {
        // Handle incoming JSON-RPC messages
        process.stdin.on('data', (data) => {
            try {
                const lines = data.toString().trim().split('\n');
                
                for (const line of lines) {
                    if (line.trim()) {
                        this.handleMessage(JSON.parse(line));
                    }
                }
            } catch (error) {
                this.sendError(-32700, 'Parse error', null);
            }
        });
    }

    async handleMessage(message) {
        try {
            switch (message.method) {
                case 'tools/list':
                    this.sendResponse(message.id, {
                        tools: this.server.getTools()
                    });
                    break;

                case 'tools/call':
                    const result = await this.server.handleToolCall(
                        message.params.name,
                        message.params.arguments
                    );
                    this.sendResponse(message.id, {
                        content: [{
                            type: "text",
                            text: JSON.stringify(result, null, 2)
                        }]
                    });
                    break;

                case 'initialize':
                    this.sendResponse(message.id, {
                        protocolVersion: "2024-11-05",
                        capabilities: {
                            tools: {}
                        },
                        serverInfo: {
                            name: "baseline-web-features",
                            version: "1.0.0"
                        }
                    });
                    break;

                default:
                    this.sendError(-32601, 'Method not found', message.id);
                    break;
            }
        } catch (error) {
            this.sendError(-32603, 'Internal error', message.id);
        }
    }

    sendResponse(id, result) {
        const response = {
            jsonrpc: "2.0",
            id: id,
            result: result
        };
        process.stdout.write(JSON.stringify(response) + '\n');
    }

    sendError(code, message, id) {
        const response = {
            jsonrpc: "2.0",
            id: id,
            error: {
                code: code,
                message: message
            }
        };
        process.stdout.write(JSON.stringify(response) + '\n');
    }
}

// Start MCP server if run directly
if (require.main === module) {
    console.error('Starting Baseline Web Features MCP Server...');
    new MCPProtocol();
}

module.exports = { BaselineMCPServer, MCPProtocol };