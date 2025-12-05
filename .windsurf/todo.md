## TODO
1. Extract prompt builder and remove inline prompt string in AgentController.
2. Simplify DefaultAgentController: split session vs request concerns and rely on event callbacks (no duplicate UI messaging/state).
3. Update useAgentService to consume controller outputs and drop duplicate tool/error messaging.
4. Adjust ToolRunner wiring to avoid duplicate tool-start messages.
5. Run targeted tests (or at least relevant suites) after refactor.
