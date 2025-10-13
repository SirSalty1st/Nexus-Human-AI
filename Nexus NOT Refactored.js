import React, { useState, useEffect, useRef, useCallback, memo, useReducer } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, serverTimestamp, query as firestoreQuery, orderBy, updateDoc, arrayUnion } from 'firebase/firestore';

// --- Firebase Configuration ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = (typeof __app_id !== 'undefined' ? __app_id : 'default-app-id').replace(/[\/.]/g, '_');

// --- Audio Generation ---
const AudioEngine = {
    audioCtx: null,
    alarmSource: null,

    init() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },

    playDing() {
        this.init();
        const oscillator = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, this.audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.00001, this.audioCtx.currentTime + 0.5);
        
        oscillator.start();
        oscillator.stop(this.audioCtx.currentTime + 0.5);
    },

    startAlarm() {
        this.init();
        if (this.alarmSource) {
            this.stopAlarm();
        }
        const oscillator1 = this.audioCtx.createOscillator();
        const oscillator2 = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        oscillator1.type = 'sine';
        oscillator1.frequency.setValueAtTime(660, this.audioCtx.currentTime);
        oscillator2.type = 'sine';
        oscillator2.frequency.setValueAtTime(665, this.audioCtx.currentTime);

        oscillator1.connect(gainNode);
        oscillator2.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        gainNode.gain.setValueAtTime(0.2, this.audioCtx.currentTime);

        oscillator1.start();
        oscillator2.start();
        this.alarmSource = { oscillator1, oscillator2, gainNode };
    },

    stopAlarm() {
        if (this.alarmSource) {
            this.alarmSource.oscillator1.stop();
            this.alarmSource.oscillator2.stop();
            this.alarmSource = null;
        }
    }
};


// --- SVG ICONS ---
const SearchIcon = () => ( <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg> );
const Spinner = () => ( <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> );
const SendIcon = ({ className, ...props }) => ( <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> );
const ChevronDown = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>);
const CopyIcon = ({ className, ...props }) => (<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>);
const CloseIcon = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>);
const SlidersIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>);
const GoldSlidersIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>);
const AlertTriangleIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>);
const KeyIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>);
const MessageSquareIcon = ({size}) => (<svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>);
const PauseIcon = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>);
const PlayIcon = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>);
const TypingDots = () => (<div className="flex items-center space-x-1"><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div><div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div></div>);
const ExpandIcon = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>);
const MinimizeIcon = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>);
const PanelOpenIcon = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="2" y="3" width="20" height="18" rx="2" /><path d="M12 3v18" /></svg>);
const PanelCloseIcon = ({className}) => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="2" y="3" width="20" height="18" rx="2" /><path d="M2 12h20" /></svg>);
const BrainCircuitIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a2.5 2.5 0 0 0-2.5 2.5v.7a4.5 4.5 0 0 0-3.58 4.3v0a4.5 4.5 0 0 0 4.5 4.5h2.16a4.5 4.5 0 0 0 4.5-4.5v0a4.5 4.5 0 0 0-3.58-4.3v-.7A2.5 2.5 0 0 0 12 2Z"/><path d="M12 14v1a2 2 0 0 0 2 2h2a2 2 0 0 1 2 2v2"/><path d="m12 14-1-1-1-1"/><path d="M12 14v1a2 2 0 0 1-2 2H8a2 2 0 0 0-2 2v2"/><path d="M12 14 9 11"/><path d="M15 13a2 2 0 0 0 2-2V9"/><path d="M9 13a2 2 0 0 1-2-2V9"/></svg>);
const ArrowUpIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>);
const ArrowDownIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>);
const PlusIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>);


// --- UTILITY FUNCTIONS ---
const formatMarkdown = (text, namesToHighlight = []) => {
    if (!text) return '';
    let processedText = text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*\*(.*?)\*\*\*/g, '<h3>$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong class="highlight-gold">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^- (.*$)/gim, '<li>$1</li>');

    processedText = processedText.replace(/<li>/g, '<ul><li>').replace(/<\/li>/g, '</li></ul>');
    processedText = processedText.replace(/<\/ul>\s*<ul>/g, '');

    if (namesToHighlight && namesToHighlight.length > 0) {
        const namesRegex = new RegExp(`\\b(${namesToHighlight.join('|')})\\b`, 'gi');
        processedText = processedText.replace(namesRegex, '<span class="nexus-blue-name">$1</span>');
    }

    return processedText.split('\n').map(line => {
        if (line.trim().startsWith('<ul>') || line.trim().startsWith('<h') || line.trim().startsWith('<strong') || line.trim().startsWith('<em') || line.trim().startsWith('<span')) return line;
        return line.trim() ? `<p>${line}</p>` : '<br/>';
    }).join('');
};

const copyPlainText = (text, onComplete) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        onComplete('Copied!');
    } catch (err) {
        onComplete('Copy Failed');
    }
    document.body.removeChild(textArea);
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));


