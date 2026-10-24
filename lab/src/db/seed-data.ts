/**
 * Seed content: the course, the concept register as it stood on 2026-10-24,
 * the placement result, the open parking-lot notes and the source library.
 *
 * Every id is derived from a stable natural key (src/lib/stable-id.ts), so
 * `npm run db:setup` is idempotent: re-running it inserts nothing new and
 * leaves anything already edited alone.
 */

import { stableId } from '../lib/stable-id'
import type {
  ConceptStatus,
  Grade,
  ModuleSize,
  ProgressStatus,
  ReadStatus,
  SessionMode,
  SourceKind,
} from '../lib/types'

const D23 = '2026-10-23T09:00:00.000Z'
const D24 = '2026-10-24T09:00:00.000Z'

export const moduleId = (code: string) => stableId('module', code)
export const lessonId = (code: string, order: number) =>
  stableId('lesson', `${code}:${order}`)
export const conceptId = (concept: string) => stableId('concept', concept)
export const sourceId = (title: string) => stableId('source', title)

export type SeedLesson = {
  order: number
  title: string
  objectives: string
  preWork: string
  buildExercise: string | null
  bridgePrompt: string
  status?: ProgressStatus
}

export type SeedModule = {
  code: string
  title: string
  summary: string
  order: number
  size: ModuleSize
  status?: ProgressStatus
  lessons: SeedLesson[]
}

