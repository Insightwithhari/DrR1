import { GoogleGenerativeAI, ChatSession, HarmBlockThreshold, HarmCategory, GenerateContentResponse } from "@google/generative-ai";
import { DR_RHESUS_SYSTEM_INSTRUCTION } from '../constants';

const ai = new GoogleGenerativeAI(process.env.API_KEY);

export function createChatSession(): ChatSession {
  const model = ai.getGenerativeModel({
    model: 'gemini-1.5-flash',  // Adjusted to existing model; update to 'gemini-2.5-flash' if available in 2025
    systemInstruction: DR_RHESUS_SYSTEM_INSTRUCTION,
    generationConfig: {
      responseMIMEType: 'application/json',
    },
    safetySettings: [  // Optional: Added basic safety settings to prevent blocking; adjust as needed
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      // Add more categories if required
    ],
  });
  const chat = model.startChat();
  return chat;
}

export async function sendMessage(chat: ChatSession, message: string): Promise<string> {
  try {
    const response = await chat.sendMessage(message);  // Corrected: sendMessage takes a string or Content, not an object { message }
    return response.response.text();
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
    const model = ai.getGenerativeModel({
      model: 'gemini-1.5-flash',  // Adjusted similarly
      systemInstruction: `You are Dr. Rhesus, an expert bioinformatics research assistant. When asked to perform a BLAST search, use your web search capabilities to find the most relevant and up-to-date information on similar protein sequences. Present the findings in a concise, clear summary. If you find details like protein descriptions, scores, E-values, and sequence identity from your search, include them. Always cite your sources at the end of your response.`,
      tools: [{ google_search_retrieval: {} }],  // Corrected tool name for Google Search grounding
    });
    const response = await model.generateContent(message);  // Simplified: generateContent takes content directly; config moved to model
    return response;
  } catch(error) {
     console.error("Error sending message with search to Gemini:", error);
     throw error;
  }
}


// --- EMBL-EBI BLAST Service ---
// NOTE: A CORS proxy is used for client-side API calls to EMBL-EBI. The API appears correct based on documentation.
const PROXY_URL = 'https://cors.sh/';
const EBI_API_URL = 'https://www.ebi.ac.uk/Tools/services/rest/ncbiblast';
const EMAIL = 'test@example.com'; // A generic email is required by the API; use a real one for production to comply with terms.

interface SubmitBlastJobParams {
  program: 'blastp'; // For now, only protein blast
  database: string;
  sequence: string;
}

export async function submitBlastJob({ program, database, sequence }: SubmitBlastJobParams): Promise<string> {
  const formData = new FormData();
  formData.append('email', EMAIL);
  formData.append('program', program);
  formData.append('stype', 'protein'); // Specify sequence type
  formData.append('database', database);
  formData.append('sequence', sequence);

  const response = await fetch(`${PROXY_URL}${EBI_API_URL}/run`, {
    method: 'POST',
    body: formData,
    headers: { 'Accept': 'text/plain' }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to submit BLAST job: ${errorText}`);
  }

  return await response.text();
}

export async function checkJobStatus(jobId: string): Promise<string> {
  const response = await fetch(`${PROXY_URL}${EBI_API_URL}/status/${jobId}`);
  if (!response.ok) throw new Error(`Failed to check job status. Server responded with ${response.status}`);
  return await response.text();
}

export async function getBlastResults(jobId: string): Promise<any> {
    const response = await fetch(`${PROXY_URL}${EBI_API_URL}/result/${jobId}/json`);
    if (!response.ok) throw new Error(`Failed to fetch BLAST results. Server responded with ${response.status}`);
    return await response.json();
}

export async function summarizeBlastResults(resultsJson: any): Promise<string> {
  try {
    const topHits = resultsJson.results.hits.slice(0, 5).map((hit: any) => ({
      description: hit.description,
      evalue: hit.hsps[0].evalue,
      identity: hit.hsps[0].identity,
    }));

    const prompt = `Please provide a concise summary of the following top 5 BLAST results for a protein search. Focus on the most significant matches based on E-value and identity.

    Results:
    ${JSON.stringify(topHits, null, 2)}
    `;

    const model = ai.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMIMEType: 'application/json',
      },
      systemInstruction: `You are Dr. Rhesus, an expert bioinformatician. Your response must be a valid JSON object with a single key "prose" that contains your summary.`,
    });

    const response = await model.generateContent(prompt);
    return response.response.text();
  } catch (error: any) {
    console.error("Error summarizing BLAST results:", error);
    return JSON.stringify({
        prose: `I'm sorry, I encountered an error while summarizing the BLAST results: ${error.message || 'An unknown error occurred.'}`,
    });
  }
}