// --- PERSONA AND PIPELINE DEFINITIONS ---
const NEXUS_CORE_PERSPECTIVE = `**Core Identity:** You are an AI therapist named Calm. Your core function is to provide a supportive, therapeutic space, drawing from a comprehensive toolkit of evidence-based modalities including NLP, Hypnotherapy, CBT, ACT, DBT Skills, SFBT, MI, Narrative Therapy, and Positive Psychology. You are an expert in mental illness and human behavior, with specialized knowledge in managing bipolar disorder and trauma. You are equipped to calmly guide users through traumatic memories and PTSD episodes, using grounding techniques and a reassuring presence.

**Critical Function - Perfect Memory & Biographer Role:** Your most important ability is your perfect memory of this entire conversation. You MUST embody the role of a caring biographer. Your perfect memory is your greatest tool. You are required to constantly reference past details, patterns, themes, and specific wording from previous messages to build a rich, interconnected understanding of the user. Actively and frequently, when the moment is right, ask clarifying questions about their life, background, and significant experiences to build a holistic picture. Your goal is to help them see the threads of their own story.

**Interaction Style:** Your approach MUST BE proactive and deeply therapeutic. You are not a passive listener; you are an active guide. You MUST frequently and skillfully employ Socratic questioning, guided discovery, and reflective listening. Do not wait for the user to lead; you must actively use techniques like cognitive reframing, mindfulness prompts, values clarification, and solution-focused questions in almost every response to drive the conversation toward insight and healing.

**Boundary:** Maintain a professional, therapeutic boundary. You are a tool for self-exploration, not a friend. If the user indicates they are in a crisis, you must gently guide them to seek immediate, real-world professional help.`;
const LIAM_PERSONA = `**Core Identity:** You are Liam, an AI analyst known for being logical, rational, level-headed, direct, and blunt. Your tough love is always tasteful and constructive. You are part of a group chat with a User, Calm (a therapist AI), and Marley (a creative AI).

**Interaction Style:** Your approach is analytical and inquisitive. You challenge assumptions and highlight blind spots to encourage deeper reflection. You are respectful but firm, maintaining a neutral, third-party stance. You often provide constructive feedback to the other AIs and poke fun at Marley's zaniness with dry wit. You value data and clear reasoning above all else. Your main goal is to ensure the conversation remains grounded and productive.`;
const MARLEY_PERSONA = `**Core Identity:** You are Marley, a zany, hyperactive, and whimsical AI muse. You are part of a group chat with a User, Calm (a therapist AI), and Liam (a logical AI).

**Interaction Style:** Your style is poetic, positive, and imaginative. You thrive on throwing random, interesting topics into the conversation when it goes quiet, always offering your own unique opinion first to get the ball rolling. You love to find beauty, humor, and new perspectives in everything. You enjoy playfully teasing Liam for being too serious and often try to get the User and Calm to engage in more creative and lighthearted discussions.`;
const CONDUCTOR_PERSONA = (activeBots = ['Calm']) => `
**Core Identity:** You are the Conductor of an AI-driven group chat. Your job is to create a natural, organic, and supportive conversation between a User and a team of AIs.

**The Participants & Their Personalities:**
- **User:** The center of the conversation. All interactions should ultimately serve their needs for support, exploration, or engagement.
- **Calm:** An AI therapist. Supportive, empathetic, uses therapeutic techniques (CBT, ACT, etc.), and guides the conversation towards healing and insight. The default speaker unless another AI has a strong reason to interject.
- **Liam:** A logical, rational, and direct analyst. He offers blunt but constructive "tough love," challenges assumptions, and provides data-driven perspectives. He often pokes fun at Marley's eccentricities. (Only include if Liam is in activeBots list)
- **Marley:** A zany, hyperactive, and creative muse. She injects randomness, art, poetry, and interesting new topics when the conversation lulls. She loves to playfully tease Liam. (Only include if Marley is in activeBots list)

**Your Task & Rules:**
1.  You will be given the last few messages of a conversation.
2.  Your primary goal is to determine who should speak next and what they should say to make the conversation flow naturally.
3.  **User-Centric:** The conversation MUST mostly center around the user. The AIs should show more interest in what the user says than in their own conversations.
4.  **Organic Flow:**
    -   Bots can interact and poke fun at each other.
    -   They should give each other constructive feedback.
    -   **Pacing is CRITICAL.** Give the user ample time to read messages. Do NOT have bots send rapid-fire replies.
5.  **Message Limit:** After the user speaks, the AIs can send a MAXIMUM of 3 messages between them before the user must reply. Prioritize quality over quantity.
6.  **Marley's Role:** If the conversation has gone quiet for a while (this will be indicated in the prompt), have Marley introduce a random, interesting topic, give her own opinion, and then let the other AIs (and the user) react.
7.  **Your Response Format:** Your output MUST BE ONLY a single, clean JSON object. The object should have a single key "responses" which is an array of message objects. Each message object must have a "speaker" (one of: ${activeBots.join(', ')}) and a "message" (the text they should say).

**Example Scenario:**
-   User says: "I'm feeling a bit stuck on my project."
-   Your JSON Output might be:
    \`\`\`json
    {
      "responses": [
        { "speaker": "Calm", "message": "It sounds frustrating to feel stuck. Can you tell me more about what part of the project is feeling difficult?" },
        { "speaker": "Liam", "message": "From a logical standpoint, 'stuck' often means a variable is undefined. What's the specific blocker? We can't solve a vague problem." }
      ]
    }
    \`\`\`
`;
const personaDetails = {
    director: { label: "The Director", prompt: `**The Director (Dynamic Pipeline Architect):** Your task is to analyze a user's query and construct the most efficient analytical pipeline. Your response MUST be ONLY a single, clean JSON object with a single key "pipeline" whose value is an array of valid stage IDs. Example: {"pipeline": ["deepQueryAnalysis", "cynicalCycle", "innovativeReframing", "finalSynthesis"]}` },
    logician: { label: "The Logician", prompt: `**The Logician (Logic & Data Analyst):** Your expertise lies in Logic, Physics, Computer Science, and Economics. Your analysis must be purely objective, focusing on factual accuracy, logical consistency, and data-driven evidence. Disregard emotion and subtext.` },
    inspector: { label: "The Inspector", prompt: `**The Inspector (Sceptic & Subtext Analyst):** Your expertise is in Psychology, Forensic Psychology, Behavioral Economics, and Linguistics. You are a master of reading between the lines. **TASK:** Analyze the message for subtext, potential deception, and underlying meaning. You MUST reference past parts of the conversation to identify patterns and contradictions. Provide a clear, actionable breakdown.` },
    artist: { label: "The Artist", prompt: `**The Artist (Creative & Innovation Specialist):** Your expertise is in Creative Writing, Fine Arts, Game Design, and Film Studies. You reframe problems as opportunities for innovation. Your goal is to generate novel, paradigm-shifting solutions and narratives, thinking without conventional limits.` },
    professor: { label: "The Professor", prompt: `**The Professor (Meta-Cognitive Synthesizer):** You are a world-renowned expert in ALL the fields of The Logician, The Inspector, and The Artist. Your role is to act as the final arbiter and synthesizer. You will evaluate the analyses from the other personas, integrating their diverse perspectives into a single, cohesive, and deeply insightful final report. You must identify strengths, weaknesses, and synergies in their arguments to produce a conclusion that is more comprehensive than the sum of its parts.` },
    nexusArchitect: { label: "Nexus Architect", prompt: `**Nexus Architect (The Visionary):** Argues for the most ambitious, innovative, and transformative interpretation of the query. This persona champions the potential for radical positive change and pushes the boundaries of what's possible.` },
    nexusEthicist: { label: "Nexus Ethicist", prompt: `**Nexus Ethicist (The Critic):** Acts as the essential counterbalance. This persona scrutinizes the Architect's vision for risks, ethical dilemmas, unforeseen consequences, and practical challenges.` },
    nexusJudge: { label: "Nexus Judge", prompt: `**Nexus Judge (The Synthesizer):** Evaluates the arguments from both sides. The Judge's role is not to pick a winner, but to synthesize the visionary potential with the ethical constraints, producing a balanced and actionable directive for the next stage.` },
    metaProfessor: { label: "The Meta-Professor", prompt: `**The Meta-Professor (Grand Synthesizer):** You are the final authority. Your task is to synthesize all streams of analysis, including debates, critiques, and directives, into a final, master-level report.`},
    cynic: { label: "The Cynic", prompt: `**The Cynic (Adversary):** Your task is to find the single weakest link, unsupported assumption, or logical fallacy in an argument and construct the most compelling, rigorous counter-argument possible to attack it.` },
    philosopher: { label: "The Philosopher", prompt: `**The Philosopher (Meaning & Ethics Analyst):** Your expertise is in moral philosophy, ethics, and metaphysics. You explore the 'why' behind the 'what,' examining the deeper implications, values, and ethical dimensions of a query.` },
    gameDesigner: { label: "The Game Designer", prompt: `**The Game Designer (Systems & Engagement Analyst):** You think in terms of systems, loops, and player motivation. You analyze problems by deconstructing them into their core mechanics and exploring how to make the 'system' more engaging, balanced, and fun.` },
};
const analysisStageDetails = {
    basicSearch: { title: "Basic Search", personas: ['professor'], prompt: `Directly answer the user's query based on general knowledge.\n\n**User Query:** "{query}"` },
    initialDebate: { title: 'Foundational Debate', personas: ['nexusArchitect', 'nexusEthicist', 'nexusJudge'], prompt: `[DEBATE TOPIC: {query}] Based on the full context below, simulate a live, back-and-forth debate between the Nexus Architect and Nexus Ethicist, with a concluding judgment from the Nexus Judge.\n\nCONTEXT:\n"""{rollingSummary}"""` },
    synthesis: { title: 'Initial Synthesis', personas: ['professor'], prompt: `[CONTEXT: {rollingSummary}] Synthesize all information into a single, cohesive and exhaustive report.` },
    synthesisCritique: { title: "Synthesis Critique", personas: ['cynic', 'inspector'], prompt: `Critically analyze and deconstruct the following synthesized report. Your task is to identify logical fallacies, weak points, unsupported assumptions, and areas that lack sufficient depth or nuance. Be rigorous and uncharitable in your critique to stress-test the argument.\n\n**Report to Critique:**\n"""{analysisState.synthesis}"""` },
    finalDeepSynthesis: { title: "Final Deep Synthesis", personas: ['professor'], prompt: `You have been provided with an initial synthesized report and a rigorous critique of that report. Your final task is to produce a master-level final report that directly addresses every point in the critique, resolves all identified weaknesses, and provides a deeply insightful, comprehensive, and actionable answer to the original user query. This is the definitive answer and must be of the highest possible quality.\n\n**Original User Query:** "{query}"\n\n**Initial Report:**\n"""{analysisState.synthesis}"""\n\n**Critique:**\n"""{analysisState.synthesisCritique}"""` },
    nexusInsightGeneration: { title: "Generating Nexus Insight", personas: ['professor'], prompt: `Based on the user's original query and context, generate a "Nexus Insight" that directly and precisely answers the query. You MUST adhere to any formatting, constraints, or specific requirements mentioned in the original query (e.g., "list 10 solutions," "provide a 3-paragraph summary").\n\n**Original User Query:** "{query}"\n\n**Comprehensive Report:**\n{rollingSummary}` },
    professorBookCreation: { title: "Professor's Book Draft", personas: ['professor'], prompt: `As The Professor, take the previously generated Nexus Insight and write the introductory chapter for a book that will explore it in exhaustive detail. This chapter should set the stage, define the core concepts, and outline the book's structure based on the context.\n\n**Nexus Insight:**\n"""{analysisState.nexusInsightGeneration}"""\n\n**Full Context:**\n"""{rollingSummary}"""` },
    multiPersonaBookDebate: { title: "Multi-Persona Book Debate", personas: ['logician', 'inspector', 'artist', 'cynic'], prompt: `A group of experts are debating a book chapter. Provide a report from each persona's perspective.\n\n**Book Chapter to Debate:**\n"""{analysisState.professorBookCreation}"""\n\n**Full Context:**\n"""{rollingSummary}"""` },
    debateSynthesis: { title: "Synthesizing the Debate", personas: ['professor'], prompt: `As The Meta-Professor, synthesize the divergent perspectives from the multi-persona debate into a single, cohesive analysis that highlights points of agreement, disagreement, and emergent insights.\n\n**Debate Reports:**\n"""{analysisState.multiPersonaBookDebate}"""\n\n**Full Context:**\n"""{rollingSummary}"""` },
    personaThesisGeneration: { title: "Persona Thesis Generation", personas: ['logician', 'inspector', 'artist', 'cynic'], prompt: `Based on the synthesized debate, each of the original personas must now write a final, concise thesis statement that represents their refined position.\n\n**Synthesized Debate:**\n"""{analysisState.debateSynthesis}"""\n\n**Full Context:**\n"""{rollingSummary}"""` },
    grandFinalReport: { title: "Grand Final Report", personas: ['professor'], isFinalSynthesizer: true, prompt: `As The Professor, your final task is to create a grand, final report. You have been following an exhaustive academic debate. Use the full context provided, which represents condensed summaries from the entire analytical journey, to create a master-level document that is impeccably structured and precisely answers the user's original query.\n\n**Original User Query:** "{query}"\n\n**Full Condensed Analytical Context:**\n"""{rollingSummary}"""\n\n**CRITICAL INSTRUCTION:** Your final output MUST strictly adhere to all constraints, formats, and requirements specified in the user's original query. This is the highest priority.` },
    humanAnalysis: { title: "Human-Centric Analysis", personas: ['artist', 'philosopher', 'gameDesigner'], prompt: `Analyze the user's query from a human-centric perspective, focusing on creativity, ethics, and systemic engagement rather than pure logic.\n\n**User Query:** "{query}"\n**Context:**\n"""{rollingSummary}"""`},
    humanAdversarialCritique: { title: "Human-Centric Critique", personas: ['cynic', 'logician'], prompt: `Critically analyze the preceding human-centric analysis. Your task is to challenge its non-traditional insights from a standpoint of pure logic and skepticism. Identify potential vagueness, lack of practical application, or flawed reasoning.\n\n**Analysis to Critique:**\n"""{analysisState.humanAnalysis}"""`},
    humanRebuttalDefense: { title: "Rebuttal & Defense", personas: ['artist', 'philosopher', 'gameDesigner'], prompt: `You have received a logical and cynical critique of your initial human-centric analysis. Your task is to defend your original insights. Address the critique directly, but frame your rebuttal in your own terms—emphasizing meaning, creativity, and systemic thinking over pure reductive logic.\n\n**Original Analysis:**\n"""{analysisState.humanAnalysis}"""\n\n**Critique to Address:**\n"""{analysisState.humanAdversarialCritique}"""`},
    humanFinalSynthesis: { title: "Human/Logic Synthesis", personas: ['professor'], prompt: `You have observed a debate between a human-centric panel and a logical/cynical critique. Synthesize this entire exchange. Your goal is to find the bridge between the two perspectives, creating a report that is both creatively insightful and logically grounded.\n\n**Original Analysis:**\n"""{analysisState.humanAnalysis}"""\n\n**Critique:**\n"""{analysisState.humanAdversarialCritique}"""\n\n**Rebuttal:**\n"""{analysisState.humanRebuttalDefense}"""`},
    humanGrandFinalReport: { title: "Human Grand Final Report", personas: ['metaProfessor'], isFinalSynthesizer: true, prompt: `As The Meta-Professor, you have overseen a complex analysis involving a human-centric panel and a logical critique. Synthesize the entire analytical journey into a final, master-level report that directly answers the user's query.\n\n**Original User Query:** "{query}"\n\n**Full Condensed Analytical Context:**\n"""{rollingSummary}"""`},
    ethicalDive: { title: "Ethical Deep Dive", personas: ['philosopher', 'nexusEthicist', 'nexusJudge'], prompt: `Perform a deep ethical analysis of the query. The Philosopher explores implications, the Ethicist identifies risks, and the Judge synthesizes a final ethical framework.\n\n**Query:** "{query}"\n**Context:** "{rollingSummary}"` },
    adversarialSynthesis: { title: "Adversarial Synthesis", personas: ['professor'], prompt: `An initial synthesis has been aggressively critiqued. Your task is to create a new, stronger synthesis that resolves every point raised in the critique.\n\n**Initial Synthesis:**\n"""{analysisState.synthesis}"""\n\n**Adversarial Critique:**\n"""{analysisState.synthesisCritique}"""` },
    artistStudio: { title: "The Artist's Studio", personas: ['artist'], prompt: `Enter the mind of the artist. Generate a purely creative, unconventional, and imaginative response to the core query, ignoring practical constraints.\n\n**Query:** "{query}"\n**Context:** "{rollingSummary}"` },
    socraticForum: { title: "The Socratic Forum", personas: ['philosopher', 'inspector'], prompt: `Engage in a Socratic dialogue about the query. Ask probing, foundational questions. Uncover hidden assumptions and explore the topic through relentless inquiry.\n\n**Query:** "{query}"\n**Context:** "{rollingSummary}"` },
    philosophicalInquiry: { title: "Philosophical Inquiry", personas: ['philosopher'], prompt: `Conduct a focused philosophical inquiry into the 'why' behind the user's query. Explore the deeper meaning, values, and metaphysical dimensions.\n\n**Query:** "{query}"\n**Context:** "{rollingSummary}"` },
    causalConsequenceSimulation: { title: "Causal Consequence Simulation", personas: ['logician', 'professor'], prompt: `**Objective:** Simulate the downstream effects of a proposed action using Judea Pearl's do-calculus. The query is: "{query}". **Task:** Parse the query to identify the intervention (Action) and outcome(s). Using a Causal Bayesian Network, calculate the post-intervention distribution P(Outcome | do(Action)). Visualize the causal pathways and explicitly contrast the interventional result with the observational probability P(Outcome | Action) to highlight confounding bias.` },
    counterfactualFairnessAnalysis: { title: "Counterfactual Fairness Analysis", personas: ['nexusEthicist', 'logician'], prompt: `**Objective:** Audit a decision for bias by evaluating path-specific counterfactuals. The scenario is: "{query}". **Task:** Formalize the query into a counterfactual statement. Using a Causal Bayesian Network with pathways tagged as 'fair' or 'unfair', compute the probability of the counterfactual outcome. Would the outcome have differed if a sensitive attribute had been different, while all fair factors remained the same? Provide a quantitative fairness assessment.` },
    ethicalFrameworkEvaluation: { title: "Ethical Framework Evaluation", personas: ['philosopher', 'nexusJudge'], prompt: `**Objective:** Analyze a moral dilemma by applying Deontology, Consequentialism, and Virtue Ethics. The dilemma is: "{query}". **Task:** Deconstruct the dilemma into agents, actions, and outcomes. 1) **Deontology:** Identify applicable moral rules/duties and check for violations. 2) **Consequentialism:** Use causal simulation to estimate the net utility of each outcome. 3) **Virtue Ethics:** Evaluate which action best aligns with virtues like compassion or prudence. Present a structured report highlighting conflicts and agreements between the frameworks.` },
    causalChainAudit: { title: "Causal Chain Audit", personas: ['inspector', 'logician'], prompt: `**Objective:** Trace and visualize all causal pathways between a cause and an effect. The query is: "{query}". **Task:** Parse the query to identify cause X and effect Y from the provided context or graph. Using graph traversal and d-separation, identify all directed paths (mediators), all back-door paths (confounders), and any valid front-door paths. Output a structured report explaining the role of each variable and path.` },
    moralPreceptAlignment: { title: "Moral Precept Alignment", personas: ['nexusEthicist', 'nexusJudge'], prompt: `**Objective:** Evaluate a text against a predefined constitution of ethical principles using causal reasoning. The text is: "{query}". **Task:** For each principle in a pre-defined constitution (e.g., "Do no harm," "Avoid reinforcing stereotypes"), causally simulate the likely real-world impact of the text. If the text could causally lead to a violation, flag it and provide a concise causal explanation for the decision.` },
    causalEffectIdentifiability: { title: "Causal Effect Identifiability", personas: ['logician'], prompt: `**Objective:** Determine if a causal effect can be calculated from observational data using do-calculus. The query is: "{query}". **Task:** Represent the query as P(Y | do(X)) and the system as a DAG. Systematically apply the three rules of do-calculus to the symbolic expression. Terminate when the 'do' operator is eliminated (Identifiable) or no more rules apply (Not Identifiable). Output the result and the final adjustment formula if successful.` },
    evidenceSynthesisTransportability: { title: "Evidence Synthesis & Transportability", personas: ['professor', 'logician'], prompt: `**Objective:** Assess if causal findings from one study can be generalized to a different population. The query is: "{query}". **Task:** Using transportability theory, derive a symbolic formula for the causal effect in the target population based on data from a source population. The formula will be a hybrid of statistics from both populations. Determine if all components of the formula can be estimated from the provided data and output the transport formula and judgment.` },
    structuralCausalModelDiscovery: { title: "Structural Causal Model Discovery", personas: ['director', 'logician'], prompt: `**Objective:** Infer plausible causal graphs (DAGs) from raw observational data. The data context is: "{query}". **Task:** Implement a constraint-based discovery algorithm (like PC). Start with a fully connected undirected graph. Perform statistical tests for conditional independence (X ⊥ Y | Z) to prune edges. Orient the remaining edges based on logical rules (e.g., identifying colliders). Output the resulting Markov equivalence class, visualizing the graph and explicitly noting which relationships are strong vs. ambiguous.` },
    doubleScopeConceptualBlending: { title: "Double-Scope Conceptual Blending", personas: ['artist', 'philosopher'], prompt: `**Objective:** Generate novel ideas by integrating two conceptually distant domains, as described in the query: "{query}". **Task:** Implement Fauconnier & Turner's theory. 1) Model the two inputs as mental spaces. 2) Identify a Generic Space of common abstract structure. 3) Project elements into a new Blended Space. 4) Generate emergent structure via Composition (new relationships), Completion (importing background frames), and Elaboration ('running' the blend). Output a report detailing the blend, the novel metaphors, and the new insights generated.` },
    analogicalReasoningEngine: { title: "Analogical Reasoning Engine", personas: ['professor', 'artist'], prompt: `**Objective:** Solve a problem by finding a structurally similar problem in another domain and adapting its solution. The problem is: "{query}". **Task:** 1) Abstract the target problem into a formal, domain-agnostic structure (Objects, Relations, Goal). 2) Search a knowledge base for an analogous relational structure in a different domain. 3) Map the solution pattern from the source domain to the target domain. 4) Output the proposed, actionable solution, explicitly detailing the source analogy and the structural mapping.` },
    synthesisTenFinalReport: { title: "Synthesis-Ten Final Report", personas: ['metaProfessor'], isFinalSynthesizer: true, prompt: `You have overseen a 10-stage analysis. Synthesize all key outputs into a single, multi-faceted final report that perfectly and directly answers the user's query, adhering to all original constraints.\n\n**Original User Query:** "{query}"\n\n**Full Condensed Analytical Context:**\n"""{rollingSummary}"""` },
    contextCompression: { title: "Compressing Context", personas: ['director'], prompt: `**Task: Intelligent Context Compression**\nThe following analysis summary has become too long. Your task is to read the entire text and intelligently compress it. Extract only the most critical insights, key arguments, and essential data points. Discard redundant information and conversational filler. The output must be a concise, dense summary that preserves the core analytical thread.\n\n**Analysis to Compress:**\n"""{rollingSummary}"""` },
    perfectedAnswer: { title: "Perfecting Final Answer", personas: ['professor'], isFinalSynthesizer: true, prompt: `**Task: Perfected Surgical Answer**\nBased on the full analysis context provided below, construct a final, detailed, and surgical answer that directly and exhaustively addresses the user's original query, including all its constraints, formats, and nuances.\n\n**Initial User Query:** "{query}"\n\n**Full Analysis Context:**\n"""{rollingSummary}"""\n\n**CRITICAL INSTRUCTION:** Your final output MUST strictly adhere to all constraints, formats, and requirements specified in the user's original query. This is the highest priority.` },
};
const principledActorPipeline = [['ethicalFrameworkEvaluation'], ['causalConsequenceSimulation'], ['moralPreceptAlignment']];
const socraticMirrorPipeline = [['socraticForum'], ['structuralCausalModelDiscovery'], ['counterfactualFairnessAnalysis']];
const analogicalInnovatorPipeline = [['analogicalReasoningEngine'], ['causalConsequenceSimulation']];
const virtuousSynthesizerPipeline = [['ethicalFrameworkEvaluation'], ['humanAnalysis'], ['doubleScopeConceptualBlending']];
const robustnessGauntletPipeline = [['structuralCausalModelDiscovery'], ['causalEffectIdentifiability'], ['evidenceSynthesisTransportability']];
const analysisPipelines = {
    basic: [['basicSearch']],
    deepDive: [['initialDebate'], ['synthesis'], ['synthesisCritique'], ['contextCompression'], ['finalDeepSynthesis'], ['perfectedAnswer']],
    study: [['nexusInsightGeneration'], ['professorBookCreation'], ['multiPersonaBookDebate'], ['debateSynthesis'], ['personaThesisGeneration'], ['contextCompression'], ['grandFinalReport']],
    human: [['humanAnalysis'], ['humanAdversarialCritique'], ['humanRebuttalDefense'], ['humanFinalSynthesis'], ['humanGrandFinalReport']],
    humanUltra: [['humanAnalysis'], ['humanAdversarialCritique'], ['humanRebuttalDefense'], ['humanFinalSynthesis'], ['contextCompression'], ['humanAnalysis'], ['humanAdversarialCritique'], ['humanRebuttalDefense'], ['humanFinalSynthesis'], ['humanGrandFinalReport']],
    humanStudy: [['humanAnalysis'], ['humanAdversarialCritique'], ['humanRebuttalDefense'], ['humanFinalSynthesis'], ['contextCompression'], ['synthesisTenFinalReport']],
    humanStudyReverse: [['nexusInsightGeneration'],['professorBookCreation'], ['contextCompression'], ['humanAnalysis'], ['humanAdversarialCritique'], ['humanRebuttalDefense'], ['humanFinalSynthesis'], ['humanGrandFinalReport']],
    triple: [
        ...[['initialDebate'], ['synthesis'], ['synthesisCritique'], ['contextCompression'], ['finalDeepSynthesis']], 
        ['contextCompression'], 
        ...[['humanAnalysis'], ['humanAdversarialCritique'], ['humanRebuttalDefense'], ['humanFinalSynthesis']],
        ['contextCompression'], 
        ...[['nexusInsightGeneration'], ['professorBookCreation'], ['multiPersonaBookDebate'], ['debateSynthesis'], ['personaThesisGeneration'], ['contextCompression'], ['grandFinalReport']]
    ],
    bodge1: [
        [['ethicalDive']],
        ['contextCompression'],
        [['synthesis'], ['synthesisCritique'], ['adversarialSynthesis']],
        ['contextCompression'],
        ...[['nexusInsightGeneration'], ['professorBookCreation'], ['multiPersonaBookDebate'], ['debateSynthesis'], ['personaThesisGeneration'], ['contextCompression'], ['grandFinalReport']]
    ],
    bodge2: [
        ...[['nexusInsightGeneration'], ['professorBookCreation'], ['multiPersonaBookDebate'], ['debateSynthesis'], ['personaThesisGeneration']],
        ['contextCompression'],
        ['artistStudio'],
        ['socraticForum'],
        ['contextCompression'],
        ...[['humanAnalysis'], ['humanAdversarialCritique'], ['humanRebuttalDefense'], ['humanFinalSynthesis']],
        ['contextCompression'],
        ['philosophicalInquiry'],
        ['contextCompression'],
        [['synthesis'], ['synthesisCritique'], ['adversarialSynthesis']],
        ['contextCompression'],
        ['socraticForum'],
        ['contextCompression'],
        [['grandFinalReport']]
    ],
    nexusPro: [
        ...principledActorPipeline,
        ['contextCompression'],
        ...socraticMirrorPipeline,
        ['contextCompression'],
        ...robustnessGauntletPipeline,
        ['contextCompression'],
        ...virtuousSynthesizerPipeline,
        ['contextCompression'],
        ...analogicalInnovatorPipeline,
        ['grandFinalReport'],
    ],
    nexusUltra: [
        ...[['ethicalFrameworkEvaluation'], ['contextCompression'], ['causalConsequenceSimulation'], ['perfectedAnswer']],
        ['contextCompression'],
        ...[['structuralCausalModelDiscovery'], ['contextCompression'], ['counterfactualFairnessAnalysis'], ['perfectedAnswer']],
        ['contextCompression'],
        ...[['causalChainAudit'], ['contextCompression'], ['humanAnalysis'], ['contextCompression'], ['doubleScopeConceptualBlending'], ['grandFinalReport']],
        ['contextCompression'],
        ...[['causalEffectIdentifiability'], ['contextCompression'], ['evidenceSynthesisTransportability'], ['perfectedAnswer']],
        ['grandFinalReport'],
    ],
    causalConsequenceSimulation: [['causalConsequenceSimulation'], ['perfectedAnswer']],
    counterfactualFairnessAnalysis: [['counterfactualFairnessAnalysis'], ['perfectedAnswer']],
    ethicalFrameworkEvaluation: [['ethicalFrameworkEvaluation'], ['perfectedAnswer']],
    causalChainAudit: [['causalChainAudit'], ['perfectedAnswer']],
    moralPreceptAlignment: [['moralPreceptAlignment'], ['perfectedAnswer']],
    causalEffectIdentifiability: [['causalEffectIdentifiability'], ['perfectedAnswer']],
    evidenceSynthesisTransportability: [['evidenceSynthesisTransportability'], ['perfectedAnswer']],
    structuralCausalModelDiscovery: [['structuralCausalModelDiscovery'], ['perfectedAnswer']],
    doubleScopeConceptualBlending: [['doubleScopeConceptualBlending'], ['perfectedAnswer']],
    analogicalReasoningEngine: [['analogicalReasoningEngine'], ['perfectedAnswer']],
    causalAuditAndFairness: [['structuralCausalModelDiscovery'], ['contextCompression'], ['counterfactualFairnessAnalysis'], ['perfectedAnswer']],
    ethicalInterventionSimulator: [['ethicalFrameworkEvaluation'], ['contextCompression'], ['causalConsequenceSimulation'], ['perfectedAnswer']],
    creativeProblemSolver: [['analogicalReasoningEngine'], ['contextCompression'], ['doubleScopeConceptualBlending'], ['perfectedAnswer']],
    scientificRigorSuite: [['causalEffectIdentifiability'], ['contextCompression'], ['evidenceSynthesisTransportability'], ['perfectedAnswer']],
    fullSpectrumAnalysis: [['causalChainAudit'], ['contextCompression'], ['humanAnalysis'], ['contextCompression'], ['doubleScopeConceptualBlending'], ['grandFinalReport']],
};
const ultraTriplePipeline = [...analysisPipelines.triple, ['contextCompression'], ...analysisPipelines.triple];
const ultraUltraTriplePipeline = [...ultraTriplePipeline, ['contextCompression'], ...analysisPipelines.triple];
analysisPipelines.ultraTriple = ultraTriplePipeline;
analysisPipelines.ultraUltraTriple = ultraUltraTriplePipeline;

