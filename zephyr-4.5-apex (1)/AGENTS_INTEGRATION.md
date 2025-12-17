Zephyr Multi-Agent Starter Files

Files added:
- src/agents/agents.js
- src/agents/agentManager.js

How to use:
1. Import runAgents in your chat component:
   import { runAgents } from './agents/agentManager';

2. Provide a callAPI function that accepts {system, user} and returns a string (AI response).

3. Call runAgents(userMessage, callAPI) to get array of {agent, output} results.