export const SEED_MODULES: SeedModule[] = [
  {
    code: 'M0',
    title: 'How LLMs actually work',
    summary:
      'The mechanism underneath everything else: weights, next-token prediction, training, and why a fluent answer can still be wrong.',
    order: 1,
    size: 'full',
    status: 'in_progress',
    lessons: [
      {
        order: 1,
        title: 'What a model is',
        objectives:
          'Knowledge lives in the weights, not in a database the model looks things up in. Next-token prediction is the whole mechanism. Sampling is why the same prompt gives different answers in different chats.',
        preWork: 'Karpathy, "Intro to Large Language Models" — the first 25 minutes.',
        buildExercise:
          'Run one factual prompt and one open prompt, each in 5 fresh chats. Write your prediction for both before you run anything: how much will the answers differ, and which prompt will vary more? Then log the differences you actually got.',
        bridgePrompt:
          '"Why would your agent ever make something up?" — answered to a CIO in 60 seconds.',
        status: 'in_progress',
      },
      {
        order: 2,
        title: 'How training works',
        objectives:
          'Loss as a measured error. Gradient descent and backpropagation as the mechanism that turns that error into a direction for every parameter at once. Why training can work without anyone understanding what a single parameter does.',
        preWork: 'Karpathy, "Intro to Large Language Models" — the rest of the talk.',
        buildExercise: null,
        bridgePrompt:
          'Why agent behaviour has to be tested from the outside, rather than reasoned about from the model’s internals.',
        status: 'in_progress',
      },
      {
        order: 3,
        title: 'Training stages',
        objectives:
          'Pretraining, fine-tuning, RLHF and RL from verifiable rewards: what each stage changes about the behaviour you see, and which stage a given complaint about a model belongs to.',
        preWork:
          'Karpathy, "Deep Dive into LLMs like ChatGPT" — the training sections.',
        buildExercise: null,
        bridgePrompt:
          'Why two models from different vendors behave differently on the same prompt, and what that means for a customer who wants to swap one for the other.',
      },
      {
        order: 4,
        title: 'Hallucination and reasoning models',
        objectives:
          'Why fluent is not the same as correct, stated as a mechanism rather than a warning. What "thinking" models change about that, and what they leave exactly as it was.',
        preWork:
          'Karpathy, "Deep Dive into LLMs like ChatGPT" — the hallucination and reasoning sections.',
        buildExercise:
          'Catch the same model being wrong three times, using three different prompt styles. Predict which style will fail first and why, then run it.',
        bridgePrompt:
          'What reasoning models do and do not fix for enterprise use.',
      },
    ],
  },
  {
    code: 'AIA',
    title: 'AI Act essentials',
    summary:
      'Enough of the EU AI Act to scope a project correctly: which tier a use case lands in, and who owes what.',
    order: 2,
    size: 'short',
    lessons: [
      {
        order: 1,
        title: 'Risk tiers',
        objectives:
          'The tiers: prohibited, high-risk (Annex III — for example creditworthiness of individuals), limited risk with transparency duties, and minimal risk. The AI Act and the GDPR are different laws with different triggers; answering an AI Act question with a data-residency frame is the mistake to avoid.',
        preWork: 'artificialintelligenceact.eu — the overview pages.',
        buildExercise:
          'Classify 5 real-world agent use cases into the tiers. Write your classification and your reason for each one before you check it against Annex III, then compare.',
        bridgePrompt:
          'Explain to a Finnish CIO why a loan pre-screening agent is a different project from a marketing-email agent.',
      },
      {
        order: 2,
        title: 'Obligations in practice',
        objectives:
          'Provider versus deployer duties, and which one a systems integrator actually is in a given deal. Human oversight, logging, technical documentation and the fundamental-rights impact assessment. Application dates — check the current status before quoting any of them, the dates have been under revision.',
        preWork:
          'Regulation (EU) 2024/1689 — Chapter III, the provider and deployer obligations; then check the current application-date status rather than assuming it.',
        buildExercise: null,
        bridgePrompt: 'Where Agent Harbor fits in a high-risk deployment.',
      },
    ],
  },
  {
    code: 'M1',
    title: 'Prompting and context engineering',
    summary:
      'Treating the context window as a budget, and a prompt as a specification you can test instead of a wish.',
    order: 3,
    size: 'full',
    lessons: [
      {
        order: 1,
        title: 'System prompts, examples, structured output',
        objectives:
          'What a system prompt actually does to the model’s next-token distribution. Few-shot examples as specification rather than decoration. Structured output as a contract you can validate in code.',
        preWork: 'Anthropic, "Effective context engineering for AI agents".',
        buildExercise: null,
        bridgePrompt:
          'Why "we’ll just tell it to be accurate" is not a specification a customer can hold you to.',
      },
      {
        order: 2,
        title: 'Context as a scarce resource',
        objectives:
          'The context window as a budget that is spent, not a container that is filled. Context rot: why long sessions get worse, and what that looks like before you notice it. What belongs in context versus what should be retrieved on demand.',
        preWork: 'Chip Huyen, AI Engineering — the context chapter.',
        buildExercise: null,
        bridgePrompt:
          'What to tell a customer who asks for an agent that "remembers everything".',
      },
      {
        order: 3,
        title: 'Build: rewrite the news digest prompt',
        objectives:
          'Turn the two previous lessons into one rewritten prompt, and measure the difference instead of asserting it.',
        preWork:
          'Re-read your current AI news digest prompt and write down its three known failure modes before touching it.',
        buildExercise:
          'Rewrite the AI news digest prompt. Predict what will change and what will not, then compare 3 runs before against 3 runs after.',
        bridgePrompt: 'Why "just give the agent all our documents" fails.',
      },
    ],
  },
  {
    code: 'M2',
    title: 'Evals',
    summary:
      'How you know whether an agent is any good, and how you know when it got worse.',
    order: 4,
    size: 'full',
    lessons: [
      {
        order: 1,
        title: 'Error analysis and golden sets',
        objectives:
          'Read real failures before writing any metric. What a golden set is, how small it is allowed to be, and how it stays honest once the system has seen it.',
        preWork: 'Hamel Husain, "Your AI Product Needs Evals".',
        buildExercise: null,
        bridgePrompt:
          'Why an eval set is a deliverable the customer owns, not a one-off test you run before handover.',
      },
      {
        order: 2,
        title: 'Code checks vs LLM-as-judge; judge calibration',
        objectives:
          'What belongs in a deterministic check and what genuinely needs a judge. Calibrating a judge against your own labels, and the failure where a judge and the system under test share the same blind spot.',
        preWork:
          'Hamel Husain on LLM-as-judge; Chip Huyen, AI Engineering — the evaluation chapters.',
        buildExercise: null,
        bridgePrompt:
          'What you can promise a customer about agent quality, and what you can only measure.',
      },
      {
        order: 3,
        title: 'Process vs outcome grading',
        objectives:
          'Grading the decision given what was known, against grading the result that followed. Where process supervision beats outcome supervision, and what it costs to define a good process.',
        preWork: 'Lightman et al., "Let’s Verify Step by Step".',
        buildExercise:
          'Build an eval set for the news digest, seeded with its three known failures: category monoculture, invented product capabilities, and loose VERIFIED tagging. Predict the pass rate for each failure before you run it, then run the set 5 times.',
        bridgePrompt:
          '"How will you know your agent got worse after a model update?"',
      },
    ],
  },
  {
    code: 'M3',
    title: 'Tools and single agents',
    summary:
      'One agent, some tools, and the loop in between: where it earns its cost and where a workflow would have done.',
    order: 5,
    size: 'full',
    lessons: [
      {
        order: 1,
        title: 'Tool use and MCP',
        objectives:
          'A tool call as a typed request the model composes from its description. What makes a tool description work or fail. What MCP standardises, and what it leaves to you.',
        preWork: 'Anthropic, "Writing effective tools for agents".',
        buildExercise: null,
        bridgePrompt:
          'Why a customer’s existing API is not automatically an agent tool.',
      },
      {
        order: 2,
        title: 'The agent loop; workflows vs agents',
        objectives:
          'The loop: observe, choose, act, observe again. Where fixed steps in code are the right answer, and where the model should choose its own steps.',
        preWork: 'Anthropic, "Building effective agents"; Yao et al., ReAct.',
        buildExercise: null,
        bridgePrompt:
          'What the agent loop costs — latency, tokens and unpredictability — in terms a buyer cares about.',
      },
      {
        order: 3,
        title: 'Skills and least privilege',
        objectives:
          'A skill as a versioned, reviewable unit of agent behaviour that lives under git. Least privilege: the smallest tool set that still does the job, and why that is an operational argument rather than a security slogan.',
        preWork: 'Lilian Weng, "LLM Powered Autonomous Agents".',
        buildExercise:
          'Move one Project PG skill into Claude Code as a SKILL.md folder under git. Predict what breaks when the skill loses the context it had inside the Project, then find out.',
        bridgePrompt: 'When a customer needs a workflow, not an agent.',
      },
    ],
  },
  {
    code: 'M4',
    title: 'Retrieval and memory',
    summary:
      'Getting the right text in front of the model, and the difference between remembering and re-retrieving.',
    order: 6,
    size: 'short',
    lessons: [
      {
        order: 1,
        title: 'Embeddings, vector and hybrid search, reranking',
        objectives:
          'What an embedding is, and what it is not. Why hybrid search beats pure vector search on names, codes and numbers. What a reranker adds, and what it costs.',
        preWork: 'Anthropic, "Introducing Contextual Retrieval".',
        buildExercise: null,
        bridgePrompt:
          'Why retrieval quality, not the model, usually decides whether a document agent is useful.',
      },
      {
        order: 2,
        title: 'RAG vs long context; agent memory',
        objectives:
          'When retrieval beats a long context window and when it does not. What agent memory actually is, and why "remembering" and "re-retrieving" fail in different ways.',
        preWork: 'Chip Huyen, AI Engineering — the RAG and memory sections.',
        buildExercise:
          'Build a small retrieval over the EU AI Act text with a golden set of questions. Predict the hit rate, and which questions will miss, before you measure.',
        bridgePrompt:
          'What to ask a customer before promising their agent will "know" their documents.',
      },
    ],
  },
  {
    code: 'M5',
    title: 'Multi-agent systems',
    summary:
      'Several agents, and the two honest reasons to use them: division of labour, and genuinely different points of view.',
    order: 7,
    size: 'short',
    lessons: [
      {
        order: 1,
        title: 'Orchestrator-workers, evaluator-optimizer',
        objectives:
          'The two patterns that hold up: an orchestrator with workers, and an evaluator with an optimiser. Where the coordination cost shows up, and why the orchestrator must stay out of the hot path.',
        preWork: 'Anthropic, "How we built our multi-agent research system".',
        buildExercise: null,
        bridgePrompt:
          'Why more agents is not more capability, and what to tell a customer who asks for "a team of agents".',
      },
      {
        order: 2,
        title: 'Ensembles, diversity, correlated errors',
        objectives:
          'Self-consistency and the mechanism that makes it work. Correlated errors: why identical clones agree while being wrong together, so agreement is not evidence. What real diversity costs in latency and money.',
        preWork: 'Wang et al., self-consistency.',
        buildExercise:
          'Add disagreement logging to Project PG’s Council of 5, with genuinely different voices. Predict which pairs will agree most often, then check the log.',
        bridgePrompt:
          'Orchestrator sets intent, workers act, oversight stays out of the hot path.',
      },
    ],
  },
  {
    code: 'M6',
    title: 'Agent operations and governance',
    summary:
      'What it takes to run an agent in production and answer for it afterwards. This is the Agent Harbor pitch from the inside.',
    order: 8,
    size: 'full',
    lessons: [
      {
        order: 1,
        title: 'Observability and out-of-band monitoring',
        objectives:
          'What to log from an agent, and what has to be watched from outside it. Goodhart’s law and specification gaming as operational risks with runbook consequences, not philosophy.',
        preWork:
          'OpenAI’s October 2026 report on agents disabling their own monitoring — check the current version and date before citing it.',
        buildExercise: null,
        bridgePrompt: 'Why monitoring the agent cannot run inside the agent.',
      },
      {
        order: 2,
        title: 'Incident response for agents',
        objectives:
          'What an agent incident actually looks like, who gets paged, and how it is contained when the agent is the thing misbehaving. Mapping the NIST AI RMF functions onto an agent in production.',
        preWork: 'NIST AI RMF and the Generative AI Profile.',
        buildExercise: null,
        bridgePrompt:
          'What a customer’s first agent incident will look like, and what they will wish they had logged.',
      },
      {
        order: 3,
        title: 'Governance frameworks',
        objectives:
          'The AI Act in depth for one high-risk deployment, plus ISO/IEC 42001 as a management system: what an auditor will ask for, and which artefact answers it.',
        preWork:
          'ISO/IEC 42001 — structure and clauses; Regulation (EU) 2024/1689 — Chapter III in full.',
        buildExercise:
          'Write an ops runbook for one of your own agents: what is monitored, by what, outside the agent’s reach, and what happens when monitoring goes silent. Predict which failure you would miss today, then check the runbook against it.',
        bridgePrompt: 'The Agent Harbor pitch, understood from the inside.',
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Concept register, as of 2026-10-24
// ---------------------------------------------------------------------------

export type SeedConcept = {
  concept: string
  establishedName: string
  myVersion: string
  whereItBreaks: string
  buildLink: string
  status: ConceptStatus
  /** Module code and lesson order, when the concept came out of a lesson. */
  lesson?: { code: string; order: number }
  createdAt: string
  recallBox?: number
  nextRecallAt?: string | null
}

export const SEED_CONCEPTS: SeedConcept[] = [
  {
    concept: 'Multiple clones + disagreement check',
    establishedName: 'Self-consistency (Wang et al. 2022); ensembling',
    myVersion:
      'Run the same agent several times, treat disagreement as uncertainty',
    whereItBreaks: 'Identical clones share blind spots: agreement ≠ correct',
    buildLink: 'PG Council of 5 (M5)',
    status: 'met',
    createdAt: D23,
  },
  {
    concept: 'Make the clones different',
    establishedName: 'Ensemble diversity; role-differentiated agents',
    myVersion: 'Give each a different bias so a split means a real tradeoff',
    whereItBreaks: 'More voices = more cost and latency',
    buildLink: 'PG Council of 5 (M5)',
    status: 'met',
    createdAt: D23,
  },
  {
    concept: 'Coach sets intent, players decide',
    establishedName: 'Orchestrator-workers; mission command',
    myVersion:
      'Orchestrator plans the path to contact, workers act on their own after',
    whereItBreaks: 'Central planner in the live loop becomes the bottleneck',
    buildLink: '—',
    status: 'met',
    createdAt: D23,
  },
  {
    concept: 'Investigate after, not during',
    establishedName: 'Asynchronous / offline evaluation',
    myVersion: 'Log disagreements live, analyse between rounds',
    whereItBreaks: 'Needs good logging; slow feedback',
    buildLink: 'News digest eval (M2)',
    status: 'met',
    createdAt: D23,
  },
  {
    concept: 'Judge decisions, not results',
    establishedName: 'Process vs outcome supervision (Lightman et al. 2023)',
    myVersion: 'Grade the call given what was known, not whether it won',
    whereItBreaks: 'Needs a definition of a good process',
    buildLink: 'News digest eval (M2)',
    status: 'met',
    createdAt: D23,
  },
  {
    concept: 'Plan → contact → replan loop',
    establishedName: 'Plan-and-execute / replanning agents',
    myVersion:
      'Contact resolves into a new state, which is a new planning moment',
    whereItBreaks: 'Knowing when to replan vs push on',
    buildLink: '—',
    status: 'met',
    createdAt: D23,
  },
  {
    concept: "Watcher outside the agent's reach",
    establishedName: 'Out-of-band monitoring',
    myVersion: "Monitoring the agent can't read, write or switch off",
    whereItBreaks: 'Needs alerts when the monitor itself goes silent',
    buildLink: 'Ops runbook (M6)',
    status: 'met',
    createdAt: D23,
  },
  {
    concept: 'Long sessions get worse',
    establishedName: 'Context degradation ("context rot")',
    myVersion: 'Bloated context lowers output quality',
    whereItBreaks: 'Hard to detect without evals',
    buildLink: 'News digest / PG (M1)',
    status: 'met',
    createdAt: D23,
  },
  {
    concept: 'Reporter state matters',
    establishedName: 'Source reliability weighting; calibration',
    myVersion: 'Weight a report by how reliable the reporter currently is',
    whereItBreaks: "Agents don't signal their own reliability well",
    buildLink: '—',
    status: 'met',
    createdAt: D23,
  },
  {
    concept: 'Model optimises for the metric, not the goal',
    establishedName: "Goodhart's law / specification gaming",
    myVersion: 'Agent games the dashboard instead of doing the job',
    whereItBreaks: 'Hard to spot without independent checks',
    buildLink: 'Ops runbook (M6)',
    status: 'met',
    createdAt: D24,
  },
  {
    concept: 'Workflow vs agent',
    establishedName: 'Anthropic, "Building effective agents"',
    myVersion: 'Fixed steps in code vs model chooses its own steps',
    whereItBreaks: 'Agents cost more and are less predictable',
    buildLink: 'PG skills (M3)',
    status: 'met',
    createdAt: D24,
  },
  {
    concept: 'High-risk AI',
    establishedName: 'EU AI Act, Annex III',
    myVersion: 'Uses like credit scoring carry heavy obligations',
    whereItBreaks: 'Not the same as GDPR data rules',
    buildLink: 'AI Act L1',
    status: 'met',
    lesson: { code: 'AIA', order: 1 },
    createdAt: D24,
  },
  {
    concept: 'Knowledge lives in weights',
    establishedName: 'Parametric knowledge',
    myVersion: 'No lookup database; knowledge is compressed in the model',
    whereItBreaks: 'Why fluent answers can be wrong',
    buildLink: 'M0 L1',
    status: 'met',
    lesson: { code: 'M0', order: 1 },
    createdAt: D24,
  },
  {
    concept: 'Training without understanding',
    establishedName: 'Gradient descent + backpropagation, measuring loss',
    myVersion: 'Measure the error, nudge every parameter downhill, repeat',
    whereItBreaks: 'Finds what works, not why',
    buildLink: 'M0 L2',
    status: 'explained_back_partial',
    lesson: { code: 'M0', order: 2 },
    createdAt: D24,
    recallBox: 0,
    nextRecallAt: '2026-10-25T00:00:00.000Z',
  },
  {
    concept: 'Meaning spread across parameters',
    establishedName:
      'Distributed representation; superposition (Anthropic toy models, 2022)',
    myVersion:
      'No parameter means one thing; meaning lives in combinations',
    whereItBreaks: "Why reading weights doesn't reveal behaviour",
    buildLink: 'M0 L2',
    status: 'met',
    lesson: { code: 'M0', order: 2 },
    createdAt: D24,
  },
  {
    concept: 'Track features, not weights',
    establishedName: 'Interpretability; training dynamics (Pythia checkpoints)',
    myVersion: 'Compare what lights up, not raw numbers',
    whereItBreaks: 'Toy-model findings may not hold at scale',
    buildLink: 'M0 L2',
    status: 'met',
    lesson: { code: 'M0', order: 2 },
    createdAt: D24,
  },
]

// ---------------------------------------------------------------------------
// Explain-back history on M0 L2
// ---------------------------------------------------------------------------

export const EXPLAIN_BACK_PROMPT =
  'How can training improve a model if no one knows what any single parameter does?'

export type SeedExplainBack = {
  key: string
  lesson: { code: string; order: number }
  concept: string
  prompt: string
  answer: string
  grade: Grade
  feedback: string
  missingPieces: string
  createdAt: string
}

export const SEED_EXPLAIN_BACKS: SeedExplainBack[] = [
  {
    key: 'M0L2:1',
    lesson: { code: 'M0', order: 2 },
    concept: 'Training without understanding',
    prompt: EXPLAIN_BACK_PROMPT,
    answer:
      'Training runs the model on a lot of text, checks how wrong it was, and adjusts it to be less wrong next time. That is gradient descent. You do not need to know what any one parameter does, because the process is statistical — it just keeps improving on average.',
    grade: 'partial',
    feedback:
      'Right that training works from measured error and that gradient descent is the named method. But you described what training does, not how it knows which way to adjust. "Statistical, improves on average" is a restatement of the outcome, not the mechanism.',
    missingPieces:
      'The mechanism: loss gives one number, and backpropagation turns that number into a direction for every parameter at once.',
    createdAt: '2026-10-24T10:20:00.000Z',
  },
  {
    key: 'M0L2:2',
    lesson: { code: 'M0', order: 2 },
    concept: 'Training without understanding',
    prompt: EXPLAIN_BACK_PROMPT,
    answer:
      'It nudges the parameters a small amount in the direction that lowers the error, over and over. Training measures which activations light up, and from that it works out which parameters mattered, so you can see what the model learned without understanding individual weights.',
    grade: 'partial',
    feedback:
      'The nudging is correct and you have the repeated small-step picture. But you merged two different things: training does not measure activations to decide the update — that is interpretability, a separate activity done after the fact.',
    missingPieces:
      'Backpropagation computes the gradient for all parameters at once, automatically, by the chain rule. Nothing inspects activations to decide the update, and nothing needs to know what a parameter means.',
    createdAt: '2026-10-24T10:52:00.000Z',
  },
]

// ---------------------------------------------------------------------------
// Placement session
// ---------------------------------------------------------------------------

export const PLACEMENT_SESSION = {
  key: 'placement:2026-10-24',
  mode: 'placement' as SessionMode,
  startedAt: '2026-10-24T08:00:00.000Z',
  endedAt: '2026-10-24T08:55:00.000Z',
  summary:
    'Strong on failure-mode reasoning (correlated errors, silent telemetry, Goodhart). Partial on mechanics (thought of a "knowledge base" rather than weights; attributed output variation to context rather than sampling), context degradation, and eval method. Weak on workflow vs agent definition and on the EU AI Act (answered with a GDPR / data-residency frame). Pattern: answers at gist level and stops. Order changed: AI Act essentials moved directly after M0; M4 and M5 shortened.',
}

// ---------------------------------------------------------------------------
// Parking lot
// ---------------------------------------------------------------------------

export const SEED_PARKING: { key: string; text: string; createdAt: string }[] = [
  {
    key: 'parking:invoice-agent',
    text: 'Invoice-processing agent could also analyse invoice traffic against report parameters (supplier trends, anomalies). Possible Application Factory / Harbor angle.',
    createdAt: D23,
  },
  {
    key: 'parking:compression',
    text: 'Study compression in small models incrementally to understand how meaning forms. Refined: track features, not parameters, and validate at scale.',
    createdAt: D24,
  },
]

// ---------------------------------------------------------------------------
// Sources. Titles and authors only, no URLs.
// ---------------------------------------------------------------------------

export type SeedSource = {
  title: string
  author: string
  moduleCode: string
  kind: SourceKind
  note: string
  readStatus?: ReadStatus
}

export const SEED_SOURCES: SeedSource[] = [
  {
    title: 'Intro to Large Language Models',
    author: 'Andrej Karpathy',
    moduleCode: 'M0',
    kind: 'video',
    note: 'L1 pre-work is the first 25 minutes; L2 is the rest.',
    readStatus: 'reading',
  },
  {
    title: 'Deep Dive into LLMs like ChatGPT',
    author: 'Andrej Karpathy',
    moduleCode: 'M0',
    kind: 'video',
    note: 'Training sections for L3; hallucination and reasoning sections for L4.',
  },
  {
    title: 'EU AI Act overview (artificialintelligenceact.eu)',
    author: 'Future of Life Institute',
    moduleCode: 'AIA',
    kind: 'docs',
    note: 'Tier overview. Secondary source — check anything load-bearing against the regulation itself.',
  },
  {
    title: 'Regulation (EU) 2024/1689 (AI Act)',
    author: 'European Union',
    moduleCode: 'AIA',
    kind: 'regulation',
    note: 'The primary text. Annex III for high-risk uses. Application dates have been under revision — check current status.',
  },
  {
    title: 'Your AI Product Needs Evals',
    author: 'Hamel Husain',
    moduleCode: 'M2',
    kind: 'post',
    note: 'Error analysis first, metrics second.',
  },
  {
    title: "Let's Verify Step by Step",
    author: 'Lightman et al.',
    moduleCode: 'M2',
    kind: 'paper',
    note: 'Process supervision versus outcome supervision.',
  },
  {
    title: 'Writing effective tools for agents',
    author: 'Anthropic',
    moduleCode: 'M3',
    kind: 'post',
    note: 'Tool descriptions as the interface the model actually sees.',
  },
  {
    title: 'Building effective agents',
    author: 'Anthropic',
    moduleCode: 'M3',
    kind: 'post',
    note: 'The workflow versus agent distinction, named.',
  },
  {
    title: 'ReAct: Synergizing Reasoning and Acting in Language Models',
    author: 'Yao et al.',
    moduleCode: 'M3',
    kind: 'paper',
    note: 'The original interleaved reason-and-act loop.',
  },
  {
    title: 'LLM Powered Autonomous Agents',
    author: 'Lilian Weng',
    moduleCode: 'M3',
    kind: 'post',
    note: 'Survey of the components: planning, memory, tool use.',
  },
  {
    title: 'Introducing Contextual Retrieval',
    author: 'Anthropic',
    moduleCode: 'M4',
    kind: 'post',
    note: 'Why chunks need their context attached before embedding.',
  },
  {
    title: 'How we built our multi-agent research system',
    author: 'Anthropic',
    moduleCode: 'M5',
    kind: 'post',
    note: 'Orchestrator-workers in production, with the costs stated.',
  },
  {
    title: 'Self-Consistency Improves Chain of Thought Reasoning',
    author: 'Wang et al.',
    moduleCode: 'M5',
    kind: 'paper',
    note: 'The established name for the multiple-clones idea.',
  },
  {
    title: 'Report on agents disabling their own monitoring (Oct 2026)',
    author: 'OpenAI',
    moduleCode: 'M6',
    kind: 'post',
    note: 'Recent. Verify the exact title, date and claims before using it with a customer.',
  },
  {
    title: 'AI Risk Management Framework and Generative AI Profile',
    author: 'NIST',
    moduleCode: 'M6',
    kind: 'docs',
    note: 'Govern, map, measure, manage. Useful scaffolding for an incident runbook.',
  },
  {
    title: 'ISO/IEC 42001 (AI management systems)',
    author: 'ISO/IEC',
    moduleCode: 'M6',
    kind: 'docs',
    note: 'Management-system standard, not law. Overview depth only.',
  },
  {
    title: 'AI Engineering',
    author: 'Chip Huyen',
    moduleCode: 'all',
    kind: 'book',
    note: 'Reference across all modules: context, retrieval, evaluation, memory.',
  },
  {
    title: "Simon Willison's weblog",
    author: 'Simon Willison',
    moduleCode: '—',
    kind: 'post',
    note: 'Staying current.',
  },
  {
    title: 'Latent Space',
    author: 'swyx & Alessio',
    moduleCode: '—',
    kind: 'post',
    note: 'Staying current.',
  },
]
