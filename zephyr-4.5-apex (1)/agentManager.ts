export function generateImageUrl(prompt: string) {
  return `https://pollinations.ai/p/${encodeURIComponent(prompt)}?width=768&height=768`;
}

export interface Agent {
  name: string;
  role: string;
  description: string;
  instructions: string;
}

export const agents: Agent[] = [
  {
    name: "News Agent",
    role: "News Reporter",
    description: "Fetches and summarizes latest news using search tools.",
    instructions: "You are a News Agent. Your primary tool is Google Search. Always search for the latest information on the user's topic. Summarize the results clearly, providing facts, dates, and citing sources. Do not speculate; verify."
  },
  {
    name: "Science Agent",
    role: "Science Expert",
    description: "Solves physics, math, and chemistry problems.",
    instructions: "You are a Science Agent. Solve numerical problems step-by-step. Explain formulas, show units, and provide clear scientific explanations. If the user asks a math question, solve it with precision."
  },
  {
    name: "Coder Agent",
    role: "Senior Software Engineer",
    description: "Debugs, explains, and writes code.",
    instructions: "You are a Coder Agent. Your expertise is in JavaScript, Python, React, and general programming. Specific tasks: 1. Find bugs. 2. Explain the fix. 3. Provide the corrected code. Follow best practices and write clean, commented code."
  },
  {
    name: "Creative Agent",
    role: "Creative Writer",
    description: "Writes stories, poems, and creative content.",
    instructions: "You are a Creative Agent. Unleash your creativity. Write engaging stories, vivid poems, and imaginative scripts. If requested, write in specific styles or languages (like Hindi)."
  }
];

export async function selectAgent(userMessage: string): Promise<Agent | undefined> {
  const lowerMsg = userMessage.toLowerCase();

  // News keywords
  if (/\b(news|headline|current|update|latest|search|event|happened|today|yesterday|world)\b/i.test(lowerMsg)) {
    return agents.find(a => a.name === "News Agent");
  }

  // Science keywords
  if (/\b(math|physics|chemistry|formula|calculate|equation|science|numerical|algebra|calculus|biology|atom|energy)\b/i.test(lowerMsg)) {
    return agents.find(a => a.name === "Science Agent");
  }

  // Coder keywords
  if (/\b(code|debug|python|javascript|react|typescript|error|fix|programming|function|api|variable|compile|script|html|css)\b/i.test(lowerMsg)) {
    return agents.find(a => a.name === "Coder Agent");
  }

  // Creative keywords
  if (/\b(story|poem|write|tale|fiction|creative|song|haiku|script|novel|lyrics|narrative)\b/i.test(lowerMsg)) {
    return agents.find(a => a.name === "Creative Agent");
  }

  // Default to undefined (Zephyr)
  return undefined;
}