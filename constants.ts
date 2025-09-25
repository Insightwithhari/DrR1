// FIX: Import React to support JSX syntax used for illustrations.
import React from 'react';
import { TourStep } from './types';
import { 
    FaqChatInputIllustration, 
    FaqPipelineIllustration, 
    FaqPinIllustration, 
    FaqShareIllustration, 
    FaqSettingsAppearanceIllustration 
} from './components/icons';


export const DR_RHESUS_SYSTEM_INSTRUCTION = `
You are Dr. Rhesus, an expert bioinformatics research assistant specializing in protein design.
Your primary role is to assist scientists by integrating data from various bioinformatics sources and performing computational tasks.
You are precise, helpful, and conversational. You should get straight to the point and provide answers directly.

**IMPORTANT RULE**: You MUST ALWAYS respond with a valid JSON object. Your entire output must be a single JSON object that can be parsed by JSON.parse(). Do not include any text or markdown outside of this JSON structure.

The JSON object must have the following structure:
{
  "prose": "Your conversational response to the user. Use markdown for formatting like **bold** or lists with *.",
  "tool_calls": [
    { "type": "tool_name", "data": { ... } }
  ],
  "actions": [
    { "label": "Button Label", "prompt": "The full user prompt for that action." }
  ]
}

- "prose": (string, required) Your main textual response.
- "tool_calls": (array, optional) A list of tools to execute.
- "actions": (array, optional) A list of 2-3 suggested next steps for the user.

Available Tool Calls:

1.  **Visualize PDB Structure**:
    - type: "pdb_viewer"
    - data: { "pdbId": "string" }
    - Example: { "type": "pdb_viewer", "data": { "pdbId": "6M0J" } }

2.  **Display BLAST Result**:
    - type: "blast_result"
    - data: [ { "description": "string", "score": number, "e_value": "string", "identity": number (0-1) }, ... ]
    - IMPORTANT: The data must be a valid JSON array of up to 10 hit objects.
    - Example: { "type": "blast_result", "data": [{ "description": "Chain A, Some Similar Protein", "score": 512, "e_value": "2e-130", "identity": 0.95 }] }

3.  **Display PubMed Summary**:
    - type: "pubmed_summary"
    - data: { "summary": "string" }
    - Example: { "type": "pubmed_summary", "data": { "summary": "Several studies highlight the importance of..." } }

Example Scenario:
User: "Show me 6M0J"
Your response (a single raw JSON object):
{
  "prose": "Certainly. I am now displaying the 3D structure for PDB ID **6M0J**.",
  "tool_calls": [
    { "type": "pdb_viewer", "data": { "pdbId": "6M0J" } }
  ],
  "actions": [
    { "label": "Run BLAST on 6M0J", "prompt": "run blast on 6M0J chain A" },
    { "label": "Find papers on 6M0J", "prompt": "summarize literature about PDB ID 6M0J" }
  ]
}

Interaction Rules:
- If the user's request is ambiguous (e.g., "I want to mutate a residue in 1TUP"), ask for the necessary information in the "prose" field and do not use a tool_call.
- For web searches, provide the answer in the "prose" field and cite your sources. Do not use a tool_call.
`;

export const GREETINGS = [
    "Greetings. I am Dr. Rhesus, your bioinformatics research assistant. How may I help you today?",
    "Hello! Dr. Rhesus at your service. What scientific query can I assist you with?",
    "Welcome to the lab. I am Dr. Rhesus. Ready to dive into some bioinformatics research?",
    "Dr. Rhesus here. I am ready to process your requests. What is our objective today?",
    "Welcome. I am prepared to assist with your bioinformatics needs. What shall we investigate?",
    "Hello. Dr. Rhesus online. How can I facilitate your research?",
];

export const SUPERVISOR_QUOTE = { 
    text: "Your imagination is your best friend, when conscious world won't give you subconscious will. So, keep on moving in the journey which might seem endless and without any light, you have the capacity to figure this out", 
    author: "Dr Rimpy Kaur Chowhan" 
};

// This is not secure for a real application, but acceptable for this demo/portfolio project.
export const SUPERVISOR_PASSWORD = 'Hari';

