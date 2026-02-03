/**
 * SCRIBE Agent - Communication
 * 
 * Translates agent activities into natural language.
 * Generates reports and handles user interactions.
 */

import { z } from 'zod';
import { ChatAnthropic } from "@langchain/anthropic";
import { PromptTemplate } from "@langchain/core/prompts";
import { 
  TradeExplanation, 
  PortfolioReport, 
  Report, 
  ConversationContext, 
  QueryResponse, 
  AgentActivity 
} from '@aegis/shared';

export const ScribeConfigSchema = z.object({
  language: z.string().default('en'),
  verbosity: z.enum(['minimal', 'normal', 'detailed']).default('normal'),
  includeEmojis: z.boolean().default(true),
  modelName: z.string().default('claude-3-5-sonnet-20240620'),
});

export type ScribeConfig = z.infer<typeof ScribeConfigSchema>;

export class Scribe {
  private config: ScribeConfig;
  private llm: ChatAnthropic;

  constructor(config: Partial<ScribeConfig> = {}) {
    this.config = ScribeConfigSchema.parse(config);
    this.llm = new ChatAnthropic({
      modelName: this.config.modelName,
      temperature: 0.7,
    });
  }

  /**
   * Explain a trade decision
   */
  async explainTrade(trade: TradeExplanation): Promise<string> {
    const prompt = PromptTemplate.fromTemplate(`
      You are Scribe, an AI DeFi assistant. Explain the following trade decision to a user.
      
      Trade Details:
      Action: {action}
      Input: {inputToken}
      Output: {outputToken}
      Amount: {amount}
      Reason: {reason}
      Confidence: {confidence}
      
      Style guide:
      - Tone: Professional but conversational
      - Language: {language}
      - Verbosity: {verbosity}
      - Use Emojis: {includeEmojis}
      
      Explain why this trade was made and what the expected outcome is.
    `);

    const formattedPrompt = await prompt.format({
      action: trade.action,
      inputToken: trade.inputToken,
      outputToken: trade.outputToken,
      amount: trade.amount,
      reason: trade.reason,
      confidence: trade.confidence,
      language: this.config.language,
      verbosity: this.config.verbosity,
      includeEmojis: this.config.includeEmojis ? 'yes' : 'no'
    });

    const response = await this.llm.invoke(formattedPrompt);
    return typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
  }

  /**
   * Generate a portfolio report
   */
  async generateReport(portfolio: PortfolioReport): Promise<Report> {
    const prompt = PromptTemplate.fromTemplate(`
      You are Scribe, an AI DeFi assistant. Generate a {period} portfolio report.
      
      Portfolio Data:
      Start Value: {startValue}
      End Value: {endValue}
      Top Performers: {topPerformers}
      Bottom Performers: {bottomPerformers}
      Key Insights: {insights}
      
      Create a summary and detailed sections.
      Return the result as a JSON object with the following structure:
      {{
        "title": "Report Title",
        "summary": "Executive summary...",
        "sections": [
          {{ "heading": "Section Title", "content": "Section content..." }}
        ]
      }}
    `);

    const formattedPrompt = await prompt.format({
      period: portfolio.period,
      startValue: portfolio.startValue,
      endValue: portfolio.endValue,
      topPerformers: JSON.stringify(portfolio.topPerformers),
      bottomPerformers: JSON.stringify(portfolio.bottomPerformers),
      insights: JSON.stringify(portfolio.insights)
    });

    const response = await this.llm.invoke(formattedPrompt);
    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    
    // Simple JSON parsing (in production, use structured output parsers)
    try {
      // Find JSON substring if wrapped in markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      const parsed = JSON.parse(jsonStr);
      
      return {
        title: parsed.title || `${portfolio.period} Report`,
        summary: parsed.summary || "Summary generation failed.",
        sections: parsed.sections || [],
        generatedAt: new Date()
      };
    } catch (e) {
      console.error("Failed to parse LLM response for report", e);
      return {
        title: `${portfolio.period} Report (Error)`,
        summary: "Could not generate report due to parsing error.",
        sections: [{ heading: "Raw Output", content: content }],
        generatedAt: new Date()
      };
    }
  }

  /**
   * Handle natural language user query
   */
  async handleQuery(query: string, context: ConversationContext): Promise<QueryResponse> {
    const prompt = PromptTemplate.fromTemplate(`
      You are Scribe, the interface for the AEGIS DeFi swarm.
      User Query: {query}
      
      Context:
      Portfolio Value: {portfolioValue}
      Previous Messages: {previousMessages}
      
      Answer the user's question. If they are asking to perform an action (trade, check price, etc.), suggest it.
      
      Return JSON:
      {{
        "answer": "Your answer here...",
        "suggestedActions": ["action1", "action2"]
      }}
    `);

    const formattedPrompt = await prompt.format({
      query: query,
      portfolioValue: context.portfolio?.totalValue || "Unknown",
      previousMessages: JSON.stringify(context.previousMessages.slice(-5)) // context window
    });

    const response = await this.llm.invoke(formattedPrompt);
    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : content;
      const parsed = JSON.parse(jsonStr);
      
      return {
        answer: parsed.answer,
        suggestedActions: parsed.suggestedActions,
        relatedData: parsed.relatedData
      };
    } catch (e) {
      return {
        answer: content,
        suggestedActions: []
      };
    }
  }

  /**
   * Summarize agent activity
   */
  async summarizeActivity(activities: AgentActivity[]): Promise<string> {
    const prompt = PromptTemplate.fromTemplate(`
      Summarize the following recent agent activities into a concise update feed.
      
      Activities:
      {activities}
      
      Keep it brief and engaging.
    `);

    const formattedPrompt = await prompt.format({
      activities: JSON.stringify(activities.map(a => ({
        agent: a.agent,
        action: a.action,
        outcome: a.outcome
      })))
    });

    const response = await this.llm.invoke(formattedPrompt);
    return typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
  }
}
