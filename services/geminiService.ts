import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { DR_RHESUS_SYSTEM_INSTRUCTION } from '../constants';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export function createChatSession(): Chat {
  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: DR_RHESUS_SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
    },
  });
  return chat;
}

export async function sendMessage(chat: Chat, message: string): Promise<string> {
  try {
    const response = await chat.sendMessage({ message });
    return response.text;
  } catch (error: any) {
    console.error("Error sending message to Gemini:", error);
    // Construct a JSON string representing the error to maintain the expected response format.
    return JSON.stringify({
        prose: `I'm sorry, I encountered an error: ${error.message || 'An unknown error occurred.'}`,
        tool_calls: [],
        actions: []
    });
  }
}

export async function sendMessageWithSearch(message: string): Promise<GenerateContentResponse> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
      config: {
        tools: [{googleSearch: {}}],
        systemInstruction: `You are Dr. Rhesus, an expert bioinformatics research assistant. When asked to perform a BLAST search, use your web search capabilities to find the most relevant and up-to-date information on similar protein sequences. Present the findings in a concise, clear summary. If you find details like protein descriptions, scores, E-values, and sequence identity from your search, include them. Always cite your sources at the end of your response.`,
      },
    });
    return response;
  } catch(error) {
     console.error("Error sending message with search to Gemini:", error);
     throw error;
  }
}


// --- EMBL-EBI BLAST Service via Local API Proxy ---
const BLAST_API_ENDPOINT = '/api/blast'; // Our own backend proxy

interface SubmitBlastJobParams {
  program: 'blastp'; // For now, only protein blast
  database: string;
  sequence: string;
}

export async function submitBlastJob({ program, database, sequence }: SubmitBlastJobParams): Promise<string> {
  const response = await fetch(`${BLAST_API_ENDPOINT}?action=run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ program, database, sequence }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to submit BLAST job. The server returned an invalid response.' }));
    throw new Error(errorData.error);
  }

  const data = await response.json();
  if (!data.jobId) {
      throw new Error("Server response did not include a BLAST Job ID.");
  }
  return data.jobId;
}

export async function checkJobStatus(jobId: string): Promise<string> {
  const response = await fetch(`${BLAST_API_ENDPOINT}?action=status&jobId=${jobId}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: `Failed to check job status. Server responded with ${response.status}` }));
    throw new Error(errorData.error);
  }
  const data = await response.json();
  return data.status;
}

export async function getBlastResults(jobId: string): Promise<any> {
    const response = await fetch(`${BLAST_API_ENDPOINT}?action=result&jobId=${jobId}`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Failed to fetch BLAST results. Server responded with ${response.status}` }));
        throw new Error(errorData.error);
    }
    return await response.json();
}

export async function summarizeBlastResults(resultsJson: any): Promise<string> {
  try {
    // The top hits might be nested differently depending on the result structure
    const hits = resultsJson?.results?.hits || resultsJson?.hits || [];
    if (hits.length === 0) {
        return JSON.stringify({
            prose: "The BLAST search completed but returned no significant hits."
        });
    }

    const topHits = hits.slice(0, 5).map((hit: any) => ({
      description: hit.description,
      evalue: hit.hsps[0].evalue,
      identity: hit.hsps[0].identity,
    }));

    const prompt = `Please provide a concise summary of the following top 5 BLAST results for a protein search. Focus on the most significant matches based on E-value and identity.

    Results:
    ${JSON.stringify(topHits, null, 2)}
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            systemInstruction: `You are Dr. Rhesus, an expert bioinformatician. Your response must be a valid JSON object with a single key "prose" that contains your summary.`,
            responseMimeType: 'application/json',
        }
    });

    return response.text;
  } catch (error: any) {
    console.error("Error summarizing BLAST results:", error);
    return JSON.stringify({
        prose: `I'm sorry, I encountered an error while summarizing the BLAST results: ${error.message || 'An unknown error occurred.'}`,
    });
  }
}