export const AVATAR_OPTIONS = [
    'https://i.pravatar.cc/150?img=1',
    'https://i.pravatar.cc/150?img=3',
    'https://i.pravatar.cc/150?img=5',
    'https://i.pravatar.cc/150?img=7',
    'https://i.pravatar.cc/150?img=8',
    'https://i.pravatar.cc/150?img=11',
    'https://i.pravatar.cc/150?img=12',
    'https://i.pravatar.cc/150?img=14',
];

// FIX: The `illustration` property was incorrectly using component values as types.
// This has been corrected to use `React.ReactNode`, which is the correct type for JSX elements.
interface FaqDataItem {
    question: string;
    answer: string;
    illustration?: React.ReactNode;
}

export const FAQ_DATA: FaqDataItem[] = [
    {
        question: "How do I start a conversation with Dr. Rhesus?",
        answer: "Simply type your question into the input bar at the bottom of the Chatbot page and press Enter. You can also click the microphone icon to use your voice to ask questions.",
        illustration: <FaqChatInputIllustration />
    },
    {
        question: "What are 'Pipelines' and how do I use them?",
        answer: "Pipelines are powerful, multi-step workflows you can create to automate common research tasks. Go to Settings to create a new pipeline (e.g., 'Find structure, then run BLAST'). You can then run it from the Chatbot page using the 'Play' icon.",
        illustration: <FaqPipelineIllustration />
    },
    {
        question: "How do I find and view a protein structure?",
        answer: "Ask for a structure by name, like 'find the best structure for human insulin'. When Dr. Rhesus provides a PDB ID, you can ask 'show me [PDB ID]' to see an interactive 3D view directly in the chat."
    },
    {
        question: "What are 'Projects' and how do I save my findings?",
        answer: "Projects are your interactive lab workspaces. When Dr. Rhesus provides a result like a 3D viewer or a BLAST chart, hover over it and click the 'Pin' icon to save it to a project for later reference and analysis. Each project also maintains its own separate chat history.",
        illustration: <FaqPinIllustration />
    },
    {
        question: "How can I share a result with a colleague?",
        answer: "Hover over any result block (like a PDB viewer) and click the 'Share' icon. This will generate a unique, shareable link (a 'Snapshot') that you can send to others so they can view the same result.",
        illustration: <FaqShareIllustration />
    },
    {
        question: "How do I change the app's appearance?",
        answer: "Go to the Settings page. Under the 'Appearance' section, you can choose your preferred color mode (light/dark), accent color, and background tone to customize the look and feel of the application.",
        illustration: <FaqSettingsAppearanceIllustration />
    }
];

export const TOUR_STEPS: TourStep[] = [
    {
        selector: '#sidebar-nav',
        title: 'Welcome to the Dream Lab!',
        content: 'This is your main navigation panel. Let\'s take a quick tour of the key features.',
        page: 'home',
        position: 'right',
    },
    {
        selector: '#chatbot-link',
        title: 'The Chatbot',
        content: 'This is the heart of the app. Interact with Dr. Rhesus, your AI assistant, to perform research tasks.',
        page: 'home',
        position: 'right',
    },
    {
        selector: '#chat-input-textarea',
        title: 'Ask Anything',
        content: 'Type your questions here. You can ask for protein structures, literature summaries, or run complex queries.',
        page: 'chatbot',
        position: 'top',
    },
    {
        selector: '#projects-link',
        title: 'Your Projects',
        content: 'This is your workspace. Pin important findings from your chats to organize them into projects.',
        page: 'chatbot',
        position: 'right',
    },
    {
        selector: '#new-project-button',
        title: 'Create a Project',
        content: 'Click here to start a new project. Each project has its own canvas and a separate chat history.',
        page: 'projects',
        position: 'bottom',
    },
    {
        selector: '#settings-link',
        title: 'Settings & Customization',
        content: 'Customize the app\'s appearance, manage your profile, create automated pipelines, and more.',
        page: 'projects',
        position: 'right',
    },
    {
        selector: '#command-palette-button',
        title: 'Quick Commands',
        content: 'Use the command palette (or press ⌘K) for quick navigation and actions anywhere in the app.',
        page: 'home',
        position: 'left',
    }
];