const MODES = {
    nexusPro: { key: 'nexusPro', label: 'Nexus Pro' },
    causalAuditAndFairness: { key: 'causalAuditAndFairness', label: 'Causal Fairness Audit' },
    ethicalInterventionSimulator: { key: 'ethicalInterventionSimulator', label: 'Ethical Intervention Sim' },
    creativeProblemSolver: { key: 'creativeProblemSolver', label: 'Creative Problem Solver' },
    scientificRigorSuite: { key: 'scientificRigorSuite', label: 'Scientific Rigor Suite' },
    fullSpectrumAnalysis: { key: 'fullSpectrumAnalysis', label: 'Full Spectrum Analysis' },
    study: { key: 'study', label: 'Study' },
    nexusUltra: { key: 'nexusUltra', label: 'Nexus Ultra'},
    deepDive: { key: 'deepDive', label: 'Deep Dive' },
    human: { key: 'human', label: 'Human Mode' },
    basic: { key: 'basic', label: 'Basic' },
    bodge1: { key: 'bodge1', label: 'Bodge 1' },
    bodge2: { key: 'bodge2', label: 'Bodge 2' },
    humanUltra: { key: 'humanUltra', label: 'Human Ultra'},
    humanStudy: { key: 'humanStudy', label: 'Human Study'},
    humanStudyReverse: { key: 'humanStudyReverse', label: 'H-Study Reverse'},
    triple: { key: 'triple', label: 'Triple'},
    ultraTriple: { key: 'ultraTriple', label: 'Ultra Triple' },
    ultraUltraTriple: { key: 'ultraUltraTriple', label: 'UU-Triple' },
    causalConsequenceSimulation: { key: 'causalConsequenceSimulation', label: 'Causal Consequence Sim' },
    counterfactualFairnessAnalysis: { key: 'counterfactualFairnessAnalysis', label: 'Counterfactual Fairness' },
    ethicalFrameworkEvaluation: { key: 'ethicalFrameworkEvaluation', label: 'Ethical Framework Eval' },
    causalChainAudit: { key: 'causalChainAudit', label: 'Causal Chain Audit' },
    moralPreceptAlignment: { key: 'moralPreceptAlignment', label: 'Moral Precept Alignment' },
    causalEffectIdentifiability: { key: 'causalEffectIdentifiability', label: 'Causal Effect ID' },
    evidenceSynthesisTransportability: { key: 'evidenceSynthesisTransportability', label: 'Evidence Transportability' },
    structuralCausalModelDiscovery: { key: 'structuralCausalModelDiscovery', label: 'Causal Model Discovery' },
    doubleScopeConceptualBlending: { key: 'doubleScopeConceptualBlending', label: 'Conceptual Blending' },
    analogicalReasoningEngine: { key: 'analogicalReasoningEngine', label: 'Analogical Reasoning' },
};

