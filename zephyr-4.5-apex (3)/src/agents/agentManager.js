import { agents } from "./agents";

/**
 * runAgents - send user message to all agents sequentially
 * callAPI must be a function: async ({system, user}) => string
 */
export async function runAgents(userMessage, callAPI) {
  const results = [];
  for (const agent of agents) {
    try {
      const output = await callAPI({
        system: agent.instructions,
        user: userMessage,
      });
      results.push({ agent: agent.name, output });
    } catch (err) {
      results.push({ agent: agent.name, output: "Error: " + String(err) });
    }
  }
  return results;
}

/**
 * selectAgent - pick the best agent automatically by keyword matching
 */
export async function selectAgent(userMessage) {
  const keywords = {
    "news": "News Agent",
    "current": "News Agent",
    "latest": "News Agent",

    "math": "Science Agent",
    "physics": "Science Agent",
    "chemistry": "Science Agent",
    "numerical": "Science Agent",

    "code": "Coder Agent",
    "error": "Coder Agent",
    "debug": "Coder Agent",
    "react": "Coder Agent",
    "python": "Coder Agent",
    "arduino": "Coder Agent",

    "story": "Creative Agent",
    "poem": "Creative Agent",
    "hindi": "Creative Agent",
    "write": "Creative Agent"
  };

  // Auto detection based on keywords
  for (const key in keywords) {
    if (userMessage.toLowerCase().includes(key)) {
      return agents.find(a => a.name === keywords[key]);
    }
  }

  // Default fallback agent
  return agents.find(a => a.name === "Creative Agent");
}
