export class Renderer {
  public renderHelp(hasWorkspace: boolean = true): void {
    const flagsHelp = `
Flags (Startup Options):
  --agent                Use new Agent mode (legacy mode is default without this flag)
  --llm <provider>       LLM Provider (mock, openai). Default: mock
  --model <model>        Model ID. Default for openai: gpt-4o-mini
  --api-key <key>        OpenAI API Key (required for openai provider). Recommendation: use $OPENAI_API_KEY environment variable if possible
  --project <id>         Project/Workspace ID
  --session <id>         Session ID
  --debug                Enable debug mode
`;

    if (!hasWorkspace) {
      console.log(`
Global Context (No workspace selected)
${flagsHelp}
Available Commands:
  /help                  Show this help message
  /version               Show version number
  /debug                 Enable debug mode with detailed logs
  /list                  List available workspaces
  /use <workspace>       Select a workspace to enter
  /create <workspace>    Create a new workspace
  /exit                  Exit the CLI
`);
    } else {
      console.log(`
Workspace Context

Usage: agentframework [message]
${flagsHelp}
Internal Commands:
  /help                  Show this help message
  /session               Manage sessions
  /close                 Close the current workspace and return to global context
  /exit                  Exit the CLI

Examples:
  <workspace> >> quiero crear una app
  <workspace> >> analiza este error
`);
    }
  }

  public renderVersion(version: string): void {
    console.log(`agentframework version ${version}`);
  }

  public renderResponse(response: any): void {
    if (typeof response === 'string') {
      console.log(response);
      return;
    }

    // Handle AgentRunResult
    if (response && typeof response === 'object' && response.success !== undefined) {
      if (!response.success) {
        this.renderError(new Error(response.error || 'Agent execution failed'), false);
        return;
      }
      if (response.result && response.result.message) {
        console.log(`\x1b[32m[Agent]\x1b[0m ${response.result.message}`);
        return;
      }
      // Fallback for AgentRunResult if no message
      console.log(JSON.stringify(response, null, 2));
      return;
    }

    if (response && typeof response === 'object' && typeof response.type === 'string' && typeof response.content === 'string') {
      if (response.type === 'message') {
        console.log(response.content);
        return;
      }
      if (response.type === 'error') {
        this.renderError(new Error(response.content), false);
        return;
      }
      if (response.type === 'approval_required') {
        console.log(`\x1b[36mApproval required:\x1b[0m ${response.content}`);
        return;
      }
    }

    console.log(JSON.stringify(response, null, 2));
  }

  public renderError(error: Error, debug: boolean): void {
    console.error(`\n\x1b[31mError: ${error.message}\x1b[0m\n`);
    if (debug && error.stack) {
      console.error(`\x1b[90m[DEBUG TRACE]\n${error.stack}\x1b[0m\n`);
    }
  }

  public renderDebug(message: string, data?: any): void {
    console.log(`\x1b[90m[DEBUG] ${message}\x1b[0m`);
    if (data) {
      console.log(`\x1b[90m${JSON.stringify(data, null, 2)}\x1b[0m`);
    }
  }
}