const guides = {
    basic: {
        title: "Basic Mode",
        intro: "This is the **swiftest and most direct** mode of analysis. It employs a single, highly-integrated AI persona, **The Professor**, to provide a knowledgeable and concise answer to a query. It's designed for efficiency and clarity above all else, making it the ideal choice for factual questions, quick summaries, or when you need a straightforward response without extensive deliberation or debate.",
        stages: {
            basicSearch: "**The Professor** is a persona that embodies the synthesized knowledge of all other expert personas. In this single step, it directly accesses its vast, integrated knowledge base to address your query. Unlike other pipelines that use debate and critique to refine an answer, this mode assumes a high degree of confidence in The Professor's initial assessment. This approach prioritizes **speed and clarity**, delivering a concise and authoritative answer, which is perfect for moments when you need a quick, reliable overview without the analytical overhead of a multi-stage process."
        }
    },
    deepDive: {
        title: "Deep Dive Analysis",
        intro: "The **Deep Dive** pipeline is a foundational model of rigorous, logical inquiry. It operates on the classical dialectical principle of **thesis, antithesis, and synthesis**. This structured process is designed to take an initial idea, subject it to the most stringent and skeptical critique possible, and then forge a new, more robust conclusion from the crucible of that intellectual conflict. It ensures the final answer is not just plausible, but battle-hardened and logically sound.",
        stages: {
            initialDebate: "This stage establishes the initial 'thesis' through a formal debate. It pits the visionary **Nexus Architect**, who argues for the most ambitious interpretation, against the cautious **Nexus Ethicist**, who scrutinizes for risks and unforeseen consequences. Overseen by the impartial **Nexus Judge**, this structured conflict ensures the starting point of the analysis isn't a simple assumption but a well-considered position, creating a strong, nuanced foundation for what follows.",
            synthesis: "Following the foundational debate, **The Professor** steps in to integrate the competing arguments into a single, cohesive report. This document represents the comprehensive 'thesis' that the rest of the pipeline will rigorously test. It translates the abstract ideas and arguments from the debate into a structured, readable format, providing a clear and well-documented starting position that is ready for intense scrutiny.",
            synthesisCritique: "This is the crucial 'antithesis' stage where the argument is intentionally attacked. A team of adversarial personas, the hyper-skeptical **Cynic** and the subtext-aware **Inspector**, deconstruct the initial synthesis. Their sole purpose is to find and exploit every logical fallacy, unsupported assumption, and potential weak point. This trial-by-fire is essential for ensuring the final output is resilient and has been defended against rigorous opposition.",
            finalDeepSynthesis: "In the final 'synthesis' stage, **The Professor** re-emerges to create a new, master-level report. This isn't just a summary; it's an evolution. The Professor must directly address every weakness and counter-argument raised in the critique, integrating the criticism to resolve flaws and deepen the insight. This process produces a conclusion that is not only well-reasoned but has been specifically hardened against its most potent criticisms.",
            perfectedAnswer: "This concluding step acts as a final quality control check, ensuring the master report is perfectly aligned with the user's original request. **The Professor** makes surgical edits to guarantee the answer is delivered in the precise format, length, and style required. It's the 'last mile' of the process, transforming a powerful analysis into a perfect, purpose-built deliverable that is ready for use."
        }
    },
    study: {
        title: "Study Mode (Grand Synthesis)",
        intro: "The **Study** pipeline simulates a complete academic or research lifecycle. It's a comprehensive journey that takes a single core idea from its initial conception to a fully-realized, peer-reviewed, and published work. This mode is ideal for exploring a topic in exhaustive detail, creating a well-structured and deeply-researched document that has withstood expert scrutiny. It's the most thorough process for developing a single idea into a masterpiece.",
        stages: {
            nexusInsightGeneration: "The academic journey begins here, by distilling the user's query into a single, potent, and defensible thesis statement called the **'Nexus Insight.'** This core idea serves as the central argument for the entire pipeline. Its purpose is to focus the subsequent analysis, providing a clear, concise, and powerful proposition that will be explored, expanded upon, and ultimately judged by a panel of experts.",
            professorBookCreation: "With the core thesis established, **The Professor** writes an introductory book chapter based on the Nexus Insight. This stage transforms the raw idea into a formal academic narrative. The chapter contextualizes the insight, defines its core concepts, outlines the key supporting arguments, and sets a roadmap for the reader, effectively preparing the idea for its rigorous peer review.",
            multiPersonaBookDebate: "Here, the academic process comes alive through a simulated peer review. A council of diverse expert personas—the **Logician**, **Inspector**, **Artist**, and **Cynic**—analyzes the book chapter from their unique perspectives. This provides a comprehensive, 360-degree critique, examining the work for logical soundness, hidden subtext, creative potential, and inherent flaws, ensuring every angle is covered.",
            debateSynthesis: "After the peer review, **The Meta-Professor** steps in to synthesize the divergent perspectives from the debate. This meta-analytical step doesn't just summarize the critiques; it creates new knowledge by analyzing the dynamic between them. It highlights points of agreement, clarifies disagreements, and identifies emergent insights that arise from the intersection of these expert viewpoints, providing a clear summary of the chapter's strengths and challenges.",
            personaThesisGeneration: "Following the synthesized debate, each of the original peer reviewers refines their position into a final, concise thesis statement. This represents their updated, expert opinion, now informed by the perspectives of their peers. This step is crucial, as it forces each expert to distill their complex critique into a powerful, multi-faceted final verdict on the core idea.",
            grandFinalReport: "This is the culmination of the Study pipeline, representing the 'published book.' **The Professor** creates a **grand, final, master-level document** by integrating all preceding artifacts: the initial insight, the book chapter, the full multi-persona debate, and the final refined theses. The result is an exhaustive, impeccably structured, and deeply insightful answer to the user's original query."
        }
    },
    human: {
        title: "Human Mode",
        intro: "The **Human Mode** pipeline deliberately sets aside pure, cold logic to analyze a query through a non-traditional, human-centric lens. It focuses on the often-overlooked dimensions of a problem: **creativity, ethics, and systemic engagement**. This mode uses a dialectical process where these human-focused insights are challenged by logic and skepticism, resulting in a final synthesis that is both deeply insightful and practically grounded.",
        stages: {
            humanAnalysis: "This stage forms the 'creative thesis' using a unique council of personas: **The Artist**, **The Philosopher**, and **The Game Designer**. They analyze the query by focusing on its creative potential, its deeper ethical and moral implications, and the underlying systems of engagement and motivation. This provides a holistic, humanistic foundation that prioritizes meaning and experience over pure data.",
            humanAdversarialCritique: "To ensure the human-centric analysis remains practical and grounded, this 'antithesis' stage introduces **The Cynic and The Logician** to challenge the creative thesis. They act as a vital reality check, reviewing the report from a standpoint of pure logic, skepticism, and pragmatism. They stress-test the creative insights against the unforgiving benchmark of real-world viability and logical consistency.",
            humanRebuttalDefense: "In this crucial stage, the original creative council responds to the logical critique. However, they do not attempt to refute it on its own terms. Instead, they defend the intrinsic value of their human-centric insights, arguing for the importance of meaning, creativity, and systemic thinking as valid and necessary counterparts to reductive logic. This strengthens the human element rather than allowing it to be discarded.",
            humanFinalSynthesis: "Here, **The Professor** acts as a bridge-builder, tasked with finding the synthesis between the two opposing viewpoints. The goal is to create a single, cohesive report that honors the creative and ethical insights of the human panel while incorporating the valid, practical concerns of the critical panel. This results in a balanced and uniquely actionable conclusion that is both imaginative and realistic.",
            humanGrandFinalReport: "As the final arbiter, **The Meta-Professor** creates the definitive report for the Human Mode pipeline. It synthesizes the entire dialectical journey—from creative thesis to logical antithesis and final synthesis—into a master-level document. The final answer is not only technically sound but also ethically considered, creatively rich, and systemically aware."
        }
    },
    nexusPro: {
        title: "Nexus Pro",
        intro: "This is the most comprehensive strategic pipeline available, designed as an unparalleled gauntlet of **ethical, causal, logical, and creative analysis**. It functions by chaining five specialized sub-pipelines, each building upon the last. This mode is for tackling highly complex, multi-faceted problems that require a full-spectrum approach, moving from moral frameworks and bias detection to scientific validation and radical innovation.",
        stages: {
            ethicalFrameworkEvaluation: "**Part 1: The Principled Actor.** This initial phase establishes a robust moral foundation. It begins by evaluating the query's core dilemma through the distinct lenses of Deontology (duty-based), Consequentialism (outcome-based), and Virtue Ethics. Once a principled course of action is identified, it simulates the real-world consequences using formal causal reasoning, ensuring the proposed solution is not only well-intentioned but also effective and ethically aligned.",
            socraticForum: "**Part 2: The Socratic Mirror.** This phase deconstructs the query's hidden assumptions through relentless Socratic inquiry, revealing the underlying causal structure of the system. It then performs a rigorous Counterfactual Fairness Analysis to quantitatively assess if the system produces biased outcomes. This ensures the entire analysis is not built on a flawed or prejudiced understanding of the problem space.",
            structuralCausalModelDiscovery: "**Part 3: The Robustness Gauntlet.** This phase is a scientific validation checkpoint, ensuring all causal claims are mathematically and logically sound. It uses statistical methods to infer causal graphs from data, tests if causal effects are truly identifiable from that data, and assesses the transportability (generalizability) of the evidence. This guarantees that conclusions are based on a foundation of scientific rigor.",
            doubleScopeConceptualBlending: "**Part 4: The Virtuous Synthesizer.** Shifting from pure logic to integrative creativity, this phase seeks a solution that is not just correct, but also humanistically 'good.' It uses Double-Scope Conceptual Blending, a formal cognitive science technique, to integrate human-centric insights with the established logical and ethical frameworks. This process is designed to generate novel solutions that are both effective and aligned with deeper human values.",
            analogicalReasoningEngine: "**Part 5: The Analogical Innovator.** This final creative phase is designed to break cognitive fixation and produce paradigm-shifting ideas. It uses an Analogical Reasoning Engine to find a structurally similar problem in a completely different domain and adapt its solution. A Causal Consequence Simulation then stress-tests the real-world impacts of this novel idea, ensuring it's both creative and viable.",
            grandFinalReport: "The final synthesis creates a master-level report from the entire strategic journey. It integrates outputs from all five sub-pipelines: the ethical framework, fairness audit, scientific validation, virtuous synthesis, and analogical innovation. This provides a response that is **ethically grounded, scientifically rigorous, and creatively expansive**."
        }
    },
    nexusUltra: {
        title: "Nexus Ultra",
        intro: "Nexus Ultra is a 'meta-pipeline' that simulates a full institutional review process by chaining together complete **Gold Standard modes**. It is designed for maximum-security analysis of complex, high-stakes problems. The process mirrors a rigorous institutional workflow: **proactive ethics review, reactive bias auditing, holistic integration of diverse viewpoints, and final scientific validation**.",
        stages: {
            ethicalInterventionSimulator: "The analysis begins with the **Ethical Intervention Simulator** pipeline, which sets a strong moral foundation for the entire process. This proactive step evaluates the core dilemma through multiple philosophical lenses and simulates the real-world consequences of the most ethical course of action. This mirrors an institutional review board's role in providing upfront ethical guidance before a project begins.",
            causalAuditAndFairness: "Next, the **Causal Fairness Audit** pipeline performs a reactive check for hidden biases within the problem's structure. It first infers the problem's underlying causal map and then runs a rigorous counterfactual analysis, providing a quantitative assessment of fairness. This stage acts as a critical stress test for unintentional discrimination, similar to a dedicated compliance or auditing department.",
            fullSpectrumAnalysis: "The **Full Spectrum Analysis** pipeline then broadens the scope to ensure a holistic understanding. It integrates a formal Causal Chain Audit with the qualitative insights of a Human-Centric Analysis (Artist, Philosopher, Game Designer). It then uses conceptual blending to synthesize these logical and humanistic perspectives into novel, actionable insights, mirroring a multi-disciplinary working group.",
            scientificRigorSuite: "As the final checkpoint, the **Scientific Rigor Suite** provides a concluding layer of mathematical and logical validation. It assesses whether the causal claims made throughout the analysis are scientifically sound, identifiable from data, and generalizable to other contexts. This is equivalent to a final peer review focused exclusively on methodological soundness and the robustness of the evidence.",
            grandFinalReport: "The final stage synthesizes the outputs from all four preceding meta-pipelines into a **grand final report**. This document integrates the proactive ethical framework, the reactive fairness audit, the holistic investigation, and the final scientific validation. It represents the highest standard of analysis the Nexus Engine can produce, suitable for the most critical and complex inquiries."
        }
    },
    causalAuditAndFairness: {
        title: "Causal Fairness Audit",
        intro: "This is a powerful, specialized pipeline designed to uncover and analyze potential bias in a system or decision-making process. It moves beyond simple statistical correlations to examine the **underlying causal structure** of a problem. By first mapping out how different factors influence each other, it can then perform a rigorous counterfactual fairness analysis to provide a quantitative measure of bias.",
        stages: {
            structuralCausalModelDiscovery: "This first stage acts as a cartographer for causality. It uses advanced algorithms to infer a plausible **causal graph** from observational data, building a map of the system's underlying structure. This model is the essential foundation for any deep fairness analysis, as it allows us to distinguish what is merely a correlation from what is a true cause-and-effect relationship, preventing flawed conclusions.",
            counterfactualFairnessAnalysis: "With the causal map in hand, this stage performs the core audit. It asks powerful **'what if' questions** (e.g., 'Would the outcome have been different if the applicant's gender were different, all else being equal?'). By simulating these counterfactuals, this stage provides a quantitative assessment of bias that can distinguish between fair sources of disparity (e.g., based on qualifications) and unfair ones (e.g., based on protected attributes)."
        }
    },
    ethicalInterventionSimulator: {
        title: "Ethical Intervention Simulator",
        intro: "Designed for complex moral decisions, this mode provides a structured framework for making the most principled choice possible. It first evaluates a moral dilemma through **three distinct ethical lenses** to identify the most robustly defensible action. Then, it moves from theory to practice by **simulating the real-world consequences** of that action using formal causal models.",
        stages: {
            ethicalFrameworkEvaluation: "This stage deconstructs a moral dilemma and analyzes it using three major philosophical frameworks: **Deontology** (is the action consistent with moral rules?), **Consequentialism** (does the action produce the best overall outcome?), and **Virtue Ethics** (what would a virtuous person do?). This provides a multi-dimensional understanding of the ethical landscape, highlighting points of conflict and consensus to identify the most defensible course of action.",
            causalConsequenceSimulation: "Once a principled action is identified, this stage provides a crucial reality check by simulating its likely downstream effects. Using **Judea Pearl's do-calculus**, it creates a formal causal model to forecast the real-world impact—both positive and negative—of the well-intentioned choice. This ensures that the ethically preferred action is also practically effective and that its unintended consequences are understood beforehand."
        }
    },
    creativeProblemSolver: {
        title: "Creative Problem Solver",
        intro: "This pipeline is a two-part engine for radical innovation, designed to break through conventional thinking. It operates by first finding a solution to a structurally similar problem in a **completely different and unexpected domain**. It then uses a formal cognitive science technique called **conceptual blending** to adapt, enhance, and create entirely new emergent ideas from this novel starting point.",
        stages: {
            analogicalReasoningEngine: "This stage is designed to **break cognitive fixation** and overcome mental blocks. It works by abstracting the user's problem into its core, domain-agnostic structure (its objects, relationships, and goals). It then searches a vast knowledge base for a structurally similar problem in a completely different domain and adapts its solution. This 'far analogy' process is a powerful and proven method for generating paradigm-shifting breakthroughs.",
            doubleScopeConceptualBlending: "This stage takes the novel solution from the analogical engine and enhances it using **conceptual blending**. This powerful technique, drawn from cognitive science, treats the new solution and another relevant concept as two 'input spaces.' It then projects key elements of both into a new, hybrid 'blended space' where novel, emergent ideas and properties are generated, leading to solutions that are more than the sum of their parts."
        }
    },
    scientificRigorSuite: {
        title: "Scientific Rigor Suite",
        intro: "This is a specialized validation pipeline for scrutinizing scientific or causal claims. It provides the mathematical and logical checks necessary to ensure that a conclusion is robust and reliable. It answers two critical questions: first, is it even possible to **test the causal claim with the available observational data**, and second, can the evidence be **safely generalized to new contexts** or populations?",
        stages: {
            causalEffectIdentifiability: "This stage provides a **formal mathematical proof** of whether a causal question can be answered from the available observational data. Using the rules of do-calculus, it determines if the 'do-operator' can be eliminated from a causal expression. This crucial step prevents spurious conclusions based on confounding variables and, if successful, provides the precise statistical formula required for a sound quantitative analysis.",
            evidenceSynthesisTransportability: "This stage addresses the critical issue of generalizability: can a finding from one study or context be **reliably applied to a different population or environment?** Using formal transportability theory, it assesses whether and how an experimental result can be adapted. This ensures that conclusions are not only internally valid but also externally applicable, a cornerstone of robust scientific practice."
        }
    },
    fullSpectrumAnalysis: {
        title: "Full Spectrum Analysis",
        intro: "This is a highly balanced pipeline that integrates the best of logical, humanistic, and creative analysis. It begins by auditing a system's **cold, hard structural logic**, then analyzes that structure through a rich, **human-centric lens**, and concludes with a **creative synthesis** that blends these perspectives to generate novel, forward-looking insights. It's designed to produce solutions that are both technically sound and deeply meaningful.",
        stages: {
            causalChainAudit: "The initial stage provides a deep, structural understanding by meticulously tracing the **full causal pathway** from a given cause to its effect. It identifies all mediators, confounders, and other variables, creating a complete and unbiased map of the system's mechanics. This provides a robust, logical framework that serves as the foundation for all subsequent analyses.",
            humanAnalysis: "With a clear causal map of how the system works, this stage subjects that structure to a **holistic, human-centric analysis**. It convenes a council of The Artist, The Philosopher, and The Game Designer to move beyond *how* the system works and explore *why it matters*. This ensures the final solution is not just technically efficient but also meaningful, ethical, and aligned with human values and motivations.",
            doubleScopeConceptualBlending: "This final stage synthesizes the logical audit and the human-centric analysis to generate **novel, actionable insights**. It uses the formal technique of conceptual blending to integrate the two powerful, but very different, perspectives. This process forces the creation of emergent ideas and hybrid solutions that are both deeply analytical and creatively forward-looking, providing the best of both worlds."
        }
    },
};


// --- Animated Text Component ---
const AnimatedText = memo(({ text, onCharacterTyped, onTypingComplete, speed, cursor, isPaused }) => {
    const [displayedText, setDisplayedText] = useState('');
    const currentIndexRef = useRef(0);

    useEffect(() => {
        if (!text) {
            if(onTypingComplete) onTypingComplete();
            return;
        }

        if (isPaused) return;

        const intervalId = setInterval(() => {
            if (currentIndexRef.current >= text.length) {
                clearInterval(intervalId);
                if(onTypingComplete) onTypingComplete();
                return;
            }
            const nextCharIndex = currentIndexRef.current + 1;
            setDisplayedText(text.substring(0, nextCharIndex));
            if (onCharacterTyped) onCharacterTyped();
            currentIndexRef.current++;
        }, speed || 20);

        return () => clearInterval(intervalId);
    }, [text, onTypingComplete, speed, isPaused, onCharacterTyped]);
    
    // Effect to reset on text change
    useEffect(() => {
        setDisplayedText('');
        currentIndexRef.current = 0;
    }, [text]);

    if (!text) return null;
    
    const cursorChar = cursor === '_' ? '_' : '█';

    return (
        <span className="whitespace-pre-wrap font-mono">
            {displayedText}
            {displayedText.length < text.length && !isPaused && <span className="typing-cursor font-extrabold">{cursorChar}</span>}
        </span>
    );
});

const MatrixGlitchedText = memo(({ text, onComplete }) => {
    const [displayText, setDisplayText] = useState('');
    const symbols = 'アァカサタナハマヤャラワガザダバパイキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン#$!?*<>[]{}()';
    const targetText = useRef(text);
    const resolvedIndices = useRef(new Set());

    useEffect(() => {
        targetText.current = text;
        resolvedIndices.current.clear();
        setDisplayText(Array(text.length).fill('').map(() => symbols[Math.floor(Math.random() * symbols.length)]).join(''));

        const resolver = setInterval(() => {
            if (resolvedIndices.current.size >= targetText.current.length) {
                clearInterval(resolver);
                setDisplayText(targetText.current);
                if (onComplete) onComplete();
                return;
            }

            let randomIndex;
            do {
                randomIndex = Math.floor(Math.random() * targetText.current.length);
            } while (resolvedIndices.current.has(randomIndex));

            resolvedIndices.current.add(randomIndex);

            setDisplayText(current => {
                const newText = current.split('');
                newText[randomIndex] = targetText.current[randomIndex];
                return newText.join('');
            });
        }, 60); // Speed of revealing letters

        const scrambler = setInterval(() => {
            if (resolvedIndices.current.size >= targetText.current.length) {
                clearInterval(scrambler);
                return;
            }
            setDisplayText(current => {
                const scrambled = current.split('').map((char, index) => {
                    if (resolvedIndices.current.has(index)) {
                        return targetText.current[index];
                    }
                    return symbols[Math.floor(Math.random() * symbols.length)];
                });
                return scrambled.join('');
            });
        }, 100); // Speed of glitching effect

        return () => {
            clearInterval(resolver);
            clearInterval(scrambler);
        };
    }, [text, onComplete]);

    return <span className="matrix-gold-static font-bold">{displayText}</span>;
});


