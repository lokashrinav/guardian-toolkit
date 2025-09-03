#!/usr/bin/env node

const { checkFeature } = require('./checkFeature');

class MinimalMCPServer {
    constructor() {
        this.setupStdio();
    }

    setupStdio() {
        let buffer = '';
        
        process.stdin.on('data', (data) => {
            buffer += data.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const message = JSON.parse(line);
                        this.handleMessage(message);
                    } catch (error) {
                        this.sendError(-32700, 'Parse error', null);
                    }
                }
            }
        });

        process.on('SIGTERM', () => process.exit(0));
        process.on('SIGINT', () => process.exit(0));
    }

    async handleMessage(request) {
        const { id, method, params } = request;

        try {
            switch (method) {
                case 'initialize':
                    this.sendResponse(id, {
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

                case 'tools/list':
                    this.sendResponse(id, {
                        tools: [
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
                        ]
                    });
                    break;

                case 'tools/call':
                    const toolResult = await this.callTool(params.name, params.arguments);
                    this.sendResponse(id, {
                        content: [{
                            type: "text",
                            text: JSON.stringify(toolResult, null, 2)
                        }]
                    });
                    break;

                default:
                    this.sendError(-32601, 'Method not found', id);
            }
        } catch (error) {
            this.sendError(-32603, 'Internal error', id);
        }
    }

    async callTool(toolName, args) {
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

if (require.main === module) {
    new MinimalMCPServer();
}

module.exports = MinimalMCPServer;