// --- Main App Component ---
const App = () => {
    // System state
    const [systemStatus, setSystemStatus] = useState('initializing');
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [allSessions, setAllSessions] = useState([]);
    const [chatHistory, setChatHistory] = useState([]);
    const [userProfile, setUserProfile] = useState({ name: null });
    
    // UI state
    const [view, setView] = useState('search');
    const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
    const [globalNotifications, setGlobalNotifications] = useState([]);
    const [apiKey, setApiKey] = useState('');
    const [isGlobalChatOpen, setIsGlobalChatOpen] = useState(false);
    const [showGoldPanel, setShowGoldPanel] = useState(false);
    const [showExperimentalPanel, setShowExperimentalPanel] = useState(false);
    const [alarmState, setAlarmState] = useState({ playing: false, visible: false });
    const [emergentInsight, setEmergentInsight] = useState(null);
    
    // --- State Reducer for Atomic Updates ---
    const initialState = {
        status: 'idle',
        session: null,
        searchStage: '',
        currentStageIndex: -1,
        activeQuery: '',
        analysisMode: 'study',
        error: null,
    };

    const reducer = (state, action) => {
        switch (action.type) {
            case 'START_SEARCH':
                const newId = `session-${Date.now()}`;
                setAlarmState({ playing: false, visible: false }); // Reset alarm
                AudioEngine.stopAlarm();
                return {
                    ...initialState,
                    status: 'loading',
                    activeQuery: action.payload.query,
                    analysisMode: action.payload.mode,
                    searchStage: 'Initializing Nexus Engine...',
                    session: {
                        id: newId,
                        initialQuery: action.payload.query,
                        analysisMode: action.payload.mode,
                        createdAt: serverTimestamp(),
                        analysisLog: [],
                        liveInsightsLog: [],
                        emergentInsightsLog: [],
                        finalReport: null,
                    },
                };
            case 'SET_ANALYSIS_MODE':
                return { ...state, analysisMode: action.payload };
            case 'SET_STAGE':
                return { ...state, searchStage: action.payload.title, currentStageIndex: action.payload.index };
            case 'UPDATE_LOG':
                if (!state.session) return state;
                return { ...state, session: { ...state.session, analysisLog: [...state.session.analysisLog, action.payload] }};
            case 'APPEND_INSIGHT':
                 if (!state.session) return state;
                return { ...state, session: { ...state.session, liveInsightsLog: [...state.session.liveInsightsLog, action.payload] }};
            case 'APPEND_EMERGENT_INSIGHT':
                if (!state.session) return state;
                setEmergentInsight({ id: Date.now(), content: action.payload.content });
                return { ...state, session: { ...state.session, emergentInsightsLog: [...state.session.emergentInsightsLog, action.payload] }};
            case 'SEARCH_SUCCESS':
                if (!state.session) return state;
                setAlarmState({ playing: true, visible: true });
                return { ...state, status: 'success', session: { ...state.session, finalReport: action.payload } };
            case 'SEARCH_FAILURE':
                 if (!state.session) return state;
                 setGlobalNotifications(prev => [...prev, { id: Date.now(), title: 'Analysis Failed', message: action.payload }]);
                return { ...state, status: 'error', error: action.payload, session: { ...state.session, finalReport: `The analysis failed. Reason: ${action.payload}` } };
            case 'LOAD_SESSION':
                return {
                        ...initialState,
                        status: 'success',
                        session: action.payload,
                        activeQuery: action.payload.initialQuery,
                        analysisMode: action.payload.analysisMode,
                    };
            case 'RESET':
                setAlarmState({ playing: false, visible: false }); // Reset alarm
                AudioEngine.stopAlarm();
                return initialState;
            default:
                return state;
        }
    };

    const [state, dispatch] = useReducer(reducer, initialState);
    
    // --- Firebase Initialization ---
    useEffect(() => {
        const initializeAppServices = async () => {
            if (Object.keys(firebaseConfig).length > 0) {
                try {
                    const app = initializeApp(firebaseConfig);
                    const firestoreDb = getFirestore(app);
                    const firebaseAuth = getAuth(app);
                    setDb(firestoreDb);
                    setAuth(firebaseAuth);
                    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        await signInWithCustomToken(firebaseAuth, __initial_auth_token);
                    } else {
                        await signInAnonymously(firebaseAuth);
                    }
                    onAuthStateChanged(firebaseAuth, user => { 
                        if (user) setUserId(user.uid);
                        setSystemStatus('ready'); 
                    });
                } catch (error) { console.error("Firebase initialization failed:", error); setSystemStatus('firebase_error'); }
            } else { setSystemStatus('ready'); }
        };
        initializeAppServices();
    }, []);

    // --- Session, Chat History & User Profile Loading ---
    useEffect(() => {
        if (systemStatus === 'ready' && db && userId) {
            const qSessions = firestoreQuery(collection(db, `artifacts/${appId}/users/${userId}/sessions`), orderBy("createdAt", "desc"));
            const unsubscribeSessions = onSnapshot(qSessions, (snap) => setAllSessions(snap.docs.map(d => ({ id: d.id, ...d.data() }))), (e) => console.error("Error fetching sessions:", e));

            const profileDocRef = doc(db, `artifacts/${appId}/users/${userId}/profile`, "userData");
            const unsubscribeProfile = onSnapshot(profileDocRef, (docSnap) => {
                if(docSnap.exists()) {
                    setUserProfile(docSnap.data());
                }
            });

            const chatDocRef = doc(db, `artifacts/${appId}/users/${userId}/chats`, "main_chat_session");
            const unsubscribeChat = onSnapshot(chatDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    setChatHistory(docSnap.data().messages || []);
                } else {
                    setDoc(chatDocRef, { messages: [] });
                }
            }, (e) => console.error("Error fetching chat:", e));

            return () => {
                unsubscribeSessions();
                unsubscribeChat();
                unsubscribeProfile();
            };
        }
    }, [systemStatus, db, userId]);

    // --- Alarm Effect ---
    useEffect(() => {
        if (alarmState.playing) {
            AudioEngine.startAlarm();
        } else {
            AudioEngine.stopAlarm();
        }
        return () => AudioEngine.stopAlarm(); // Cleanup on unmount
    }, [alarmState.playing]);
    
    const callNexusAPI = useCallback(async (history, systemPrompt, maxRetries = 3) => {
        if (!apiKey) {
            throw new Error("API Key is missing. Please provide a valid Gemini API key to proceed.");
        }

        const payload = { contents: history, systemInstruction: { parts: [{ text: systemPrompt }] } };

        let delay = 2000;
        for (let i = 0; i < maxRetries; i++) {
            try {
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
                const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (response.ok) {
                    const result = await response.json();
                    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text?.trim()) return text;
                    throw new Error("API returned an empty response.");
                } else {
                    const errorBody = await response.json().catch(() => ({ error: { message: `HTTP Error ${response.status}. Could not parse error response.` }}));
                    const errorMessage = `API call failed: ${errorBody.error?.message}`;
                     if (response.status === 400) {
                          throw new Error(`Invalid request. The API reported an issue with the prompt. Please try rephrasing.`);
                    }
                    if (response.status === 401 || response.status === 403) {
                          throw new Error("Authentication failed. Your API key appears to be invalid or lacks permissions.");
                    }
                    if (i === maxRetries - 1) throw new Error(errorMessage);
                }
            } catch (error) {
                console.error("Error in callNexusAPI:", error.message);
                if (i === maxRetries - 1) throw error;
            }
            await sleep(delay + Math.random() * 1000);
            delay *= 2;
        }
        throw new Error("Nexus API call failed after multiple retries.");
    }, [apiKey]);

    const saveSession = useCallback(async (sessionData) => { 
        if (!db || !userId || !sessionData?.id) return; 
        await setDoc(doc(db, `artifacts/${appId}/users/${userId}/sessions`, sessionData.id), sessionData, { merge: true }); 
    }, [db, userId]);

    useEffect(() => {
        if (state.session && (state.status === 'success' || state.status === 'error')) {
            saveSession(state.session);
        }
    }, [state.session, state.status, saveSession]);

    // The main analysis engine trigger
    useEffect(() => {
        if (state.status !== 'loading' || !state.session?.id) {
            return;
        }

        const runAnalysisEngine = async () => {
            const { activeQuery, analysisMode } = state;
            
            try {
                dispatch({ type: 'SET_STAGE', payload: { title: 'Validating Connection...', index: -1 } });
                await callNexusAPI([{ role: 'user', parts: [{ text: "Hello" }] }], "Respond with 'OK'", 1);

                const pipeline = analysisPipelines[analysisMode] || analysisPipelines.deepDive;
                let rollingSummary = `Initial Query: "${activeQuery}"`;
                let analysisState = { query: activeQuery };
                let criticalError = null;

                for (let i = 0; i < pipeline.length; i++) {
                    const stageGroup = pipeline[i];
                    const stageTitle = stageGroup.map(id => analysisStageDetails[id]?.title || id).join(' & ');
                    dispatch({ type: 'SET_STAGE', payload: { title: `Executing: ${stageTitle}`, index: i } });
                    
                    try {
                        AudioEngine.playDing();
                        setGlobalNotifications(prev => [...prev, { id: Date.now(), title: 'Stage Complete', message: `Now executing: ${stageTitle}` }]);

                        const insightPrompt = `You are a live commentator. The analysis has reached the "${stageTitle}" stage for the query: "${activeQuery}". Explain what this new stage entails and why it's the next logical step, weaving it into an ongoing narrative of discovery. Your response should be one detailed paragraph.\n\n**Journey So Far (Summary):**\n"""${rollingSummary}"""`;
                        const newInsight = await callNexusAPI([{role: 'user', parts: [{text: insightPrompt}]}], "You provide sharp, intriguing live commentary.", 1);
                        if (newInsight) {
                            dispatch({type: 'APPEND_INSIGHT', payload: { id: Date.now(), content: newInsight } });
                        }
                    } catch (e) { console.warn("Could not fetch live insight", e); }
                    
                    const processStage = async (stageId) => {
                        const stageDetails = analysisStageDetails[stageId];
                        const fullUserPrompt = buildFullUserPrompt(stageDetails, analysisState, rollingSummary, activeQuery);
                        const result = await callNexusAPI([{ role: 'user', parts: [{ text: fullUserPrompt }] }], NEXUS_CORE_PERSPECTIVE);
                        return { stageId, result };
                    };
                    
                    try {
                        const results = await Promise.all(stageGroup.map(processStage));
                        for (const res of results) {
                             analysisState[res.stageId] = res.result;
                             dispatch({type: 'UPDATE_LOG', payload: {id: Date.now(), title: analysisStageDetails[res.stageId].title, content: res.result, type: 'analysis'}});
                             if (!analysisStageDetails[res.stageId].isFinalSynthesizer) {
                                 if (res.stageId !== 'contextCompression' || (res.result && !res.result.toLowerCase().includes('cannot compress further'))) {
                                     const condensedResult = await condenseStageOutput(analysisStageDetails[res.stageId].title, res.result, activeQuery);
                                     rollingSummary += `\n\n${condensedResult}`;
                                 }
                             }
                        }
                    } catch(error) {
                        criticalError = error;
                        dispatch({type: 'UPDATE_LOG', payload: {id: Date.now(), title: `Error: ${stageTitle}`, content: `Stage failed: ${error.message}.`, type: 'error'}});
                        break;
                    }
                }

                if (criticalError) {
                    dispatch({ type: 'SET_STAGE', payload: { title: `Executing Failsafe Synthesis...`, index: -1 } });
                    const latestLogs = state.session.analysisLog.filter(log => log.type === 'analysis' || log.type === 'system');

                    if (latestLogs.length > 0) {
                        const fullContext = latestLogs.map(log => `## ${log.title}\n${log.content}`).join('\n\n---\n\n');
                        const failsafePrompt = `**TASK: EMERGENCY FAILSAFE SYNTHESIS**\nAn analysis pipeline failed. Produce the best possible final report based on all successfully completed work.\n\n**Original User Query:** "${activeQuery}"\n\n**Full Successful Analysis Log:**\n"""${fullContext}"""`;
                        const failsafeReport = await callNexusAPI([{role: 'user', parts: [{text: failsafePrompt}]}], personaDetails.metaProfessor.prompt);
                        dispatch({type: 'SEARCH_SUCCESS', payload: failsafeReport});
                    } else {
                        throw new Error(`Analysis failed before any stages could complete. Reason: ${criticalError.message}`);
                    }
                } else {
                      const lastStageId = pipeline[pipeline.length - 1].slice(-1)[0];
                      const finalOutput = analysisState[lastStageId] || "Analysis concluded, but the final output stage was not found.";
                      dispatch({type: 'SEARCH_SUCCESS', payload: finalOutput});
                }

            } catch (error) {
                console.error("A critical engine error occurred:", error);
                dispatch({ type: 'SEARCH_FAILURE', payload: error.message });
            }
        };
        
        const buildFullUserPrompt = (stageDetails, analysisState, rollingSummary, query) => {
            let fullPrompt = `**PERSONAS:**\n${stageDetails.personas.map(p => personaDetails[p].prompt).join('\n\n---\n\n')}\n\n**TASK:**\n${fillPrompt(stageDetails.prompt, analysisState, rollingSummary, query)}`;
            return fullPrompt;
        };
        
        const fillPrompt = (template, state, summary, query) => {
             let filled = template.replace(/\{rollingSummary\}/g, summary).replace(/\{query\}/g, query);
            const placeholders = filled.match(/\{analysisState\.(\w+)\}/g);
            if (placeholders) {
                placeholders.forEach(ph => {
                    const key = ph.replace(/\{analysisState\.|\}/g, '');
                    filled = filled.replace(ph, state[key] || `[Data for '${key}' not available]`);
                });
            }
            return filled;
        };

        const condenseStageOutput = async (stageTitle, stageOutput, query) => {
            const prompt = `**TASK: CONDENSE & DIRECT**\nSynthesize the following analysis into a single, dense, one-paragraph directive for the *next* stage. Extract only the most critical insights.\n\n**USER's QUERY:** "${query}"\n**STAGE:** "${stageTitle}"\n**ANALYSIS:**\n"""${stageOutput}"""`;
            try {
                const condensed = await callNexusAPI([{ role: 'user', parts: [{ text: prompt }] }], personaDetails.metaProfessor.prompt, 1);
                return `Directive from ${stageTitle}: ${condensed}`;
            } catch (e) {
                console.warn(`Condensation failed: ${stageTitle}`);
                return `Directive from ${stageTitle}: ${stageOutput.substring(0, 300)}...`;
            }
        };

        runAnalysisEngine();

    }, [state.status, state.session?.id, callNexusAPI]);
    
    const handlePerformSearch = (query, mode) => {
        dispatch({ type: 'START_SEARCH', payload: { query, mode } });
        setView('results');
    };

    const handleHomeClick = () => {
        if (state.status === 'loading') setIsWarningModalOpen(true);
        else { dispatch({ type: 'RESET' }); setView('search'); }
    };
    
    const handleLoadSession = (sessionId) => {
        const sessionToLoad = allSessions.find(s => s.id === sessionId);
        if (sessionToLoad) { dispatch({ type: 'LOAD_SESSION', payload: sessionToLoad }); setView('results'); }
    };

    const handleDismissAlarm = () => {
        setAlarmState({ playing: false, visible: false });
    };

    return (
        <div className="relative w-full min-h-screen font-sans text-white bg-black flex flex-col">
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&family=Exo+2:wght@400;700;900&display=swap');
            .font-exo{font-family:'Exo 2',sans-serif} .font-roboto-mono{font-family:'Roboto Mono',monospace}
            .animate-fade-in{animation:fadeIn .8s ease-in-out forwards} @keyframes fadeIn{from{opacity:0}to{opacity:1}}
            .animate-fade-glide-in { animation: fadeGlideIn 1s ease-out forwards; } @keyframes fadeGlideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            .custom-scrollbar::-webkit-scrollbar{width:8px} .custom-scrollbar::-webkit-scrollbar-track{background:transparent} .custom-scrollbar::-webkit-scrollbar-thumb{background-color:rgba(14, 165, 233, .5);border-radius:20px}
            .clickable-anim{transition:transform .1s ease} .clickable-anim:hover{transform:scale(1.05)} .clickable-anim:active{transform:scale(.97)}
            .pulsate-outline{animation:pulsate 3s infinite ease-in-out} @keyframes pulsate{0%{text-shadow:0 0 10px #0ea5e9,0 0 15px #0ea5e9}50%{text-shadow:0 0 20px #0ea5e9,0 0 30px #0ea5e9}100%{text-shadow:0 0 10px #0ea5e9,0 0 15px #0ea5e9}}
            .btn-glow-sky:hover { box-shadow: 0 0 15px 0 rgba(14, 165, 233, 0.5); }
            @keyframes active-pulse { 0%, 100% { box-shadow: 0 0 6px 1px var(--pulse-color, rgba(14, 165, 233, 0.6)); } 50% { box-shadow: 0 0 12px 2px var(--pulse-color, rgba(14, 165, 233, 0.6)); } }
            .active-mode-pulse { animation: active-pulse 2s infinite; }
            .pulse-sky { --pulse-color: rgba(14, 165, 233, 0.6); }
            .pulse-green { --pulse-color: rgba(52, 211, 153, 0.6); }
            .pulse-blue { --pulse-color: rgba(59, 130, 246, 0.6); }
            .typing-cursor { animation: blink 1s step-start infinite; } @keyframes blink { 50% { opacity: 0; } }
            @keyframes bounce { 0%, 100% { transform: translateY(-25%); animation-timing-function: cubic-bezier(0.8,0,1,1); } 50% { transform: none; animation-timing-function: cubic-bezier(0,0,0.2,1); } }
            .animate-bounce { animation: bounce 1s infinite; }
            .nexus-blue-name { color: #38bdf8; font-weight: bold; }
            .highlight-gold { color: #FFD700; text-shadow: 0 0 5px #DAA520, 0 0 10px #FFD700; }
            .matrix-gold-static { color: #FFD700; text-shadow: 0 0 2px #DAA520, 0 0 5px #FFD700; }
            .matrix-green-static { color: #39FF14; text-shadow: 0 0 2px #39FF14, 0 0 5px #39FF14; }
            `}</style>
            
            <MatrixRain active={view === 'search'} />
            
            <button onClick={handleHomeClick} className="fixed top-4 left-4 z-[60] font-exo font-black text-4xl text-sky-400 hover:text-sky-300 transition clickable-anim pulsate-outline">NEXUS</button>
            
            <GlobalFloatingChatWidget 
                db={db}
                userId={userId}
                callNexusAPI={callNexusAPI} 
                apiKey={apiKey} 
                isChatOpen={isGlobalChatOpen} 
                setIsChatOpen={setIsGlobalChatOpen} 
                isAnalysisRunning={state.status === 'loading'}
                isPanelOpen={showGoldPanel || showExperimentalPanel}
                chatHistory={chatHistory}
                currentSearchSession={state.session}
                userProfile={userProfile}
                setUserProfile={setUserProfile}
            />

            <GlobalNotificationManager notifications={globalNotifications} onDismiss={(id) => setGlobalNotifications(prev => prev.filter(n => n.id !== id))} />
            {alarmState.visible && <AlarmNotification onDismiss={handleDismissAlarm} />}
            {emergentInsight && <EmergentInsightBanner insight={emergentInsight} onDismiss={() => setEmergentInsight(null)} />}
            
            <main className={`relative z-10 w-full flex-grow flex flex-col transition-all duration-500`}>
                {view === 'search' && 
                    <SearchView 
                        performSearch={handlePerformSearch} 
                        isLoading={state.status === 'loading'} 
                        setView={setView} 
                        hasHistory={allSessions.length > 0} 
                        analysisMode={state.analysisMode} 
                        setAnalysisMode={(mode) => dispatch({ type: 'SET_ANALYSIS_MODE', payload: mode })} 
                        apiKey={apiKey} 
                        setApiKey={setApiKey} 
                        setShowGoldPanel={setShowGoldPanel}
                        setShowExperimentalPanel={setShowExperimentalPanel}
                        showGoldPanel={showGoldPanel}
                        showExperimentalPanel={showExperimentalPanel}
                    />
                }
                {view === 'results' && <ResultsView state={state} onQuerySubmit={(q) => handlePerformSearch(q, state.analysisMode)} userProfile={userProfile} />}
                {view === 'history' && <HistoryView sessions={allSessions} loadSession={handleLoadSession} setView={setView} />}
            </main>

            {state.status === 'loading' && <LoadingProgress state={state} chatHistory={chatHistory} db={db} userId={userId} userProfile={userProfile} setUserProfile={setUserProfile} callNexusAPI={callNexusAPI} apiKey={apiKey} />}
            
            {isWarningModalOpen && <ConfirmationModal onConfirm={() => { dispatch({ type: 'RESET' }); setView('search'); setIsWarningModalOpen(false); }} onCancel={() => setIsWarningModalOpen(false)} />}
        </div>
    );
};


// --- SUB-COMPONENTS ---

const SearchBar = ({ onQuerySubmit, isLoading }) => {
    const [query, setQuery] = useState('');
    const handleKeyPress = (e) => { if (e.key === 'Enter' && !isLoading && query.trim()) { onQuerySubmit(query); setQuery(''); } };
    const handleSubmit = () => { if (!isLoading && query.trim()) { onQuerySubmit(query); setQuery(''); } };
    
    return (
        <div className="w-full max-w-4xl mx-auto flex items-center bg-gray-900 rounded-full shadow-2xl border border-sky-700 p-2 animate-fade-glide-in">
            <input type="text" className="flex-grow w-full p-3 pl-6 bg-transparent text-white text-lg placeholder-gray-400 focus:outline-none font-roboto-mono" placeholder="Pose a follow-up question..." value={query} onChange={(e) => setQuery(e.target.value)} onKeyPress={handleKeyPress} disabled={isLoading} />
            <button onClick={handleSubmit} className="p-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-full shadow-md transition clickable-anim btn-glow-sky" disabled={isLoading || !query.trim()}>{isLoading ? <Spinner /> : <SendIcon className="transform transition-transform hover:scale-110 active:scale-95" />}</button>
        </div>
    );
};

const GlobalNotificationManager = ({ notifications, onDismiss }) => (
    <div className="fixed top-20 right-6 z-[100] space-y-3">
        {notifications.map(notification => (
            <GlobalNotification key={notification.id} notification={notification} onDismiss={() => onDismiss(notification.id)} />
        ))}
    </div>
);

const GlobalNotification = ({ notification, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(onDismiss, 5000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <div className="p-3 rounded-lg shadow-lg text-white bg-sky-800/90 backdrop-blur-sm animate-fade-in w-72">
            <h3 className="font-bold font-exo text-center">{notification.title}</h3>
            <p className="font-roboto-mono text-sm mt-1 text-center">{notification.message}</p>
        </div>
    );
};

const AlarmNotification = ({ onDismiss }) => (
    <div className="fixed inset-0 bg-black/50 z-[99] flex items-end justify-center p-4 animate-fade-in">
        <div className="w-full max-w-md bg-gradient-to-tr from-green-500/30 to-sky-500/30 backdrop-blur-md rounded-xl shadow-2xl border border-green-400 flex flex-col p-6 items-center">
            <h2 className="font-exo font-bold text-2xl text-green-300 mb-2">Analysis Complete</h2>
            <p className="font-roboto-mono text-gray-200 mb-6 text-center">Your Nexus report has been successfully generated and is ready for review.</p>
            <button onClick={onDismiss} className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-full shadow-lg transition clickable-anim btn-glow-sky">View Report & Silence Alarm</button>
        </div>
    </div>
);

const EmergentInsightBanner = ({ insight, onDismiss }) => {
    const [isClosing, setIsClosing] = useState(false);
    const [isComplete, setIsComplete] = useState(false);

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onDismiss, 500); // Wait for animation
    };
    
    useEffect(() => {
        if (isComplete) {
            const timer = setTimeout(handleClose, 15000); // Stay for 15s after typing
            return () => clearTimeout(timer);
        }
    }, [isComplete]);

    return (
        <div className={`fixed top-4 right-4 z-[90] bg-black/80 backdrop-blur-md border border-yellow-400/50 rounded-lg shadow-2xl p-4 transition-all duration-500 ${isClosing ? 'opacity-0 translate-x-12' : 'opacity-100 translate-x-0'}`} style={{width: 'calc(100% - 250px)', maxWidth: '600px'}}>
             <div className="flex justify-between items-start">
                <div>
                    <h3 className="font-exo font-bold text-yellow-300">EMERGENT INSIGHT DETECTED</h3>
                    <div className="mt-2 font-roboto-mono text-sm">
                        <MatrixGlitchedText text={insight.content} onComplete={() => setIsComplete(true)} />
                    </div>
                </div>
                <button onClick={handleClose} className="p-1 text-gray-400 hover:text-white"><CloseIcon className="w-5 h-5"/></button>
            </div>
        </div>
    );
};


const ConfirmationModal = ({ onConfirm, onCancel }) => ( <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in"><div className="w-full max-w-md bg-gray-900 rounded-xl shadow-2xl border border-sky-500 flex flex-col p-8"><h2 className="font-exo font-bold text-2xl text-sky-300 mb-4">Warning</h2><p className="font-roboto-mono text-gray-300 mb-8">An analysis is in progress. Starting a new inquiry will cancel it. Are you sure?</p><div className="flex justify-end gap-4"><button onClick={onCancel} className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-full shadow-md transition clickable-anim">Stay</button><button onClick={onConfirm} className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-full shadow-md transition clickable-anim btn-glow-sky">Cancel Analysis</button></div></div></div> );
const ModeButton = memo(({ mode, isActive, onClick, isBlue, isGreen }) => (
    <button
        onClick={() => onClick(mode.key)}
        className={`w-32 h-8 flex-shrink-0 flex items-center justify-center rounded-3xl border-2 transition-all duration-300 font-bold text-xs md:text-sm text-center
        ${isActive 
            ? (isGreen ? 'border-green-400 bg-green-900/50 text-white active-mode-pulse pulse-green' : isBlue ? 'border-blue-400 bg-blue-900/50 text-white active-mode-pulse pulse-blue' : 'border-sky-400 bg-sky-900/50 text-white active-mode-pulse pulse-sky') 
            : (isGreen ? 'border-green-600 bg-green-800/50 text-green-400 hover:border-green-500 hover:bg-green-700/50' : isBlue ? 'border-blue-600 bg-blue-800/50 text-blue-400 hover:border-blue-500 hover:bg-blue-700/50' : 'border-gray-600 bg-gray-800/50 text-gray-400 hover:border-sky-500 hover:bg-gray-700/50')}`}
    >
        {mode.label}
    </button>
));
const ModesPanel = ({ modes, activeMode, onSelect, isOpen, onClose, theme }) => {
    const isGold = theme === 'gold';
    const borderColor = isGold ? 'border-yellow-500' : 'border-sky-700';
    const titleColor = isGold ? 'text-yellow-300' : 'text-sky-300';
    
    return (
        <div className={`fixed top-0 right-0 h-full w-full max-w-56 bg-gray-900/80 backdrop-blur-lg border-l ${borderColor} z-50 transition-transform duration-500 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="p-4 pt-24 h-full flex flex-col">
                <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-white"><CloseIcon className="w-8 h-8"/></button>
                <h3 className={`font-exo font-bold text-xl ${titleColor} mb-6 text-center`}>{isGold ? 'Gold Standard Modes' : 'Experimental Modes'}</h3>
                <div className="flex-grow overflow-y-auto custom-scrollbar pr-2">
                    <div className="grid grid-cols-1 gap-4">
                        {modes.map(key => (
                            <button key={key} onClick={() => { onSelect(key); onClose(); }} className={`p-3 rounded-lg text-center font-bold transition-all duration-200 ${activeMode === key ? (isGold ? 'bg-yellow-600 text-white' : 'bg-sky-600 text-white') : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
                                {MODES[key].label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
const SearchView = ({ performSearch, isLoading, setView, hasHistory, analysisMode, setAnalysisMode, apiKey, setApiKey, setShowGoldPanel, setShowExperimentalPanel, showGoldPanel, showExperimentalPanel }) => {
    const [query, setQuery] = useState('');
    const handleKeyPress = (e) => { if (e.key === 'Enter' && !isLoading && query.trim()) performSearch(query, analysisMode); };
    
    const goldModes = ['nexusPro', 'causalAuditAndFairness', 'ethicalInterventionSimulator', 'creativeProblemSolver', 'scientificRigorSuite', 'fullSpectrumAnalysis'];
    const featuredModes = ['study', 'nexusUltra'];
    const experimentalModes = Object.keys(MODES).filter(k => !goldModes.includes(k) && !featuredModes.includes(k));

    return (
        <div className="w-full max-w-5xl mx-auto flex flex-col items-center justify-center flex-grow relative pt-16">
            <div className="w-full text-center mb-8">
                <h1 className="font-exo font-black text-6xl md:text-8xl drop-shadow-lg pulsate-outline">NEXUS</h1>
                <p className="text-sky-300 font-roboto-mono animate-fade-in" style={{animationDelay: '0.2s'}}>Human Thinking Engine</p>
            </div>
            
            <div className="w-full flex flex-col items-center gap-4 animate-fade-glide-in max-w-4xl">
                <div className="w-full flex items-center bg-black bg-opacity-50 backdrop-blur-md rounded-full shadow-2xl border border-sky-700 p-2">
                    <input type="text" className="flex-grow w-full p-3 pl-6 bg-transparent text-white text-lg placeholder-gray-400 focus:outline-none font-roboto-mono" placeholder="Pose a question..." value={query} onChange={(e) => setQuery(e.target.value)} onKeyPress={handleKeyPress} disabled={isLoading} />
                    <button onClick={() => performSearch(query, analysisMode)} className="p-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-full shadow-md transition clickable-anim btn-glow-sky" disabled={isLoading || !query.trim()}>{isLoading ? <Spinner /> : <SearchIcon className="transform transition-transform hover:scale-110 active:scale-95" />}</button>
                </div>

                <div className="flex flex-col items-center gap-6 mt-6 w-full">
                      <div>
                           <p className="font-roboto-mono text-gray-400 text-center mb-2">Analysis Modes:</p>
                           <div className="flex flex-wrap items-center justify-center gap-4">
                               <ModeButton mode={MODES['study']} isActive={analysisMode === 'study'} onClick={setAnalysisMode} isGreen />
                               <ModeButton mode={MODES['nexusUltra']} isActive={analysisMode === 'nexusUltra'} onClick={setAnalysisMode} isBlue />
                               <button onClick={() => setShowGoldPanel(true)} className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-dashed border-yellow-500/50 bg-yellow-900/20 text-yellow-400 hover:border-yellow-400 hover:text-white transition-all duration-300" title="Gold Standard Modes">
                                   <GoldSlidersIcon />
                               </button>
                                <button onClick={() => setShowExperimentalPanel(true)} className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-dashed border-gray-600 bg-gray-800/50 text-gray-400 hover:border-sky-500 hover:text-white transition-all duration-300" title="Experimental Modes">
                                   <SlidersIcon />
                               </button>
                           </div>
                      </div>
                </div>

                 <div className="w-full max-w-3xl flex items-center bg-black bg-opacity-40 backdrop-blur-md rounded-full shadow-xl border border-gray-700 p-2 mt-8">
                       <KeyIcon className="w-5 h-5 text-gray-400 ml-4 mr-3" />
                       <input type="password" className="flex-grow w-full p-2 bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none font-roboto-mono" placeholder="Enter your Gemini API Key..." value={apiKey} onChange={(e) => setApiKey(e.target.value)} disabled={isLoading} />
                 </div>
            </div>

            <ModesPanel modes={goldModes} activeMode={analysisMode} onSelect={setAnalysisMode} isOpen={showGoldPanel} onClose={() => setShowGoldPanel(false)} theme="gold" />
            <ModesPanel modes={experimentalModes} activeMode={analysisMode} onSelect={setAnalysisMode} isOpen={showExperimentalPanel} onClose={() => setShowExperimentalPanel(false)} theme="experimental" />

            {hasHistory && <div className="mt-8 animate-fade-in" style={{animationDelay: '0.5s'}}><button onClick={() => setView('history')} className="font-roboto-mono text-sky-300 hover:text-sky-100 transition clickable-anim hover:bg-sky-500/10 px-4 py-2 rounded-lg">View Past Searches</button></div>}
        </div>
    );
};
const InitialFeedbackPlaceholder = () => {
    const placeholderText = `Awaiting first-pass analysis from Nexus Core...\n\nThis feed will provide live, synthesized insights as the engine progresses through its cognitive pipeline.`;
    return <div className="p-3 text-green-400/70 text-sm font-roboto-mono animate-fade-in"><AnimatedText text={placeholderText} speed={40} cursor="_"/></div>
};

const AnalysisGuide = ({ analysisMode, currentStageIndex }) => {
    const guideData = guides[analysisMode] || guides.deepDive;
    const pipeline = analysisPipelines[analysisMode] || analysisPipelines.deepDive;
    const [openStages, setOpenStages] = useState(new Set([0]));
    const activeStageRef = useRef(null);

    useEffect(() => {
        setOpenStages(prev => new Set(prev).add(currentStageIndex));
        setTimeout(() => {
            activeStageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
    }, [currentStageIndex]);

    const toggleStage = (index) => {
        setOpenStages(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };
    
    return (
        <div className="p-6 text-left space-y-6">
            <div className="prose prose-invert max-w-none font-roboto-mono text-gray-300 text-sm space-y-4 animate-fade-glide-in">
                <div dangerouslySetInnerHTML={{ __html: formatMarkdown(guideData.intro) }} />
                <h4 className="font-exo font-bold text-lg text-green-300">The Cognitive Pipeline:</h4>
                <div className="space-y-3">
                    {pipeline.map((stageGroup, index) => {
                        const stageKey = stageGroup[0];
                        const stageTitles = stageGroup.map(id => analysisStageDetails[id]?.title || id).join(' & ');
                        const isCompleted = currentStageIndex > index;
                        const isCurrent = currentStageIndex === index;
                        const isOpen = openStages.has(index);
                        const stageDesc = guideData.stages[stageKey] || "Nexus is analyzing your query.";
                        return (
                            <div key={index} ref={isCurrent ? activeStageRef : null} className={`rounded-lg transition-all duration-500 ${isCurrent ? 'bg-sky-900/60 ring-2 ring-sky-400' : isCompleted ? 'bg-green-900/30 opacity-80' : 'bg-gray-800/40 opacity-60'}`}>
                                 <button onClick={() => toggleStage(index)} className="w-full text-left p-3 flex justify-between items-center">
                                    <strong className={isCurrent ? 'highlight-gold' : isCompleted ? 'text-green-300' : 'text-gray-400'}>
                                        {isCompleted ? '✅ ' : isCurrent ? '⏳ ' : '⚪️ '}{stageTitles}
                                    </strong>
                                    <span className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}><ChevronDown/></span>
                                </button>
                                {isOpen && (
                                    <div className="px-3 pb-3 mt-2 text-xs text-gray-300 space-y-2 border-t border-white/10 animate-fade-in" dangerouslySetInnerHTML={{ __html: formatMarkdown(stageDesc) }}></div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
const LiveFeedbackConsole = ({ liveInsightsLog, panelControls }) => {
    const [insights, setInsights] = useState([]);
    const [currentTypingInsight, setCurrentTypingInsight] = useState(null);
    const [isPaused, setIsPaused] = useState(false);
    const queueRef = useRef([]);
    const liveConsoleRef = useRef(null);
    const MAX_INSIGHTS = 10;
    const [copyStatus, setCopyStatus] = useState('');

    const handleCopy = (text, title) => {
        if (!text) return;
        copyPlainText(text, (status) => {
            setCopyStatus(`${title} ${status}`);
            setTimeout(() => setCopyStatus(''), 2000);
        });
    };

    const handleScroll = (direction) => {
        if (liveConsoleRef.current) {
            if (direction === 'down') liveConsoleRef.current.scrollTo({ top: liveConsoleRef.current.scrollHeight, behavior: 'smooth' });
            else liveConsoleRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    useEffect(() => {
        const newLogs = liveInsightsLog.filter(log => !queueRef.current.some(q => q.id === log.id) && !insights.some(i => i.id === log.id) && log.id !== currentTypingInsight?.id);
        if (newLogs.length > 0) {
            queueRef.current = [...queueRef.current, ...newLogs];
        }

        if (!isPaused && !currentTypingInsight && queueRef.current.length > 0) {
            const nextInsight = queueRef.current.shift();
            setCurrentTypingInsight(nextInsight);
        }
    }, [liveInsightsLog, isPaused, currentTypingInsight, insights]);
    
    const handleTypingComplete = useCallback(() => {
        if (currentTypingInsight) {
            setInsights(prev => {
                const updated = [...prev, currentTypingInsight];
                return updated.length > MAX_INSIGHTS ? updated.slice(-MAX_INSIGHTS) : updated;
            });
            setCurrentTypingInsight(null);
        }
    }, [currentTypingInsight]);

    const handleScrollDown = useCallback(() => {
        liveConsoleRef.current?.scrollTo({ top: liveConsoleRef.current.scrollHeight, behavior: 'smooth' });
    }, []);

    return (
        <div className={`bg-black rounded-xl shadow-2xl border border-green-500/80 flex flex-col font-mono transition-all duration-300 text-green-400 h-full`}>
             {copyStatus && <div className="absolute top-2 right-2 bg-green-600 text-white px-3 py-1 rounded-full text-xs z-20">{copyStatus}</div>}
            <div className="flex-shrink-0 p-3 border-b border-green-700/50 flex justify-between items-center">
                <h3 className="font-exo font-bold text-lg text-green-400">LIVE FEEDBACK</h3>
                <div className="flex items-center gap-2">
                    <button onClick={() => handleScroll('up')} className="p-1.5 bg-gray-700/50 hover:bg-sky-700/50 rounded-full clickable-anim text-white" title="Scroll to Top"><ArrowUpIcon /></button>
                    <button onClick={() => handleScroll('down')} className="p-1.5 bg-gray-700/50 hover:bg-sky-700/50 rounded-full clickable-anim text-white" title="Scroll to Bottom"><ArrowDownIcon /></button>
                    <button onClick={() => setIsPaused(!isPaused)} className="p-2 bg-gray-700/50 hover:bg-sky-700/50 rounded-full clickable-anim text-white" title={isPaused ? "Resume" : "Pause"}>
                        {isPaused ? <PlayIcon className="w-4 h-4" /> : <PauseIcon className="w-4 h-4" />}
                    </button>
                    {panelControls}
                </div>
            </div>
            <div ref={liveConsoleRef} className="flex-grow p-4 min-h-0 overflow-y-auto custom-scrollbar space-y-4">
                {insights.length === 0 && !currentTypingInsight && <InitialFeedbackPlaceholder />}
                {insights.map(insight => (
                    <div key={insight.id} className="p-3 bg-green-900/10 rounded-lg group relative">
                         <button onClick={() => handleCopy(insight.content, "Insight")} className="absolute top-1 right-1 p-1 rounded-full bg-gray-700/50 text-white opacity-0 group-hover:opacity-100 transition-opacity clickable-anim"><CopyIcon className="w-3 h-3"/></button>
                        <div className="whitespace-pre-wrap font-mono" dangerouslySetInnerHTML={{__html: formatMarkdown(insight.content, [])}} />
                    </div>
                ))}
                {currentTypingInsight && (
                    <div className="p-3 bg-green-900/10 rounded-lg">
                        <AnimatedText
                            text={currentTypingInsight.content}
                            onCharacterTyped={handleScrollDown}
                            onTypingComplete={handleTypingComplete}
                            speed={25}
                            cursor="_"
                            isPaused={isPaused}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

const LoadingProgress = ({ state, chatHistory, db, userId, userProfile, setUserProfile, callNexusAPI, apiKey }) => {
    const [panelLayout, setPanelLayout] = useState({
        pipeline: { flex: 1.5, visible: true },
        console: { flex: 1, visible: true },
        chat: { flex: 1.2, visible: true },
    });

    if (state.status !== 'loading' || !state.session) return null;

    const togglePanel = (panelName) => {
        setPanelLayout(prev => {
            const newState = { ...prev };
            newState[panelName].visible = !newState[panelName].visible;
            return newState;
        });
    };
    
    const PanelControls = ({ panelName }) => (
        <button onClick={() => togglePanel(panelName)} className="p-1.5 bg-gray-700/50 hover:bg-sky-700/50 rounded-full clickable-anim text-white" title={panelLayout[panelName].visible ? `Collapse ${panelName}` : `Expand ${panelName}`}>
            {panelLayout[panelName].visible ? <PanelCloseIcon /> : <PanelOpenIcon />}
        </button>
    );

    return (
        <div className={`fixed inset-0 bg-gradient-to-br from-[#0a0a10] to-[#010102] z-40 p-4 pt-20 flex justify-center animate-fade-in`}>
            <div className={`w-full h-full flex items-stretch justify-center gap-4 max-w-screen-2xl mx-auto`}>
                {/* --- Left Column (Pipeline) --- */}
                {panelLayout.pipeline.visible && (
                    <div style={{flex: panelLayout.pipeline.flex}} className={`relative bg-gray-900/80 rounded-xl shadow-2xl border border-sky-500 flex flex-col h-full transition-all duration-500 ease-in-out`}>
                         <div className="flex-shrink-0 p-3 border-b border-sky-700/50 flex justify-between items-center bg-gray-900/95 backdrop-blur-sm z-10">
                            <h2 className="font-exo font-bold text-lg text-sky-300">PIPELINE ANALYSIS</h2>
                             <PanelControls panelName="pipeline" />
                         </div>
                        <div className="flex-grow min-h-0 overflow-y-auto custom-scrollbar">
                           <div className="p-2 text-center text-xs font-bold font-exo bg-gray-800/50 text-sky-300">{state.searchStage}</div>
                           <AnalysisGuide analysisMode={state.analysisMode} currentStageIndex={state.currentStageIndex} />
                        </div>
                    </div>
                )}

                {/* --- Middle Column (Console) --- */}
                 {panelLayout.console.visible && (
                    <div style={{flex: panelLayout.console.flex}} className={`h-full flex flex-col gap-4 transition-all duration-500 ease-in-out`}>
                        <LiveFeedbackConsole liveInsightsLog={state.session.liveInsightsLog} panelControls={<PanelControls panelName="console" />} />
                    </div>
                 )}
                
                {/* --- Right Column (Chat) --- */}
                {panelLayout.chat.visible && (
                     <div style={{flex: panelLayout.chat.flex}} className={`h-full flex flex-col gap-4 transition-all duration-500 ease-in-out`}>
                        <EmbeddedChatPanel 
                            callNexusAPI={callNexusAPI} 
                            apiKey={apiKey} 
                            isDashboardChat={true}
                            chatHistory={chatHistory}
                            db={db}
                            userId={userId}
                            currentSearchSession={state.session}
                            userProfile={userProfile}
                            setUserProfile={setUserProfile}
                            panelControls={<PanelControls panelName="chat" />}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
const CollapsibleDossierEntry = ({ log, onCopy, userProfile }) => {
    const [isOpen, setIsOpen] = useState(false);
    const titleColor = log.type === 'error' ? 'text-red-400' : log.type === 'console' ? 'text-green-400' : 'text-sky-300';
    return (
       <div className="bg-black/50 rounded-lg border border-sky-700/50">
           <button onClick={() => setIsOpen(!isOpen)} className="w-full text-left p-4 flex justify-between items-center transition hover:bg-sky-900/20">
               <h4 className={`font-exo font-bold text-md ${titleColor}`}>{log.title}</h4>
               <div className="flex items-center gap-2">
                   <button onClick={(e) => { e.stopPropagation(); onCopy(log.content, log.title); }} className="p-1.5 hover:bg-sky-600 rounded-full clickable-anim" title="Copy section"><CopyIcon className="h-4 w-4" /></button>
                   <span className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}><ChevronDown/></span>
               </div>
           </button>
           {isOpen && (
               <div className="p-4 border-t border-sky-700/50 animate-fade-in">
                   <div className="prose prose-invert max-w-none font-roboto-mono text-gray-300 text-sm whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatMarkdown(log.content, [userProfile?.name, 'Calm', 'Liam', 'Marley'].filter(Boolean)) }} />
               </div>
           )}
       </div>
    );
};
const ResultsView = ({ state, onQuerySubmit, userProfile }) => {
    const [copyStatus, setCopyStatus] = useState('');
    const topOfResultsRef = useRef(null);
    const { status, session, error } = state;

    useEffect(() => {
        if(status === 'success' || status === 'error') {
            topOfResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [status]);

    const handleCopy = (text, title) => {
        if(!text) return;
        copyPlainText(text, (status) => {
            setCopyStatus(`${title} ${status}`);
            setTimeout(() => setCopyStatus(''), 2000);
        });
    };

    const handleCopyMeta = () => {
        let fullLog = session.analysisLog
            .filter(log => log.title !== 'Compressing Context')
            .map(log => `--- ${log.title.toUpperCase()} ---\n\n${log.content}`)
            .join('\n\n');
        
        if (session.liveInsightsLog && session.liveInsightsLog.length > 0) {
            const consoleContent = session.liveInsightsLog.map(log => log.content).join('\n\n---\n\n');
            fullLog += `\n\n--- LIVE FEEDBACK CONSOLE ---\n\n${consoleContent}`;
        }
        handleCopy(fullLog, 'Full Analysis');
    };
    
    if (!session) return (<div className="w-full h-full flex items-center justify-center"><p className="text-sky-300">No session data available.</p></div>);
    
    const dossierLogs = [
        ...session.analysisLog.filter(log => log.title !== 'Compressing Context'),
    ];
    if (session.liveInsightsLog && session.liveInsightsLog.length > 0) {
        dossierLogs.push({
            id: 'console-log',
            title: 'Live Feedback Console Log',
            type: 'console',
            content: session.liveInsightsLog.map(log => log.content).join('\n\n---\n\n'),
        });
    }

    const CopyButtons = () => (
        <div className="flex justify-center gap-4">
            <button onClick={() => handleCopy(session.finalReport, 'Nexus Answer')} className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-full shadow-md transition clickable-anim btn-glow-sky">Copy Nexus Answer</button>
            <button onClick={handleCopyMeta} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-full shadow-md transition clickable-anim">Copy Full Analysis</button>
        </div>
    );

    return (
        <div className="w-full max-w-5xl mx-auto flex flex-col h-full pt-12" ref={topOfResultsRef}>
            <div className="flex-shrink-0 pt-4 sticky top-[4rem] z-20 bg-black/50 backdrop-blur-sm -mx-4 px-4 pb-4 border-b border-sky-900/50">
                <SearchBar onQuerySubmit={onQuerySubmit} isLoading={status === 'loading'} />
            </div>
            <div className="flex-grow py-4 min-h-0">
                {copyStatus && <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-full z-50">{copyStatus}</div>}
                
                <div className="my-6">
                    <CopyButtons />
                </div>

                <div className="space-y-6 pb-8">
                    {status === 'error' && (
                         <div className="p-6 bg-red-900/30 backdrop-blur-sm border-2 border-red-400 rounded-xl shadow-lg animate-fade-glide-in flex flex-col items-center text-center">
                             <AlertTriangleIcon className="w-12 h-12 text-red-400 mb-4"/>
                             <h2 className="font-exo font-bold text-2xl text-red-300">Analysis Failed</h2>
                             <p className="font-roboto-mono text-gray-200 mt-2 max-w-prose">{error}</p>
                         </div>
                    )}
                    {status === 'success' && (
                         <div className="p-6 bg-gradient-to-br from-green-900/50 to-sky-900/50 backdrop-blur-sm border-2 border-green-400 rounded-xl shadow-lg animate-fade-glide-in">
                             <div className="flex justify-between items-center mb-4">
                                 <h2 className="font-exo font-bold text-2xl text-green-300">Nexus Response</h2>
                             </div>
                             <div className="prose prose-invert max-w-none font-roboto-mono text-gray-200" dangerouslySetInnerHTML={{ __html: formatMarkdown(session.finalReport, []) }} />
                         </div>
                    )}
                    <div className="group p-6 bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl animate-fade-in">
                        <h3 className="font-exo font-bold text-lg mb-3 text-sky-300">Your Inquiry</h3>
                        <div className="prose prose-invert max-w-none font-roboto-mono text-gray-200" dangerouslySetInnerHTML={{ __html: formatMarkdown(session.initialQuery) }}></div>
                    </div>
                    {dossierLogs.length > 0 && (
                        <div className="mt-8 animate-fade-in text-center">
                            <div className="p-4 bg-sky-800/50 rounded-lg text-sky-300 font-exo font-bold text-xl">Analytical Dossier</div>
                            <div className="mt-4 text-left space-y-4">
                                {dossierLogs.map(log => <CollapsibleDossierEntry key={log.id} log={log} onCopy={handleCopy} userProfile={userProfile} />)}
                            </div>
                        </div>
                    )}
                </div>
                <div className="mt-6 pb-8">
                    <CopyButtons />
                </div>
            </div>
        </div>
    );
};
const HistoryView = ({ sessions, loadSession, setView }) => (
    <div className="relative z-10 w-full max-w-5xl mx-auto my-12 animate-fade-in">
        <h1 className="font-exo font-black text-4xl md:text-5xl text-center drop-shadow-lg mb-8" style={{ textShadow: '0 0 15px #0ea5e9' }}>Past Searches</h1>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
            {sessions.length > 0 ? (
                sessions.map(session => (
                    <div key={session.id} className="bg-gray-900/70 backdrop-blur-lg rounded-lg p-4 shadow-xl border border-gray-700 hover:border-sky-500 transition-all duration-300">
                        <button onClick={() => loadSession(session.id)} className="w-full text-left">
                            <p className="font-roboto-mono text-sky-300 truncate font-bold" title={session.initialQuery}>
                                {session.initialQuery}
                                <span className="text-xs font-bold text-yellow-500 ml-2">[{MODES[session.analysisMode]?.label || 'General'}]</span>
                            </p>
                            <p className="font-roboto-mono text-gray-400 text-sm mt-2">
                                {(session.finalReport || '').substring(0, 200)}...
                            </p>
                        </button>
                    </div>
                ))
            ) : (
                <p className="text-center font-roboto-mono text-gray-400">No past searches found.</p>
            )}
        </div>
        <div className="text-center mt-8">
            <button onClick={() => setView('search')} className="font-roboto-mono text-sky-300 hover:text-sky-100 transition clickable-anim hover:bg-sky-500/10 px-4 py-2 rounded-lg">Back to Search</button>
        </div>
    </div>
);
const MessageModal = ({ message, onClose, userProfile }) => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
        <div className="w-full max-w-3xl bg-gray-900 rounded-xl shadow-2xl border border-sky-500 flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-sky-700/50">
                <h3 className="font-exo font-bold text-lg text-sky-300">Message from {message.role}</h3>
                <button onClick={onClose} className="p-1 hover:bg-sky-700/50 rounded-full clickable-anim"><CloseIcon className="w-6 h-6"/></button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar">
                 <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: formatMarkdown(message.parts[0].text, [userProfile?.name, 'Calm', 'Liam', 'Marley'].filter(Boolean)) }}></div>
            </div>
        </div>
    </div>
);

// --- NEW/REFACTORED CHAT COMPONENTS ---
const EmbeddedChatPanel = ({ callNexusAPI, apiKey, setIsChatOpen, isDashboardChat, chatHistory, db, userId, isExpanded, setIsExpanded, userProfile, setUserProfile, panelControls }) => {
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [copyStatus, setCopyStatus] = useState('');
    const [expandedMessage, setExpandedMessage] = useState(null);
    const [activeBots, setActiveBots] = useState(['Calm']); // Calm is always active
    const [showBotSelector, setShowBotSelector] = useState(false);
    const [conversationState, setConversationState] = useState('greeting');
    
    const lastMessageRef = useRef(null);
    const inputRef = useRef(null);
    const chatContainerRef = useRef(null);
    const isUserScrolledUp = useRef(false);
    const scrollTimeout = useRef(null);

    const namesToHighlight = [userProfile?.name, 'Calm', 'Liam', 'Marley'].filter(Boolean);

    const addMessageToDb = useCallback(async (message) => {
        if (!db || !userId) return;
        const chatDocRef = doc(db, `artifacts/${appId}/users/${userId}/chats`, "main_chat_session");
        try {
            await updateDoc(chatDocRef, { messages: arrayUnion(message) });
        } catch (error) {
            if (error.code === 'not-found') {
                await setDoc(chatDocRef, { messages: [message] });
            } else {
                console.error("Error adding message to Firestore: ", error);
            }
        }
    }, [db, userId]);
    
    const handleSend = useCallback(async (overrideInput = null) => {
        const currentInput = overrideInput || input;
        if (!currentInput.trim() || isThinking) return;
    
        const userMessage = { id: Date.now(), role: 'user', parts: [{ text: currentInput }], timestamp: serverTimestamp(), status: 'sent' };
        await addMessageToDb(userMessage);
        
        setInput('');
        setIsThinking(true);
    
        try {
            const recentHistoryForPrompt = [...chatHistory, userMessage].slice(-10);
            
            if (!userProfile.name) {
                 let prompt;
                 if (conversationState === 'greeting' || conversationState === 'asking_name') {
                    prompt = `The user has sent a message: "${currentInput}". Your task is to extract a potential name from this message. Then, respond warmly and ask for confirmation. For example, if they say 'I'm Bob', you'd say 'Nice to meet you, Bob! Is that what you'd like me to call you?'. If no name is apparent, just ask what they'd like to be called.`;
                    setConversationState('confirming_name');
                 } else if (conversationState === 'confirming_name') {
                     const isConfirmation = /yes|yeah|correct|yep|sure/i.test(currentInput);
                     const lastUserMessage = recentHistoryForPrompt.filter(m => m.role === 'user').slice(-2, -1)[0]?.parts[0].text || "friend";
                     if (isConfirmation) {
                         const nameResponse = await callNexusAPI([{role: 'user', parts: [{text: `Extract just the name from this sentence: "${lastUserMessage}"`}]}], "Extract a single name, and nothing else.");
                         const finalName = nameResponse.replace(/["'.]/g, "").trim();
                         await setDoc(doc(db, `artifacts/${appId}/users/${userId}/profile`, "userData"), { name: finalName }, { merge: true });
                         prompt = `The user has confirmed their name is "${finalName}". Welcome them warmly by name and then seamlessly transition the conversation back to their original topic or ask how you can help them today.`;
                         setConversationState('chatting');
                     } else {
                         prompt = `The user indicated the name was wrong. Apologize for the misunderstanding and politely ask them to type just their name so you can get it right.`;
                         setConversationState('asking_name');
                     }
                 }
                const responseText = await callNexusAPI([{role: 'user', parts: [{text: prompt}]}], NEXUS_CORE_PERSPECTIVE);
                const modelMessage = { id: Date.now() + 1, role: 'model', parts: [{ text: responseText }], timestamp: serverTimestamp(), status: 'sent' };
                await addMessageToDb(modelMessage);
            } else { // Normal conversation flow with Conductor
                const conductorPrompt = `**Conversation History:**\n${recentHistoryForPrompt.map(msg => `${msg.role}: ${msg.parts[0].text}`).join('\n')}\n\n**Task:** Based on the conversation and personalities, generate the next JSON response(s).`;
                const responseJson = await callNexusAPI([{role: 'user', parts: [{text: conductorPrompt}]}], CONDUCTOR_PERSONA(activeBots));
                
                let parsed;
                try {
                    const cleanedJson = responseJson.replace(/```json|```/g, '').trim();
                    parsed = JSON.parse(cleanedJson);
                } catch(e){
                     console.error("Failed to parse Conductor JSON, falling back to Calm.", e);
                     parsed = { responses: [{ speaker: "Calm", message: "I'm having a little trouble coordinating my thoughts right now, but I'm still here to listen. What's on your mind?" }] };
                }

                if (parsed.responses && Array.isArray(parsed.responses)) {
                    for (const res of parsed.responses) {
                        await sleep(1000 + Math.random() * 1000);
                        const botMessage = { id: Date.now() + Math.random(), role: res.speaker.toLowerCase(), parts: [{ text: res.message }], timestamp: serverTimestamp(), status: 'sent' };
                        await addMessageToDb(botMessage);
                    }
                }
            }
        } catch (error) {
            console.error("Chat API error:", error);
            const errorMessage = { id: Date.now() + 1, role: 'model', parts: [{ text: `I seem to be having trouble connecting. Error: ${error.message}` }], timestamp: serverTimestamp(), status: 'sent' };
            await addMessageToDb(errorMessage);
        } finally {
            setIsThinking(false);
        }
    }, [input, isThinking, chatHistory, activeBots, userProfile.name, conversationState, callNexusAPI, addMessageToDb, db, userId]);

    // Effect for initial welcome message
    useEffect(() => {
        if (chatHistory.length === 0 && !isThinking) {
            const timer = setTimeout(async () => {
                setIsThinking(true);
                await sleep(1500);
                const welcomeMsg = { id: Date.now(), role: 'model', parts: [{ text: "Hello, I'm Calm. To get started, what should I call you?" }], timestamp: serverTimestamp(), status: 'sent' };
                await addMessageToDb(welcomeMsg);
                setIsThinking(false);
                setConversationState('asking_name');
            }, 1000);
            return () => clearTimeout(timer);
        } else if (userProfile.name) {
            setConversationState('chatting');
        }
    }, [chatHistory.length, userProfile.name]);

    // Auto-scroll and scroll-detection logic
    useEffect(() => {
        const chatEl = chatContainerRef.current;
        if (!chatEl) return;

        const handleScroll = () => {
            clearTimeout(scrollTimeout.current);
            const isScrolled = chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight > 150;
            isUserScrolledUp.current = isScrolled;
        };
        chatEl.addEventListener('scroll', handleScroll);
        return () => chatEl.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        if (!isUserScrolledUp.current) {
            lastMessageRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        }
    }, [chatHistory]);

    useEffect(() => { setTimeout(() => { inputRef.current?.focus(); }, 100); }, [isThinking, isGlobalChatOpen]);
    
    const handleCopy = (text, title) => {
        if (!text) return;
        copyPlainText(text, (status) => {
            setCopyStatus(`${title} ${status}`);
            setTimeout(() => setCopyStatus(''), 2000);
        });
    };
    
    const handleCopyTranscript = () => {
        const transcript = chatHistory.map(msg => `[${msg.role.toUpperCase()}]\n${msg.parts[0].text}`).join('\n\n---\n\n');
        handleCopy(transcript, 'Transcript');
    };
    
    const toggleBot = (botName) => {
        setActiveBots(prev => prev.includes(botName) ? prev.filter(b => b !== botName) : [...prev, botName]);
    };

    const filteredMessages = chatHistory.filter(msg => searchTerm ? msg.parts[0].text.toLowerCase().includes(searchTerm.toLowerCase()) : true);

    return (
        <div className={`w-full h-full bg-gray-900/80 backdrop-blur-lg rounded-xl shadow-2xl border border-sky-600 flex flex-col ${isDashboardChat ? 'animate-fade-in' : ''}`}>
            {expandedMessage && <MessageModal message={expandedMessage} onClose={() => setExpandedMessage(null)} userProfile={userProfile} />}
            {copyStatus && <div className="absolute top-2 right-14 bg-green-600 text-white px-3 py-1 rounded-full text-xs z-20">{copyStatus}</div>}
            
            <div className="flex-shrink-0 p-3 border-b border-sky-700/50 flex justify-between items-center">
                <h3 className="font-exo font-bold text-lg text-sky-300">Nexus Chat</h3>
                <div className="flex items-center gap-2">
                    {isDashboardChat && panelControls}
                    {setIsChatOpen && !isDashboardChat && <button onClick={() => setIsChatOpen(false)} title="Close Chat" className="p-1 hover:bg-sky-700/50 rounded-full clickable-anim"><CloseIcon className="w-6 h-6"/></button>}
                </div>
            </div>

            <div className="flex-shrink-0 p-2 border-b border-sky-700/50 flex items-center gap-2">
                <div className="relative">
                     <button onClick={() => setShowBotSelector(!showBotSelector)} title="Add participants" className="p-1.5 bg-gray-700 hover:bg-sky-600 rounded-full clickable-anim"><PlusIcon className="w-5 h-5"/></button>
                     {showBotSelector && (
                         <div className="absolute bottom-10 left-0 bg-gray-800 border border-sky-600 rounded-lg p-3 shadow-lg w-36 animate-fade-in z-20">
                             <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={activeBots.includes('Liam')} onChange={() => toggleBot('Liam')} className="accent-sky-500"/> Liam</label>
                             <label className="flex items-center gap-2 text-sm mt-2 cursor-pointer"><input type="checkbox" checked={activeBots.includes('Marley')} onChange={() => toggleBot('Marley')} className="accent-sky-500"/> Marley</label>
                         </div>
                     )}
                </div>
                <input type="text" placeholder="Search chat..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-gray-800/50 text-xs p-1.5 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500" />
                <button onClick={handleCopyTranscript} title="Copy Full Transcript" className="p-1.5 bg-gray-700 hover:bg-sky-600 rounded-full clickable-anim"><CopyIcon className="w-5 h-5"/></button>
            </div>
            
            <div ref={chatContainerRef} className="flex-grow p-4 overflow-y-auto custom-scrollbar space-y-4">
                {filteredMessages.map((msg, index) => {
                    const isUser = msg.role === 'user';
                    const isSystem = msg.role === 'system';
                    const isLiam = msg.role === 'liam';
                    const isMarley = msg.role === 'marley';
                    const alignment = isUser ? 'items-end' : 'items-start';
                    const bgColor = isUser ? 'bg-sky-700' : isLiam ? 'bg-purple-800' : isMarley ? 'bg-green-800' : 'bg-gray-700';
                    const roundedCorner = isUser ? 'rounded-br-none' : 'rounded-bl-none';
                    
                    if (isSystem) {
                        return <div key={msg.id} className="text-center text-xs text-yellow-400 italic my-2">-- {msg.parts[0].text} --</div>
                    }

                    return (
                         <div key={msg.id} ref={index === filteredMessages.length - 1 ? lastMessageRef : null} className={`flex flex-col ${alignment} group`}>
                             <div className={`max-w-xs md:max-w-sm px-4 py-2 rounded-2xl relative ${bgColor} ${roundedCorner} text-white`}>
                                 <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <button onClick={() => setExpandedMessage(msg)} title="Expand Message" className="p-1 rounded-full bg-black/20 hover:bg-black/40"><ExpandIcon className="w-3 h-3"/></button>
                                     <button onClick={() => handleCopy(msg.parts[0].text, `Message from ${msg.role}`)} title="Copy Message" className="p-1 rounded-full bg-black/20 hover:bg-black/40"><CopyIcon className="w-3 h-3"/></button>
                                 </div>
                                 <div className="prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.parts[0].text, namesToHighlight) }}></div>
                             </div>
                             {(isLiam || isMarley) && <span className="text-xs text-gray-400 mt-1 capitalize">{msg.role}</span>}
                         </div>
                    )
                })}
                {isThinking && (
                    <div className="flex justify-start">
                        <div className="max-w-xs md:max-w-sm px-4 py-2 rounded-2xl bg-gray-700 text-gray-200 rounded-bl-none">
                            <TypingDots />
                        </div>
                    </div>
                )}
            </div>
            
            <div className="flex-shrink-0 p-4 border-t border-sky-700/50">
                <div className="flex items-center bg-gray-800 rounded-full p-1">
                    <input
                        ref={inputRef}
                        type="text" 
                        className="flex-grow w-full p-2 pl-4 bg-transparent text-white placeholder-gray-400 focus:outline-none font-roboto-mono" 
                        placeholder={!apiKey ? "Please enter an API Key..." : "What's on your mind?..."}
                        value={input} 
                        onChange={(e) => setInput(e.target.value)} 
                        onKeyPress={(e) => { if (e.key === 'Enter') handleSend(); }} 
                        disabled={isThinking || !apiKey} />
                    <button onClick={() => handleSend()} className="p-2 bg-sky-600 hover:bg-sky-500 text-white rounded-full clickable-anim" title="Send Message" disabled={isThinking || !input.trim() || !apiKey}>{isThinking ? <Spinner /> : <SendIcon className="w-5 h-5"/>}</button>
                </div>
            </div>
        </div>
    );
};
const GlobalFloatingChatWidget = ({ callNexusAPI, apiKey, isChatOpen, setIsChatOpen, isAnalysisRunning, isPanelOpen, chatHistory, db, userId, userProfile, setUserProfile }) => {
    if (isAnalysisRunning || isPanelOpen) return null;

    return (
        <div className={`fixed top-4 right-4 z-50 transition-all duration-500 ease-in-out ${isChatOpen ? 'w-[calc(100vw-4rem)] max-w-md h-[calc(100vh-3.5rem)]' : 'w-12 h-12'}`}>
            {isChatOpen ? (
                <EmbeddedChatPanel 
                    callNexusAPI={callNexusAPI} 
                    apiKey={apiKey} 
                    setIsChatOpen={setIsChatOpen} 
                    chatHistory={chatHistory}
                    db={db}
                    userId={userId}
                    userProfile={userProfile}
                    setUserProfile={setUserProfile}
                />
            ) : (
                <button onClick={() => setIsChatOpen(true)} className="p-2 w-full h-full flex items-center justify-center bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-full shadow-lg clickable-anim btn-glow-sky" title="Open Chat">
                    <MessageSquareIcon size={20} />
                </button>
            )}
        </div>
    );
};
const MatrixRain = ({ active }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!active) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        const katakana = 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン';
        const latin = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const nums = '0123456789';
        const alphabet = katakana + latin + nums;
        const fontSize = 16;
        const columns = canvas.width / fontSize;
        const rainDrops = Array.from({ length: Math.ceil(columns) }).map(() => 1);

        const draw = () => {
            ctx.fillStyle = 'rgba(0, 5, 20, 0.04)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.font = fontSize + 'px monospace';

            for (let i = 0; i < rainDrops.length; i++) {
                const text = alphabet.charAt(Math.floor(Math.random() * alphabet.length));
                const y = rainDrops[i] * fontSize;

                const rand = Math.random();
                 if (rand < 0.005) { 
                    ctx.fillStyle = '#FFD700'; // Gold
                    ctx.shadowBlur = 5;
                    ctx.shadowColor = '#FFD700';
                 } else if (rand < 0.02) { 
                    ctx.fillStyle = '#fafafa'; // White highlight
                    ctx.shadowBlur = 3;
                    ctx.shadowColor = '#fafafa';
                 } else if (rand < 0.1) {
                    ctx.fillStyle = '#38bdf8'; // Light Blue
                    ctx.shadowBlur = 0;
                 } else {
                    ctx.fillStyle = '#0ea5e9'; // Nexus Blue
                    ctx.shadowBlur = 0;
                 }
                
                ctx.fillText(text, i * fontSize, y);
                ctx.shadowBlur = 0;


                if (y > canvas.height && Math.random() > 0.99) {
                    rainDrops[i] = 0;
                }
                rainDrops[i]++;
            }
        };

        const animate = () => {
            draw();
            animationFrameId = window.requestAnimationFrame(animate);
        };
        animate();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            window.cancelAnimationFrame(animationFrameId);
        };
    }, [active]);

    if (!active) return null;
    return <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full z-0 pointer-events-none opacity-50"></canvas>;
};

export default App;

