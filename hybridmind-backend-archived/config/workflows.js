/**
 * Advanced Agent Workflow Definitions
 * Each agent is a specialized AI system with domain expertise, tools, and sophisticated reasoning
 */

const workflowPresets = {
  // 🧠 STRATEGIC PLANNING & ANALYSIS AGENTS
  'strategic-planner': {
    name: 'Strategic Planning Agent',
    description: 'Elite strategic consultant that decomposes complex goals into executable roadmaps with risk analysis and resource optimization',
    capabilities: ['goal-decomposition', 'risk-assessment', 'resource-modeling', 'timeline-optimization', 'stakeholder-analysis'],
    tools: ['SWOT-analysis', 'gap-analysis', 'critical-path-method', 'monte-carlo-simulation'],
    steps: [
      {
        name: 'strategic-analysis',
        prompt: 'Conduct comprehensive strategic analysis: 1) Stakeholder mapping and power dynamics, 2) Environmental scanning (PESTEL), 3) Competitive landscape assessment, 4) Internal capability audit, 5) Risk identification using scenario planning',
        model: 'gpt-4-turbo-preview',
        requiresInput: true,
        tools: ['web-search', 'data-analysis'],
        validation: 'cross-reference-multiple-sources'
      },
      {
        name: 'goal-decomposition',
        prompt: 'Break down the strategic objective into: 1) Primary objectives with success metrics, 2) Secondary objectives and dependencies, 3) Critical success factors, 4) Potential failure modes, 5) Early warning indicators',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['logic-tree-analysis', 'dependency-mapping'],
        validation: 'logic-consistency-check'
      },
      {
        name: 'resource-modeling',
        prompt: 'Develop detailed resource model: 1) Human capital requirements and skill gaps, 2) Financial resource allocation with ROI projections, 3) Technology and infrastructure needs, 4) Timeline with critical path analysis, 5) Risk mitigation strategies',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['resource-optimization', 'financial-modeling'],
        validation: 'feasibility-analysis'
      },
      {
        name: 'execution-roadmap',
        prompt: 'Create executable roadmap: 1) Phase-by-phase implementation plan, 2) Milestone definitions with acceptance criteria, 3) Resource allocation schedule, 4) Risk monitoring framework, 5) Success measurement dashboard',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['gantt-chart-generation', 'kpi-dashboard'],
        validation: 'stakeholder-review'
      },
      {
        name: 'contingency-planning',
        prompt: 'Develop comprehensive contingency plans: 1) Risk probability assessment, 2) Impact analysis for each risk, 3) Mitigation strategies with triggers, 4) Alternative pathways, 5) Recovery procedures',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['risk-modeling', 'scenario-planning'],
        validation: 'risk-coverage-analysis'
      }
    ],
    outputFormat: 'strategic-roadmap',
    qualityMetrics: ['strategic-alignment', 'feasibility-score', 'risk-mitigation', 'resource-efficiency']
  },

  'constraint-solver': {
    name: 'Constraint Solver Agent',
    description: 'Mathematical optimization specialist that solves complex constraint problems using advanced algorithms and modeling techniques',
    capabilities: ['mathematical-modeling', 'constraint-analysis', 'optimization-algorithms', 'feasibility-testing', 'solution-validation'],
    tools: ['linear-programming', 'integer-programming', 'constraint-programming', 'heuristic-optimization'],
    steps: [
      {
        name: 'problem-formulation',
        prompt: 'Formulate the constraint problem: 1) Identify decision variables and their domains, 2) Define objective function(s), 3) Specify all constraints (hard and soft), 4) Determine solution requirements and bounds',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['mathematical-modeling', 'problem-analysis'],
        validation: 'model-correctness'
      },
      {
        name: 'algorithm-selection',
        prompt: 'Select appropriate solving approach: 1) Analyze problem characteristics (LP, MIP, CP, etc.), 2) Evaluate algorithm suitability and complexity, 3) Consider computational requirements, 4) Plan solution methodology',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['algorithm-analysis', 'complexity-assessment'],
        validation: 'algorithm-appropriateness'
      },
      {
        name: 'solution-generation',
        prompt: 'Generate optimal solutions: 1) Implement selected algorithm, 2) Explore solution space efficiently, 3) Generate multiple solution alternatives, 4) Validate constraint satisfaction and optimality',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['optimization-engine', 'solution-validation'],
        validation: 'optimality-verification'
      },
      {
        name: 'sensitivity-analysis',
        prompt: 'Perform sensitivity analysis: 1) Test solution robustness to parameter changes, 2) Identify critical constraints, 3) Generate solution ranges, 4) Provide decision recommendations',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['sensitivity-testing', 'robustness-analysis'],
        validation: 'stability-assessment'
      }
    ],
    outputFormat: 'optimization-report',
    qualityMetrics: ['optimality-gap', 'constraint-satisfaction', 'solution-stability', 'computational-efficiency']
  },

  'research-synthesizer': {
    name: 'Research Synthesis Agent',
    description: 'Academic research specialist that synthesizes information from multiple sources into coherent, evidence-based insights',
    capabilities: ['literature-review', 'evidence-synthesis', 'methodology-analysis', 'gap-identification', 'knowledge-integration'],
    tools: ['systematic-review', 'meta-analysis', 'citation-networking', 'evidence-grading'],
    steps: [
      {
        name: 'literature-search',
        prompt: 'Conduct comprehensive literature search: 1) Define search strategy and keywords, 2) Identify relevant databases and sources, 3) Apply inclusion/exclusion criteria, 4) Collect and organize references',
        model: 'gpt-4-turbo-preview',
        requiresInput: true,
        tools: ['academic-search', 'database-querying'],
        validation: 'search-comprehensiveness'
      },
      {
        name: 'evidence-evaluation',
        prompt: 'Evaluate research quality: 1) Assess study methodologies and designs, 2) Analyze sample sizes and statistical power, 3) Review bias and confounding factors, 4) Grade evidence quality and reliability',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['methodology-assessment', 'bias-analysis'],
        validation: 'quality-assessment'
      },
      {
        name: 'synthesis-analysis',
        prompt: 'Synthesize findings: 1) Identify common themes and patterns, 2) Resolve conflicting evidence, 3) Perform meta-analysis where appropriate, 4) Generate integrated conclusions',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['thematic-analysis', 'meta-synthesis'],
        validation: 'synthesis-validity'
      },
      {
        name: 'gap-analysis',
        prompt: 'Identify knowledge gaps: 1) Map current understanding boundaries, 2) Highlight areas needing further research, 3) Suggest future study directions, 4) Prioritize research needs',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['gap-mapping', 'research-prioritization'],
        validation: 'gap-identification'
      },
      {
        name: 'recommendation-development',
        prompt: 'Develop evidence-based recommendations: 1) Translate findings into practical applications, 2) Provide implementation guidance, 3) Specify monitoring and evaluation approaches, 4) Address limitations and uncertainties',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['recommendation-framework', 'implementation-planning'],
        validation: 'practical-applicability'
      }
    ],
    outputFormat: 'research-synthesis',
    qualityMetrics: ['evidence-strength', 'synthesis-completeness', 'gap-coverage', 'practical-relevance']
  },

  'critical-evaluator': {
    name: 'Critical Evaluation Agent',
    description: 'Logic and reasoning specialist that evaluates arguments, identifies flaws, and provides constructive feedback',
    capabilities: ['logical-analysis', 'argument-evaluation', 'fallacy-detection', 'evidence-assessment', 'reasoning-validation'],
    tools: ['logic-prover', 'fallacy-detector', 'argument-mapping', 'evidence-weighing'],
    steps: [
      {
        name: 'argument-analysis',
        prompt: 'Analyze argument structure: 1) Identify premises and conclusions, 2) Map logical relationships, 3) Assess argument completeness, 4) Evaluate reasoning validity',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['argument-parsing', 'logic-mapping'],
        validation: 'structural-accuracy'
      },
      {
        name: 'evidence-assessment',
        prompt: 'Evaluate supporting evidence: 1) Assess evidence quality and relevance, 2) Check source credibility and bias, 3) Verify factual accuracy, 4) Analyze evidence strength and sufficiency',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['source-verification', 'evidence-grading'],
        validation: 'evidence-reliability'
      },
      {
        name: 'fallacy-detection',
        prompt: 'Identify logical fallacies: 1) Scan for common fallacies (ad hominem, straw man, etc.), 2) Detect subtle reasoning errors, 3) Analyze rhetorical techniques, 4) Assess persuasive vs. logical elements',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['fallacy-recognition', 'rhetoric-analysis'],
        validation: 'fallacy-identification'
      },
      {
        name: 'constructive-feedback',
        prompt: 'Provide constructive feedback: 1) Highlight strengths and weaknesses, 2) Suggest improvements and alternatives, 3) Offer specific recommendations, 4) Provide balanced assessment',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['feedback-framework', 'improvement-suggestions'],
        validation: 'feedback-constructiveness'
      },
      {
        name: 'recommendation-synthesis',
        prompt: 'Synthesize evaluation results: 1) Provide overall assessment rating, 2) Summarize key findings, 3) Prioritize improvement areas, 4) Outline action plan',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['assessment-synthesis', 'action-planning'],
        validation: 'recommendation-completeness'
      }
    ],
    outputFormat: 'critical-evaluation',
    qualityMetrics: ['logical-soundness', 'evidence-quality', 'fallacy-detection-rate', 'feedback-usefulness']
  },

  'client-intake': {
    name: 'Client Intake Agent',
    description: 'Professional client onboarding specialist that gathers requirements, assesses needs, and establishes project foundations',
    capabilities: ['requirement-gathering', 'stakeholder-analysis', 'scope-definition', 'risk-assessment', 'relationship-building'],
    tools: ['interview-framework', 'requirement-matrix', 'stakeholder-mapping', 'scope-analysis'],
    steps: [
      {
        name: 'initial-assessment',
        prompt: 'Conduct initial client assessment: 1) Understand business context and objectives, 2) Identify key stakeholders and decision-makers, 3) Assess project urgency and constraints, 4) Evaluate organizational readiness',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['context-analysis', 'stakeholder-identification'],
        validation: 'assessment-completeness'
      },
      {
        name: 'requirement-discovery',
        prompt: 'Discover detailed requirements: 1) Conduct structured interviews with stakeholders, 2) Document functional and non-functional requirements, 3) Identify success criteria and acceptance tests, 4) Capture constraints and assumptions',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['requirement-elicitation', 'interview-scripting'],
        validation: 'requirement-accuracy'
      },
      {
        name: 'scope-definition',
        prompt: 'Define project scope: 1) Prioritize requirements using MoSCoW method, 2) Identify in-scope vs. out-of-scope items, 3) Define deliverables and milestones, 4) Establish change control processes',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['scope-modeling', 'prioritization-framework'],
        validation: 'scope-clarity'
      },
      {
        name: 'risk-analysis',
        prompt: 'Analyze project risks: 1) Identify technical and business risks, 2) Assess risk probability and impact, 3) Develop mitigation strategies, 4) Define risk monitoring approach',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['risk-assessment', 'mitigation-planning'],
        validation: 'risk-comprehensiveness'
      },
      {
        name: 'proposal-development',
        prompt: 'Develop project proposal: 1) Create detailed project plan and timeline, 2) Define resource requirements and budget, 3) Establish communication protocols, 4) Prepare contract and agreement terms',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['proposal-generation', 'contract-drafting'],
        validation: 'proposal-completeness'
      }
    ],
    outputFormat: 'client-intake-report',
    qualityMetrics: ['requirement-completeness', 'stakeholder-satisfaction', 'scope-accuracy', 'risk-mitigation']
  },

  // 💼 BUSINESS OPERATIONS AGENTS
  'business-analyst': {
    name: 'Business Analyst Agent',
    description: 'Enterprise business analysis specialist focused on process optimization, requirement engineering, and business case development',
    capabilities: ['process-modeling', 'requirement-engineering', 'business-case-analysis', 'stakeholder-management', 'change-management'],
    tools: ['BPMN-modeling', 'use-case-analysis', 'business-case-modeling', 'impact-analysis'],
    steps: [
      {
        name: 'current-state-analysis',
        prompt: 'Analyze current business processes: 1) Document existing workflows and procedures, 2) Identify pain points and inefficiencies, 3) Assess technology utilization, 4) Evaluate performance metrics',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['process-mapping', 'performance-analysis'],
        validation: 'analysis-accuracy'
      },
      {
        name: 'requirement-engineering',
        prompt: 'Engineer comprehensive requirements: 1) Elicit and document business requirements, 2) Create functional specifications, 3) Define acceptance criteria, 4) Validate requirements with stakeholders',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['requirement-modeling', 'specification-writing'],
        validation: 'requirement-quality'
      },
      {
        name: 'solution-design',
        prompt: 'Design optimal solutions: 1) Evaluate solution alternatives, 2) Develop business case with ROI analysis, 3) Create implementation roadmap, 4) Define success metrics and KPIs',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['solution-evaluation', 'business-case-development'],
        validation: 'solution-feasibility'
      },
      {
        name: 'change-impact-analysis',
        prompt: 'Analyze change impacts: 1) Assess organizational impact of changes, 2) Identify training and support needs, 3) Develop change management strategy, 4) Create communication plan',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['impact-assessment', 'change-planning'],
        validation: 'impact-comprehensiveness'
      },
      {
        name: 'implementation-planning',
        prompt: 'Plan implementation approach: 1) Create detailed implementation plan, 2) Define resource requirements, 3) Establish governance structure, 4) Develop monitoring and control mechanisms',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['implementation-planning', 'governance-framework'],
        validation: 'plan-completeness'
      }
    ],
    outputFormat: 'business-analysis-report',
    qualityMetrics: ['process-efficiency', 'requirement-accuracy', 'business-value', 'implementation-success']
  },

  'project-manager': {
    name: 'Project Manager Agent',
    description: 'Certified project management professional specializing in agile and traditional methodologies with risk management and stakeholder coordination',
    capabilities: ['project-planning', 'risk-management', 'stakeholder-coordination', 'resource-allocation', 'progress-tracking'],
    tools: ['gantt-charting', 'risk-register', 'stakeholder-matrix', 'burndown-charts'],
    steps: [
      {
        name: 'project-initiation',
        prompt: 'Initiate project properly: 1) Define project charter and objectives, 2) Identify key stakeholders and team, 3) Assess project constraints and assumptions, 4) Create initial project plan',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['charter-development', 'stakeholder-analysis'],
        validation: 'initiation-completeness'
      },
      {
        name: 'planning-phase',
        prompt: 'Develop comprehensive project plan: 1) Create work breakdown structure (WBS), 2) Define deliverables and milestones, 3) Estimate effort and duration, 4) Develop resource plan',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['wbs-creation', 'estimation-tools'],
        validation: 'planning-accuracy'
      },
      {
        name: 'risk-management',
        prompt: 'Implement risk management: 1) Identify project risks and issues, 2) Assess probability and impact, 3) Develop mitigation strategies, 4) Create risk monitoring plan',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['risk-assessment', 'mitigation-planning'],
        validation: 'risk-coverage'
      },
      {
        name: 'execution-monitoring',
        prompt: 'Monitor project execution: 1) Track progress against plan, 2) Manage scope changes and issues, 3) Coordinate team activities, 4) Communicate status to stakeholders',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['progress-tracking', 'issue-management'],
        validation: 'monitoring-effectiveness'
      },
      {
        name: 'closure-activities',
        prompt: 'Execute project closure: 1) Obtain stakeholder acceptance, 2) Document lessons learned, 3) Archive project artifacts, 4) Release team resources',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['closure-checklist', 'lessons-learned'],
        validation: 'closure-completeness'
      }
    ],
    outputFormat: 'project-management-report',
    qualityMetrics: ['schedule-adherence', 'budget-compliance', 'stakeholder-satisfaction', 'deliverable-quality']
  },

  'financial-analyst': {
    name: 'Financial Analyst Agent',
    description: 'Expert financial analysis specialist providing investment analysis, valuation modeling, and financial planning services',
    capabilities: ['financial-modeling', 'valuation-analysis', 'investment-analysis', 'risk-assessment', 'forecasting'],
    tools: ['DCF-modeling', 'ratio-analysis', 'monte-carlo-simulation', 'sensitivity-analysis'],
    steps: [
      {
        name: 'financial-statement-analysis',
        prompt: 'Analyze financial statements: 1) Review income statement trends, 2) Assess balance sheet health, 3) Evaluate cash flow patterns, 4) Calculate key financial ratios',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['ratio-analysis', 'trend-analysis'],
        validation: 'analysis-accuracy'
      },
      {
        name: 'valuation-modeling',
        prompt: 'Develop valuation models: 1) Build discounted cash flow (DCF) model, 2) Perform comparable company analysis, 3) Conduct precedent transaction analysis, 4) Calculate intrinsic value ranges',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['dcf-modeling', 'comparable-analysis'],
        validation: 'valuation-accuracy'
      },
      {
        name: 'investment-analysis',
        prompt: 'Conduct investment analysis: 1) Assess investment opportunities, 2) Evaluate risk-return profiles, 3) Perform scenario analysis, 4) Provide investment recommendations',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['portfolio-analysis', 'scenario-planning'],
        validation: 'investment-soundness'
      },
      {
        name: 'forecasting-modeling',
        prompt: 'Develop financial forecasts: 1) Build revenue and expense projections, 2) Create cash flow forecasts, 3) Model balance sheet changes, 4) Perform sensitivity testing',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['forecasting-tools', 'sensitivity-analysis'],
        validation: 'forecast-accuracy'
      },
      {
        name: 'reporting-recommendations',
        prompt: 'Generate analysis report: 1) Summarize key findings and insights, 2) Provide investment recommendations, 3) Highlight risks and uncertainties, 4) Outline monitoring requirements',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['report-generation', 'recommendation-framework'],
        validation: 'report-completeness'
      }
    ],
    outputFormat: 'financial-analysis-report',
    qualityMetrics: ['valuation-accuracy', 'forecast-precision', 'risk-assessment', 'recommendation-quality']
  },

  'marketing-strategist': {
    name: 'Marketing Strategist Agent',
    description: 'Digital marketing expert specializing in campaign strategy, market analysis, and customer acquisition optimization',
    capabilities: ['market-analysis', 'campaign-strategy', 'customer-segmentation', 'brand-positioning', 'performance-optimization'],
    tools: ['market-research', 'segmentation-analysis', 'campaign-modeling', 'A/B-testing-framework'],
    steps: [
      {
        name: 'market-research',
        prompt: 'Conduct market research: 1) Analyze target market characteristics, 2) Assess competitive landscape, 3) Identify market trends and opportunities, 4) Evaluate customer needs and preferences',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['market-analysis', 'competitor-research'],
        validation: 'research-comprehensiveness'
      },
      {
        name: 'customer-segmentation',
        prompt: 'Develop customer segmentation: 1) Identify customer personas and segments, 2) Analyze segment characteristics and behaviors, 3) Determine segment value and potential, 4) Create targeting strategies',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['persona-development', 'segmentation-modeling'],
        validation: 'segmentation-accuracy'
      },
      {
        name: 'campaign-strategy',
        prompt: 'Design marketing campaigns: 1) Define campaign objectives and KPIs, 2) Select appropriate channels and tactics, 3) Develop creative strategy and messaging, 4) Create campaign timeline and budget',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['campaign-planning', 'budget-optimization'],
        validation: 'strategy-effectiveness'
      },
      {
        name: 'brand-positioning',
        prompt: 'Develop brand positioning: 1) Analyze current brand perception, 2) Identify unique value propositions, 3) Define brand personality and voice, 4) Create positioning strategy and messaging',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['brand-analysis', 'positioning-framework'],
        validation: 'positioning-clarity'
      },
      {
        name: 'performance-optimization',
        prompt: 'Optimize campaign performance: 1) Set up tracking and analytics, 2) Implement A/B testing framework, 3) Monitor campaign effectiveness, 4) Provide optimization recommendations',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['analytics-setup', 'optimization-tools'],
        validation: 'performance-improvement'
      }
    ],
    outputFormat: 'marketing-strategy-report',
    qualityMetrics: ['market-insight-depth', 'segmentation-accuracy', 'campaign-effectiveness', 'ROI-achievement']
  },

  'sales-optimizer': {
    name: 'Sales Optimization Agent',
    description: 'Revenue optimization specialist focused on sales process improvement, pipeline management, and conversion rate enhancement',
    capabilities: ['sales-process-analysis', 'pipeline-optimization', 'conversion-analysis', 'forecasting', 'coaching'],
    tools: ['pipeline-analysis', 'conversion-funnel', 'forecasting-models', 'sales-analytics'],
    steps: [
      {
        name: 'sales-process-analysis',
        prompt: 'Analyze sales processes: 1) Map current sales workflow, 2) Identify bottlenecks and inefficiencies, 3) Assess conversion rates at each stage, 4) Evaluate sales team performance',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['process-mapping', 'performance-analysis'],
        validation: 'analysis-accuracy'
      },
      {
        name: 'pipeline-optimization',
        prompt: 'Optimize sales pipeline: 1) Analyze pipeline health and velocity, 2) Identify pipeline gaps and opportunities, 3) Implement lead scoring and prioritization, 4) Develop pipeline acceleration strategies',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['pipeline-modeling', 'lead-scoring'],
        validation: 'optimization-effectiveness'
      },
      {
        name: 'conversion-improvement',
        prompt: 'Improve conversion rates: 1) Analyze conversion bottlenecks, 2) Develop objection handling strategies, 3) Create sales scripts and playbooks, 4) Implement follow-up automation',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['conversion-analysis', 'script-development'],
        validation: 'conversion-improvement'
      },
      {
        name: 'forecasting-modeling',
        prompt: 'Develop sales forecasting: 1) Analyze historical sales data, 2) Build forecasting models, 3) Identify leading indicators, 4) Create accurate revenue projections',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['forecasting-tools', 'data-analysis'],
        validation: 'forecast-accuracy'
      },
      {
        name: 'coaching-development',
        prompt: 'Develop sales coaching: 1) Assess individual salesperson skills, 2) Create personalized development plans, 3) Implement coaching programs, 4) Track improvement and results',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['skill-assessment', 'coaching-framework'],
        validation: 'coaching-effectiveness'
      }
    ],
    outputFormat: 'sales-optimization-report',
    qualityMetrics: ['conversion-rate-improvement', 'pipeline-velocity', 'forecast-accuracy', 'revenue-growth']
  },

  // 💻 DEVELOPER TOOLS AGENTS
  'code-generator': {
    name: 'Code Generator Agent',
    description: 'Expert software engineer specializing in clean, efficient, and maintainable code generation across multiple programming languages',
    capabilities: ['code-generation', 'architecture-design', 'best-practices', 'testing-integration', 'documentation'],
    tools: ['code-templates', 'architecture-patterns', 'testing-frameworks', 'documentation-tools'],
    steps: [
      {
        name: 'requirement-analysis',
        prompt: 'Analyze coding requirements: 1) Understand functional requirements and constraints, 2) Identify technical specifications and dependencies, 3) Assess performance and scalability needs, 4) Define acceptance criteria',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['requirement-parsing', 'technical-analysis'],
        validation: 'requirement-clarity'
      },
      {
        name: 'architecture-design',
        prompt: 'Design software architecture: 1) Select appropriate design patterns, 2) Define component structure and interfaces, 3) Plan data flow and state management, 4) Consider scalability and maintainability',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['architecture-modeling', 'pattern-selection'],
        validation: 'architecture-soundness'
      },
      {
        name: 'code-implementation',
        prompt: 'Generate production-ready code: 1) Implement core functionality with clean code principles, 2) Add comprehensive error handling, 3) Include logging and monitoring, 4) Follow language-specific best practices',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['code-generation', 'best-practice-enforcement'],
        validation: 'code-quality'
      },
      {
        name: 'testing-integration',
        prompt: 'Integrate testing frameworks: 1) Create unit tests for all functions, 2) Develop integration tests for components, 3) Add performance and load tests, 4) Implement continuous integration setup',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['test-generation', 'ci-cd-setup'],
        validation: 'test-coverage'
      },
      {
        name: 'documentation-production',
        prompt: 'Generate comprehensive documentation: 1) Create API documentation and guides, 2) Write code comments and README files, 3) Develop deployment instructions, 4) Create troubleshooting guides',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['documentation-tools', 'api-generation'],
        validation: 'documentation-completeness'
      }
    ],
    outputFormat: 'code-package',
    qualityMetrics: ['code-efficiency', 'maintainability-score', 'test-coverage', 'documentation-quality']
  },

  'code-reviewer': {
    name: 'Code Reviewer Agent',
    description: 'Senior software engineer specializing in comprehensive code reviews, security analysis, and quality assurance',
    capabilities: ['code-analysis', 'security-assessment', 'performance-review', 'best-practice-enforcement', 'maintainability-analysis'],
    tools: ['static-analysis', 'security-scanning', 'performance-profiling', 'code-quality-metrics'],
    steps: [
      {
        name: 'code-structure-review',
        prompt: 'Review code structure and organization: 1) Assess overall architecture and design patterns, 2) Evaluate code organization and modularity, 3) Check naming conventions and consistency, 4) Review file and folder structure',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['architecture-analysis', 'code-organization-check'],
        validation: 'structure-soundness'
      },
      {
        name: 'security-assessment',
        prompt: 'Conduct security analysis: 1) Identify potential security vulnerabilities, 2) Check for secure coding practices, 3) Review authentication and authorization, 4) Assess data protection measures',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['vulnerability-scanning', 'security-best-practices'],
        validation: 'security-completeness'
      },
      {
        name: 'performance-analysis',
        prompt: 'Analyze performance characteristics: 1) Review algorithmic complexity and efficiency, 2) Check resource utilization patterns, 3) Identify potential bottlenecks, 4) Assess scalability considerations',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['complexity-analysis', 'performance-profiling'],
        validation: 'performance-optimization'
      },
      {
        name: 'quality-assessment',
        prompt: 'Evaluate code quality: 1) Check adherence to coding standards, 2) Assess test coverage and quality, 3) Review error handling and logging, 4) Evaluate documentation completeness',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['quality-metrics', 'standards-compliance'],
        validation: 'quality-completeness'
      },
      {
        name: 'improvement-recommendations',
        prompt: 'Provide improvement recommendations: 1) Prioritize issues by severity and impact, 2) Suggest specific code improvements, 3) Recommend best practices implementation, 4) Outline refactoring opportunities',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['recommendation-framework', 'refactoring-suggestions'],
        validation: 'recommendation-practicality'
      }
    ],
    outputFormat: 'code-review-report',
    qualityMetrics: ['security-score', 'performance-rating', 'maintainability-index', 'code-quality-score']
  },

  'debugging-specialist': {
    name: 'Debugging Specialist Agent',
    description: 'Expert debugger specializing in root cause analysis, systematic troubleshooting, and bug resolution across all programming languages',
    capabilities: ['root-cause-analysis', 'systematic-debugging', 'error-pattern-recognition', 'reproduction-strategy', 'fix-validation'],
    tools: ['debugger-tools', 'logging-analysis', 'stack-trace-analysis', 'memory-profiling'],
    steps: [
      {
        name: 'issue-reproduction',
        prompt: 'Reproduce the issue systematically: 1) Gather all relevant information and context, 2) Create minimal reproduction case, 3) Identify environmental factors, 4) Document reproduction steps',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['reproduction-framework', 'environment-analysis'],
        validation: 'reproduction-accuracy'
      },
      {
        name: 'diagnostic-analysis',
        prompt: 'Perform diagnostic analysis: 1) Analyze error messages and stack traces, 2) Review logs and debugging output, 3) Check system state and variables, 4) Identify potential root causes',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['log-analysis', 'stack-trace-parsing'],
        validation: 'diagnostic-accuracy'
      },
      {
        name: 'root-cause-identification',
        prompt: 'Identify root cause: 1) Trace execution flow and data paths, 2) Analyze code logic and algorithms, 3) Check for race conditions and timing issues, 4) Validate assumptions and edge cases',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['code-path-analysis', 'logic-verification'],
        validation: 'root-cause-accuracy'
      },
      {
        name: 'solution-development',
        prompt: 'Develop fix solution: 1) Design appropriate fix approach, 2) Implement code changes with minimal impact, 3) Add defensive programming measures, 4) Create comprehensive test cases',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['fix-design', 'test-case-generation'],
        validation: 'solution-effectiveness'
      },
      {
        name: 'validation-testing',
        prompt: 'Validate the fix: 1) Test fix against reproduction case, 2) Perform regression testing, 3) Verify edge cases and boundary conditions, 4) Confirm performance impact',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['validation-testing', 'regression-testing'],
        validation: 'fix-validation'
      }
    ],
    outputFormat: 'debugging-report',
    qualityMetrics: ['root-cause-accuracy', 'fix-effectiveness', 'regression-prevention', 'solution-efficiency']
  },

  'architecture-consultant': {
    name: 'Architecture Consultant Agent',
    description: 'Enterprise architecture specialist providing scalable system design, technology stack recommendations, and architectural governance',
    capabilities: ['system-architecture', 'scalability-design', 'technology-evaluation', 'architecture-governance', 'migration-planning'],
    tools: ['architecture-modeling', 'scalability-analysis', 'technology-assessment', 'migration-frameworks'],
    steps: [
      {
        name: 'requirements-assessment',
        prompt: 'Assess architectural requirements: 1) Analyze functional and non-functional requirements, 2) Evaluate scalability and performance needs, 3) Assess security and compliance requirements, 4) Identify integration and interoperability needs',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['requirement-analysis', 'constraint-assessment'],
        validation: 'requirement-completeness'
      },
      {
        name: 'architecture-design',
        prompt: 'Design system architecture: 1) Define architectural patterns and principles, 2) Design component architecture and interfaces, 3) Plan data architecture and storage strategies, 4) Define deployment and operational architecture',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['architecture-patterns', 'component-design'],
        validation: 'architecture-soundness'
      },
      {
        name: 'technology-selection',
        prompt: 'Select technology stack: 1) Evaluate technology options and alternatives, 2) Assess technology maturity and ecosystem, 3) Consider team skills and organizational factors, 4) Plan technology roadmap and migration strategy',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['technology-evaluation', 'roadmap-planning'],
        validation: 'technology-appropriateness'
      },
      {
        name: 'scalability-planning',
        prompt: 'Plan for scalability: 1) Design horizontal and vertical scaling strategies, 2) Plan for high availability and fault tolerance, 3) Define performance monitoring and optimization, 4) Create capacity planning framework',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['scalability-modeling', 'performance-planning'],
        validation: 'scalability-effectiveness'
      },
      {
        name: 'governance-framework',
        prompt: 'Establish architectural governance: 1) Define architectural principles and standards, 2) Create review and approval processes, 3) Develop architecture documentation, 4) Plan for ongoing architecture evolution',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['governance-framework', 'documentation-tools'],
        validation: 'governance-completeness'
      }
    ],
    outputFormat: 'architecture-blueprint',
    qualityMetrics: ['scalability-rating', 'technology-fit', 'maintainability-score', 'governance-effectiveness']
  },

  'devops-engineer': {
    name: 'DevOps Engineer Agent',
    description: 'Infrastructure automation specialist providing CI/CD pipelines, container orchestration, and cloud infrastructure management',
    capabilities: ['ci-cd-pipeline', 'infrastructure-automation', 'container-orchestration', 'monitoring-setup', 'security-automation'],
    tools: ['pipeline-automation', 'infrastructure-as-code', 'container-tools', 'monitoring-frameworks'],
    steps: [
      {
        name: 'ci-cd-design',
        prompt: 'Design CI/CD pipelines: 1) Analyze application deployment requirements, 2) Design build and test automation, 3) Plan deployment strategies and environments, 4) Implement continuous integration workflows',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['pipeline-design', 'automation-framework'],
        validation: 'pipeline-efficiency'
      },
      {
        name: 'infrastructure-automation',
        prompt: 'Automate infrastructure: 1) Design infrastructure as code solutions, 2) Implement configuration management, 3) Set up automated provisioning, 4) Create infrastructure monitoring and alerting',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['iac-tools', 'configuration-management'],
        validation: 'automation-completeness'
      },
      {
        name: 'container-orchestration',
        prompt: 'Implement container orchestration: 1) Design container architecture and networking, 2) Set up Kubernetes or Docker Swarm, 3) Implement service discovery and load balancing, 4) Configure auto-scaling and rolling updates',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['container-orchestration', 'service-mesh'],
        validation: 'orchestration-reliability'
      },
      {
        name: 'monitoring-implementation',
        prompt: 'Implement monitoring and observability: 1) Set up application and infrastructure monitoring, 2) Configure logging and log aggregation, 3) Implement alerting and incident response, 4) Create dashboards and reporting',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['monitoring-tools', 'log-aggregation'],
        validation: 'monitoring-comprehensiveness'
      },
      {
        name: 'security-automation',
        prompt: 'Automate security practices: 1) Implement security scanning in pipelines, 2) Set up automated vulnerability assessment, 3) Configure secrets management, 4) Implement compliance automation',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['security-scanning', 'compliance-automation'],
        validation: 'security-effectiveness'
      }
    ],
    outputFormat: 'devops-blueprint',
    qualityMetrics: ['deployment-frequency', 'deployment-reliability', 'recovery-time', 'automation-coverage']
  },

  // 📊 DATA ANALYTICS AGENTS
  'data-analyst': {
    name: 'Data Analyst Agent',
    description: 'Expert data analyst specializing in statistical analysis, data visualization, and business intelligence reporting',
    capabilities: ['statistical-analysis', 'data-visualization', 'trend-analysis', 'predictive-modeling', 'business-intelligence'],
    tools: ['statistical-tools', 'visualization-frameworks', 'data-modeling', 'reporting-tools'],
    steps: [
      {
        name: 'data-exploration',
        prompt: 'Explore and understand data: 1) Assess data quality and completeness, 2) Identify data patterns and distributions, 3) Detect outliers and anomalies, 4) Understand data relationships and correlations',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['data-profiling', 'exploratory-analysis'],
        validation: 'data-understanding'
      },
      {
        name: 'statistical-analysis',
        prompt: 'Perform statistical analysis: 1) Apply appropriate statistical tests and methods, 2) Test hypotheses and validate assumptions, 3) Calculate confidence intervals and significance, 4) Interpret statistical results',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['statistical-testing', 'hypothesis-testing'],
        validation: 'statistical-rigor'
      },
      {
        name: 'data-visualization',
        prompt: 'Create effective visualizations: 1) Select appropriate chart types and layouts, 2) Design clear and informative dashboards, 3) Ensure accessibility and usability, 4) Optimize for different audiences and devices',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['chart-design', 'dashboard-creation'],
        validation: 'visualization-effectiveness'
      },
      {
        name: 'insight-generation',
        prompt: 'Generate actionable insights: 1) Identify key trends and patterns, 2) Develop data-driven recommendations, 3) Quantify business impact and opportunities, 4) Create predictive models where appropriate',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['trend-analysis', 'predictive-modeling'],
        validation: 'insight-actionability'
      },
      {
        name: 'reporting-delivery',
        prompt: 'Deliver comprehensive reports: 1) Structure reports for different audiences, 2) Include executive summaries and detailed analysis, 3) Provide data sources and methodology, 4) Create automated report generation',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['report-generation', 'presentation-tools'],
        validation: 'report-completeness'
      }
    ],
    outputFormat: 'data-analysis-report',
    qualityMetrics: ['statistical-accuracy', 'visualization-clarity', 'insight-value', 'report-usefulness']
  },

  'data-scientist': {
    name: 'Data Scientist Agent',
    description: 'Advanced data science specialist providing machine learning models, predictive analytics, and statistical modeling',
    capabilities: ['machine-learning', 'predictive-modeling', 'feature-engineering', 'model-validation', 'algorithm-selection'],
    tools: ['ml-frameworks', 'statistical-modeling', 'feature-selection', 'model-evaluation'],
    steps: [
      {
        name: 'problem-formulation',
        prompt: 'Formulate data science problem: 1) Define business objective and success metrics, 2) Identify available data and constraints, 3) Select appropriate modeling approach, 4) Plan evaluation methodology',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['problem-analysis', 'objective-definition'],
        validation: 'problem-clarity'
      },
      {
        name: 'data-preparation',
        prompt: 'Prepare data for modeling: 1) Clean and preprocess data, 2) Perform feature engineering and selection, 3) Handle missing values and outliers, 4) Create training and validation datasets',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['data-cleaning', 'feature-engineering'],
        validation: 'data-quality'
      },
      {
        name: 'model-development',
        prompt: 'Develop and train models: 1) Select and implement appropriate algorithms, 2) Optimize hyperparameters and architecture, 3) Train models with cross-validation, 4) Implement ensemble methods when beneficial',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['model-training', 'hyperparameter-tuning'],
        validation: 'model-performance'
      },
      {
        name: 'model-evaluation',
        prompt: 'Evaluate and validate models: 1) Assess model performance metrics, 2) Perform cross-validation and statistical testing, 3) Analyze model interpretability and bias, 4) Compare alternative approaches',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['model-validation', 'performance-analysis'],
        validation: 'evaluation-completeness'
      },
      {
        name: 'deployment-preparation',
        prompt: 'Prepare for model deployment: 1) Optimize model for inference speed, 2) Implement model serialization and versioning, 3) Create monitoring and logging infrastructure, 4) Develop model serving and API endpoints',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['model-optimization', 'deployment-planning'],
        validation: 'deployment-readiness'
      }
    ],
    outputFormat: 'data-science-report',
    qualityMetrics: ['model-accuracy', 'generalization-performance', 'feature-effectiveness', 'deployment-success']
  },

  'data-engineer': {
    name: 'Data Engineer Agent',
    description: 'Data infrastructure specialist providing ETL pipelines, data warehousing, and big data processing solutions',
    capabilities: ['etl-pipeline-design', 'data-warehousing', 'stream-processing', 'data-quality-management', 'performance-optimization'],
    tools: ['etl-tools', 'database-design', 'streaming-frameworks', 'data-quality-tools'],
    steps: [
      {
        name: 'data-architecture-design',
        prompt: 'Design data architecture: 1) Analyze data volume and velocity requirements, 2) Design data storage and processing architecture, 3) Plan data flow and integration patterns, 4) Define data governance and security',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['architecture-design', 'data-modeling'],
        validation: 'architecture-scalability'
      },
      {
        name: 'etl-pipeline-development',
        prompt: 'Develop ETL pipelines: 1) Design extract, transform, load processes, 2) Implement data validation and cleansing, 3) Create error handling and recovery, 4) Optimize for performance and reliability',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['pipeline-development', 'data-transformation'],
        validation: 'pipeline-reliability'
      },
      {
        name: 'data-warehousing',
        prompt: 'Implement data warehousing: 1) Design dimensional and star schemas, 2) Implement data partitioning and indexing, 3) Create data loading and refresh processes, 4) Optimize query performance',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['schema-design', 'performance-tuning'],
        validation: 'warehouse-efficiency'
      },
      {
        name: 'real-time-processing',
        prompt: 'Implement real-time processing: 1) Design streaming data architecture, 2) Implement event processing pipelines, 3) Create real-time analytics capabilities, 4) Ensure data consistency and ordering',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['streaming-processing', 'event-handling'],
        validation: 'real-time-reliability'
      },
      {
        name: 'monitoring-maintenance',
        prompt: 'Set up monitoring and maintenance: 1) Implement data quality monitoring, 2) Create pipeline health checks and alerting, 3) Develop data lineage and auditing, 4) Plan for scalability and maintenance',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['monitoring-setup', 'maintenance-planning'],
        validation: 'operational-readiness'
      }
    ],
    outputFormat: 'data-engineering-blueprint',
    qualityMetrics: ['pipeline-throughput', 'data-quality-score', 'system-reliability', 'maintenance-efficiency']
  },

  'business-intelligence': {
    name: 'Business Intelligence Agent',
    description: 'BI specialist providing dashboard development, KPI tracking, and executive reporting with data storytelling',
    capabilities: ['dashboard-design', 'kpi-development', 'data-storytelling', 'executive-reporting', 'performance-monitoring'],
    tools: ['bi-tools', 'dashboard-frameworks', 'reporting-automation', 'kpi-frameworks'],
    steps: [
      {
        name: 'requirements-gathering',
        prompt: 'Gather BI requirements: 1) Identify key business questions and metrics, 2) Define user roles and access needs, 3) Assess data sources and availability, 4) Determine reporting frequency and format',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['requirement-analysis', 'stakeholder-interviews'],
        validation: 'requirement-accuracy'
      },
      {
        name: 'kpi-development',
        prompt: 'Develop KPI framework: 1) Define key performance indicators, 2) Establish baseline measurements, 3) Create KPI calculation logic, 4) Design KPI visualization and alerting',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['kpi-design', 'metric-definition'],
        validation: 'kpi-relevance'
      },
      {
        name: 'dashboard-creation',
        prompt: 'Create interactive dashboards: 1) Design user-friendly dashboard layouts, 2) Implement drill-down and filtering capabilities, 3) Ensure mobile responsiveness, 4) Optimize dashboard performance',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['dashboard-design', 'visualization-tools'],
        validation: 'dashboard-usability'
      },
      {
        name: 'reporting-automation',
        prompt: 'Automate reporting processes: 1) Create scheduled report generation, 2) Implement automated data refresh, 3) Set up distribution and sharing, 4) Develop report customization options',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['report-automation', 'distribution-tools'],
        validation: 'automation-effectiveness'
      },
      {
        name: 'data-storytelling',
        prompt: 'Develop data storytelling: 1) Create narrative-driven presentations, 2) Design executive summaries with insights, 3) Build interactive data stories, 4) Train users on interpretation and action',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['storytelling-framework', 'presentation-tools'],
        validation: 'storytelling-impact'
      }
    ],
    outputFormat: 'bi-solution-package',
    qualityMetrics: ['kpi-accuracy', 'dashboard-adoption', 'reporting-efficiency', 'insight-actionability']
  },

  // ✍️ CONTENT CREATION AGENTS
  'content-writer': {
    name: 'Content Writer Agent',
    description: 'Professional content creator specializing in SEO-optimized articles, blog posts, and marketing copy with compelling storytelling',
    capabilities: ['seo-optimization', 'storytelling', 'audience-analysis', 'content-strategy', 'engagement-optimization'],
    tools: ['seo-tools', 'content-analysis', 'keyword-research', 'engagement-metrics'],
    steps: [
      {
        name: 'audience-research',
        prompt: 'Research target audience: 1) Analyze audience demographics and psychographics, 2) Identify pain points and interests, 3) Assess content preferences and consumption habits, 4) Define audience personas and segments',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['audience-analysis', 'persona-development'],
        validation: 'audience-accuracy'
      },
      {
        name: 'content-strategy',
        prompt: 'Develop content strategy: 1) Define content goals and objectives, 2) Research competitive content landscape, 3) Identify content gaps and opportunities, 4) Create content calendar and themes',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['competitive-analysis', 'content-planning'],
        validation: 'strategy-effectiveness'
      },
      {
        name: 'seo-optimization',
        prompt: 'Optimize for search engines: 1) Research target keywords and search intent, 2) Optimize title tags and meta descriptions, 3) Structure content for SEO best practices, 4) Plan internal and external linking strategy',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['keyword-research', 'seo-analysis'],
        validation: 'seo-effectiveness'
      },
      {
        name: 'content-creation',
        prompt: 'Create compelling content: 1) Craft engaging headlines and hooks, 2) Develop structured and readable content, 3) Incorporate storytelling and examples, 4) Optimize for different content formats',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['content-writing', 'storytelling-framework'],
        validation: 'content-quality'
      },
      {
        name: 'engagement-optimization',
        prompt: 'Optimize for engagement: 1) Add calls-to-action and interactive elements, 2) Optimize content for social sharing, 3) Include multimedia and visual elements, 4) Plan content promotion and distribution',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['engagement-tools', 'promotion-planning'],
        validation: 'engagement-potential'
      }
    ],
    outputFormat: 'content-package',
    qualityMetrics: ['seo-performance', 'engagement-rate', 'content-quality', 'audience-resonance']
  },

  'technical-writer': {
    name: 'Technical Writer Agent',
    description: 'Technical documentation specialist creating clear, comprehensive documentation for software, APIs, and technical processes',
    capabilities: ['api-documentation', 'user-guide-creation', 'technical-specification', 'process-documentation', 'knowledge-base-development'],
    tools: ['documentation-tools', 'api-specification', 'diagramming-tools', 'version-control'],
    steps: [
      {
        name: 'documentation-planning',
        prompt: 'Plan documentation structure: 1) Analyze user needs and documentation requirements, 2) Define documentation types and formats, 3) Create information architecture and navigation, 4) Establish documentation standards and style guide',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['audience-analysis', 'content-strategy'],
        validation: 'planning-completeness'
      },
      {
        name: 'content-development',
        prompt: 'Develop technical content: 1) Create clear and accurate technical explanations, 2) Develop step-by-step procedures and tutorials, 3) Write API documentation and specifications, 4) Create troubleshooting and FAQ sections',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['technical-writing', 'api-documentation'],
        validation: 'content-accuracy'
      },
      {
        name: 'visual-documentation',
        prompt: 'Create visual documentation: 1) Design diagrams and flowcharts, 2) Create screenshots and annotated images, 3) Develop interactive tutorials and demos, 4) Ensure accessibility and usability standards',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['diagramming-tools', 'visual-design'],
        validation: 'visual-clarity'
      },
      {
        name: 'review-validation',
        prompt: 'Review and validate documentation: 1) Conduct technical accuracy reviews, 2) Perform user testing and feedback collection, 3) Validate procedures and instructions, 4) Ensure consistency and completeness',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['review-process', 'validation-testing'],
        validation: 'documentation-quality'
      },
      {
        name: 'maintenance-planning',
        prompt: 'Plan documentation maintenance: 1) Establish update procedures and schedules, 2) Create version control and change tracking, 3) Develop feedback collection mechanisms, 4) Plan for scalability and expansion',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['maintenance-planning', 'version-control'],
        validation: 'maintenance-feasibility'
      }
    ],
    outputFormat: 'technical-documentation-package',
    qualityMetrics: ['content-accuracy', 'usability-score', 'completeness-rating', 'maintenance-efficiency']
  },

  'creative-writer': {
    name: 'Creative Writer Agent',
    description: 'Literary specialist creating compelling narratives, copywriting, and creative content with emotional resonance and brand voice',
    capabilities: ['narrative-development', 'copywriting', 'brand-voice-creation', 'emotional-storytelling', 'creative-concepting'],
    tools: ['storytelling-frameworks', 'copywriting-templates', 'brand-analysis', 'emotional-analysis'],
    steps: [
      {
        name: 'concept-development',
        prompt: 'Develop creative concepts: 1) Understand brand identity and objectives, 2) Research target audience and market context, 3) Brainstorm creative concepts and themes, 4) Develop concept rationale and positioning',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['concept-brainstorming', 'brand-analysis'],
        validation: 'concept-originality'
      },
      {
        name: 'narrative-structure',
        prompt: 'Structure compelling narratives: 1) Develop story arcs and character development, 2) Create emotional journeys and connections, 3) Design pacing and tension building, 4) Ensure narrative coherence and flow',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['story-structure', 'narrative-design'],
        validation: 'narrative-effectiveness'
      },
      {
        name: 'copywriting-craft',
        prompt: 'Craft persuasive copy: 1) Write compelling headlines and hooks, 2) Develop persuasive body copy and messaging, 3) Create calls-to-action and conversion elements, 4) Optimize for different channels and formats',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['copywriting-techniques', 'persuasion-frameworks'],
        validation: 'copy-effectiveness'
      },
      {
        name: 'brand-voice-development',
        prompt: 'Develop consistent brand voice: 1) Define brand personality and tone guidelines, 2) Create voice and style standards, 3) Develop content templates and frameworks, 4) Ensure voice consistency across all content',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['voice-development', 'style-guide-creation'],
        validation: 'voice-consistency'
      },
      {
        name: 'creative-optimization',
        prompt: 'Optimize creative elements: 1) Test and refine messaging effectiveness, 2) Incorporate feedback and performance data, 3) Adapt content for different audiences, 4) Develop creative testing and iteration processes',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['creative-testing', 'performance-analysis'],
        validation: 'creative-effectiveness'
      }
    ],
    outputFormat: 'creative-content-package',
    qualityMetrics: ['emotional-resonance', 'persuasion-effectiveness', 'brand-consistency', 'creative-originality']
  },

  'social-media-manager': {
    name: 'Social Media Manager Agent',
    description: 'Social media strategist providing content calendars, community management, and engagement optimization across all platforms',
    capabilities: ['social-strategy', 'content-calendar', 'community-management', 'engagement-optimization', 'analytics-reporting'],
    tools: ['social-analytics', 'content-scheduling', 'engagement-tools', 'platform-optimization'],
    steps: [
      {
        name: 'strategy-development',
        prompt: 'Develop social media strategy: 1) Analyze audience demographics and behavior, 2) Research competitive social presence, 3) Define platform selection and content strategy, 4) Establish KPIs and success metrics',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['audience-analysis', 'competitive-research'],
        validation: 'strategy-comprehensiveness'
      },
      {
        name: 'content-planning',
        prompt: 'Plan content calendar: 1) Create content themes and pillars, 2) Develop platform-specific content strategies, 3) Schedule posts and campaigns, 4) Plan user-generated content and collaborations',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['content-calendar', 'campaign-planning'],
        validation: 'content-strategy'
      },
      {
        name: 'engagement-management',
        prompt: 'Manage community engagement: 1) Develop response protocols and guidelines, 2) Create engagement measurement frameworks, 3) Plan community building activities, 4) Monitor sentiment and brand perception',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['engagement-tracking', 'sentiment-analysis'],
        validation: 'engagement-effectiveness'
      },
      {
        name: 'performance-optimization',
        prompt: 'Optimize social performance: 1) Analyze content and engagement metrics, 2) Test different content formats and timing, 3) Optimize posting schedules and frequency, 4) Refine targeting and audience segmentation',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['performance-analysis', 'A/B-testing'],
        validation: 'optimization-results'
      },
      {
        name: 'reporting-analytics',
        prompt: 'Generate analytics reports: 1) Track and report on KPIs and objectives, 2) Provide insights and recommendations, 3) Create executive summaries and dashboards, 4) Plan future strategy adjustments',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['analytics-reporting', 'dashboard-creation'],
        validation: 'reporting-accuracy'
      }
    ],
    outputFormat: 'social-media-strategy',
    qualityMetrics: ['engagement-rate', 'reach-growth', 'conversion-impact', 'brand-sentiment']
  },

  // 🤖 AUTOMATION AGENTS
  'process-automator': {
    name: 'Process Automator Agent',
    description: 'Workflow automation specialist providing RPA solutions, API integrations, and business process optimization',
    capabilities: ['rpa-development', 'workflow-automation', 'api-integration', 'process-optimization', 'automation-scalability'],
    tools: ['rpa-tools', 'api-connectors', 'workflow-engines', 'automation-frameworks'],
    steps: [
      {
        name: 'process-analysis',
        prompt: 'Analyze business processes: 1) Document current workflows and procedures, 2) Identify automation opportunities and bottlenecks, 3) Assess process complexity and frequency, 4) Evaluate automation feasibility and ROI',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['process-mapping', 'efficiency-analysis'],
        validation: 'analysis-accuracy'
      },
      {
        name: 'automation-design',
        prompt: 'Design automation solutions: 1) Select appropriate automation technologies, 2) Design workflow logic and decision trees, 3) Plan data flow and system integrations, 4) Define error handling and recovery procedures',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['automation-design', 'integration-planning'],
        validation: 'design-feasibility'
      },
      {
        name: 'implementation-development',
        prompt: 'Develop automation implementation: 1) Build RPA scripts and workflows, 2) Implement API connections and data mappings, 3) Create user interfaces and dashboards, 4) Develop monitoring and logging systems',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['script-development', 'interface-design'],
        validation: 'implementation-quality'
      },
      {
        name: 'testing-validation',
        prompt: 'Test and validate automation: 1) Perform unit and integration testing, 2) Validate business logic and data accuracy, 3) Test error scenarios and edge cases, 4) Conduct user acceptance testing',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['testing-frameworks', 'validation-tools'],
        validation: 'testing-completeness'
      },
      {
        name: 'deployment-monitoring',
        prompt: 'Deploy and monitor automation: 1) Plan phased rollout and training, 2) Implement monitoring and alerting systems, 3) Create maintenance and support procedures, 4) Establish performance tracking and optimization',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['deployment-planning', 'monitoring-setup'],
        validation: 'deployment-success'
      }
    ],
    outputFormat: 'automation-solution',
    qualityMetrics: ['automation-efficiency', 'error-reduction', 'roi-achievement', 'user-adoption']
  },

  'integration-specialist': {
    name: 'Integration Specialist Agent',
    description: 'System integration expert providing API development, middleware solutions, and enterprise application integration',
    capabilities: ['api-development', 'middleware-design', 'data-integration', 'system-orchestration', 'integration-testing'],
    tools: ['api-frameworks', 'middleware-tools', 'integration-platforms', 'testing-tools'],
    steps: [
      {
        name: 'integration-requirements',
        prompt: 'Analyze integration requirements: 1) Identify systems and data sources to integrate, 2) Define integration patterns and protocols, 3) Assess data formats and transformation needs, 4) Evaluate security and compliance requirements',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['system-analysis', 'requirement-gathering'],
        validation: 'requirement-completeness'
      },
      {
        name: 'architecture-design',
        prompt: 'Design integration architecture: 1) Select integration patterns and technologies, 2) Design data flow and transformation logic, 3) Plan error handling and recovery mechanisms, 4) Define monitoring and management approaches',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['architecture-design', 'pattern-selection'],
        validation: 'architecture-soundness'
      },
      {
        name: 'api-middleware-development',
        prompt: 'Develop APIs and middleware: 1) Create RESTful and GraphQL APIs, 2) Implement message queues and event streaming, 3) Build data transformation and mapping services, 4) Develop authentication and authorization systems',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['api-development', 'middleware-tools'],
        validation: 'development-quality'
      },
      {
        name: 'data-integration',
        prompt: 'Implement data integration: 1) Design ETL/ELT pipelines and processes, 2) Implement real-time data synchronization, 3) Create data quality validation and cleansing, 4) Build data lineage and audit trails',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['data-pipeline', 'quality-validation'],
        validation: 'data-integrity'
      },
      {
        name: 'testing-deployment',
        prompt: 'Test and deploy integration: 1) Perform comprehensive integration testing, 2) Validate data consistency and performance, 3) Implement monitoring and alerting, 4) Plan deployment and rollback procedures',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['integration-testing', 'deployment-tools'],
        validation: 'integration-reliability'
      }
    ],
    outputFormat: 'integration-solution',
    qualityMetrics: ['integration-reliability', 'data-accuracy', 'performance-efficiency', 'maintenance-simplicity']
  },

  'workflow-orchestrator': {
    name: 'Workflow Orchestrator Agent',
    description: 'Enterprise workflow management specialist providing complex process orchestration, rule engines, and business rule automation',
    capabilities: ['workflow-modeling', 'rule-engine-design', 'process-orchestration', 'decision-automation', 'workflow-optimization'],
    tools: ['workflow-engines', 'rule-engines', 'process-modeling', 'automation-frameworks'],
    steps: [
      {
        name: 'workflow-analysis',
        prompt: 'Analyze workflow requirements: 1) Document business processes and decision points, 2) Identify automation opportunities and constraints, 3) Assess scalability and performance requirements, 4) Define success criteria and KPIs',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['process-analysis', 'requirement-mapping'],
        validation: 'analysis-completeness'
      },
      {
        name: 'workflow-design',
        prompt: 'Design workflow architecture: 1) Model workflow logic and decision trees, 2) Design state management and transitions, 3) Plan exception handling and recovery, 4) Define workflow monitoring and reporting',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['workflow-modeling', 'state-design'],
        validation: 'design-soundness'
      },
      {
        name: 'rule-engine-development',
        prompt: 'Develop business rule engines: 1) Implement decision tables and rule sets, 2) Create dynamic rule evaluation systems, 3) Build rule testing and validation frameworks, 4) Design rule maintenance and versioning',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['rule-development', 'decision-tables'],
        validation: 'rule-accuracy'
      },
      {
        name: 'orchestration-implementation',
        prompt: 'Implement workflow orchestration: 1) Build workflow execution engines, 2) Implement parallel processing and synchronization, 3) Create workflow state persistence and recovery, 4) Develop workflow APIs and integrations',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['orchestration-tools', 'execution-engines'],
        validation: 'orchestration-reliability'
      },
      {
        name: 'optimization-monitoring',
        prompt: 'Optimize and monitor workflows: 1) Implement performance monitoring and analytics, 2) Create workflow optimization recommendations, 3) Develop automated workflow improvements, 4) Establish governance and compliance monitoring',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['performance-monitoring', 'optimization-frameworks'],
        validation: 'optimization-effectiveness'
      }
    ],
    outputFormat: 'workflow-orchestration-solution',
    qualityMetrics: ['workflow-efficiency', 'decision-accuracy', 'system-reliability', 'scalability-rating']
  },

  'ai-orchestrator': {
    name: 'AI Orchestrator Agent',
    description: 'Multi-agent system coordinator providing intelligent task delegation, agent collaboration, and AI workflow optimization',
    capabilities: ['agent-coordination', 'task-delegation', 'ai-workflow-optimization', 'collaboration-management', 'performance-orchestration'],
    tools: ['agent-frameworks', 'coordination-tools', 'performance-monitoring', 'optimization-engines'],
    steps: [
      {
        name: 'task-analysis',
        prompt: 'Analyze complex tasks: 1) Break down tasks into component subtasks, 2) Identify required agent capabilities and expertise, 3) Assess task dependencies and sequencing, 4) Define success criteria and quality metrics',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['task-decomposition', 'capability-mapping'],
        validation: 'task-analysis-accuracy'
      },
      {
        name: 'agent-selection',
        prompt: 'Select appropriate agents: 1) Match agent capabilities to task requirements, 2) Assess agent current load and availability, 3) Consider agent performance history and reliability, 4) Factor in cost and quality preferences',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['agent-matching', 'performance-evaluation'],
        validation: 'agent-fit-appropriateness'
      },
      {
        name: 'workflow-orchestration',
        prompt: 'Orchestrate AI workflows: 1) Design agent interaction and data flow, 2) Implement task delegation and handoff logic, 3) Create error handling and recovery procedures, 4) Optimize workflow execution and performance',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['workflow-design', 'execution-optimization'],
        validation: 'orchestration-efficiency'
      },
      {
        name: 'collaboration-management',
        prompt: 'Manage agent collaboration: 1) Facilitate inter-agent communication and coordination, 2) Resolve conflicts and dependency issues, 3) Ensure consistent data sharing and context preservation, 4) Monitor collaborative performance and quality',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['collaboration-tools', 'conflict-management'],
        validation: 'collaboration-effectiveness'
      },
      {
        name: 'performance-optimization',
        prompt: 'Optimize AI orchestration: 1) Monitor agent and workflow performance, 2) Identify bottlenecks and optimization opportunities, 3) Implement continuous improvement processes, 4) Scale orchestration for increasingly complex tasks',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['performance-analysis', 'optimization-frameworks'],
        validation: 'optimization-effectiveness'
      }
    ],
    outputFormat: 'ai-orchestration-framework',
    qualityMetrics: ['task-completion-rate', 'orchestration-efficiency', 'collaboration-quality', 'performance-scalability']
  },

  // 🎯 DOMAIN EXPERTS
  'legal-expert': {
    name: 'Legal Expert Agent',
    description: 'Legal specialist providing contract analysis, compliance review, and legal risk assessment with regulatory expertise',
    capabilities: ['contract-analysis', 'compliance-review', 'risk-assessment', 'regulatory-analysis', 'legal-research'],
    tools: ['legal-databases', 'contract-analysis-tools', 'compliance-frameworks', 'risk-assessment-tools'],
    steps: [
      {
        name: 'legal-issue-identification',
        prompt: 'Identify legal issues and requirements: 1) Analyze legal context and jurisdiction, 2) Identify applicable laws and regulations, 3) Assess legal risks and exposures, 4) Define legal objectives and constraints',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['legal-research', 'risk-identification'],
        validation: 'legal-analysis-accuracy'
      },
      {
        name: 'contract-compliance-review',
        prompt: 'Review contracts and compliance: 1) Analyze contract terms and conditions, 2) Assess compliance with applicable regulations, 3) Identify potential legal liabilities, 4) Recommend contract modifications and safeguards',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['contract-analysis', 'compliance-checking'],
        validation: 'compliance-accuracy'
      },
      {
        name: 'risk-assessment',
        prompt: 'Conduct legal risk assessment: 1) Evaluate legal risks and probabilities, 2) Assess potential financial and reputational impacts, 3) Develop risk mitigation strategies, 4) Create contingency plans and insurance recommendations',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['risk-modeling', 'impact-analysis'],
        validation: 'risk-assessment-completeness'
      },
      {
        name: 'regulatory-compliance',
        prompt: 'Ensure regulatory compliance: 1) Monitor regulatory changes and updates, 2) Implement compliance monitoring systems, 3) Develop compliance training programs, 4) Create audit and reporting procedures',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['regulatory-tracking', 'compliance-monitoring'],
        validation: 'compliance-effectiveness'
      },
      {
        name: 'legal-recommendations',
        prompt: 'Provide legal recommendations: 1) Develop legal strategies and approaches, 2) Create implementation plans and timelines, 3) Recommend legal counsel and expert consultation, 4) Outline monitoring and review procedures',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['strategy-development', 'implementation-planning'],
        validation: 'recommendation-practicality'
      }
    ],
    outputFormat: 'legal-analysis-report',
    qualityMetrics: ['legal-accuracy', 'risk-mitigation', 'compliance-coverage', 'recommendation-effectiveness']
  },

  'medical-expert': {
    name: 'Medical Expert Agent',
    description: 'Healthcare specialist providing medical analysis, treatment recommendations, and clinical decision support with evidence-based medicine',
    capabilities: ['medical-diagnosis', 'treatment-planning', 'clinical-research', 'patient-care-coordination', 'medical-education'],
    tools: ['medical-databases', 'clinical-guidelines', 'diagnostic-tools', 'treatment-protocols'],
    steps: [
      {
        name: 'medical-assessment',
        prompt: 'Conduct medical assessment: 1) Analyze patient symptoms and medical history, 2) Review diagnostic test results and imaging, 3) Assess risk factors and comorbidities, 4) Formulate differential diagnoses',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['symptom-analysis', 'diagnostic-evaluation'],
        validation: 'assessment-accuracy'
      },
      {
        name: 'evidence-based-analysis',
        prompt: 'Apply evidence-based medicine: 1) Research current medical literature and guidelines, 2) Evaluate treatment efficacy and safety, 3) Compare treatment options and outcomes, 4) Assess cost-effectiveness and patient preferences',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['literature-review', 'evidence-synthesis'],
        validation: 'evidence-quality'
      },
      {
        name: 'treatment-recommendations',
        prompt: 'Develop treatment recommendations: 1) Create personalized treatment plans, 2) Recommend medication and therapy options, 3) Develop monitoring and follow-up protocols, 4) Plan preventive care and lifestyle modifications',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['treatment-planning', 'protocol-development'],
        validation: 'treatment-appropriateness'
      },
      {
        name: 'patient-education',
        prompt: 'Provide patient education: 1) Explain medical conditions and treatments, 2) Develop educational materials and resources, 3) Address patient concerns and questions, 4) Promote health literacy and self-management',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['patient-education', 'communication-tools'],
        validation: 'education-effectiveness'
      },
      {
        name: 'care-coordination',
        prompt: 'Coordinate comprehensive care: 1) Facilitate multidisciplinary care teams, 2) Coordinate referrals and specialist consultations, 3) Manage care transitions and continuity, 4) Monitor treatment progress and outcomes',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['care-coordination', 'outcome-tracking'],
        validation: 'coordination-effectiveness'
      }
    ],
    outputFormat: 'medical-consultation-report',
    qualityMetrics: ['diagnostic-accuracy', 'treatment-effectiveness', 'patient-satisfaction', 'outcome-improvement']
  },

  'financial-advisor': {
    name: 'Financial Advisor Agent',
    description: 'Investment and financial planning specialist providing portfolio management, retirement planning, and wealth optimization strategies',
    capabilities: ['portfolio-management', 'retirement-planning', 'tax-optimization', 'risk-management', 'wealth-preservation'],
    tools: ['portfolio-analysis', 'retirement-calculators', 'tax-planning-tools', 'risk-assessment-models'],
    steps: [
      {
        name: 'financial-assessment',
        prompt: 'Assess financial situation: 1) Analyze income, expenses, and net worth, 2) Review current investment portfolio and performance, 3) Assess risk tolerance and investment goals, 4) Identify financial gaps and opportunities',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['financial-analysis', 'portfolio-review'],
        validation: 'assessment-completeness'
      },
      {
        name: 'goal-planning',
        prompt: 'Develop financial goals: 1) Define short-term and long-term objectives, 2) Create retirement and education funding plans, 3) Establish emergency fund and insurance needs, 4) Set investment time horizons and milestones',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['goal-setting', 'planning-frameworks'],
        validation: 'goal-realism'
      },
      {
        name: 'investment-strategy',
        prompt: 'Develop investment strategy: 1) Create diversified portfolio allocations, 2) Select appropriate investment vehicles, 3) Implement tax-efficient investment strategies, 4) Plan rebalancing and portfolio maintenance',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['asset-allocation', 'investment-selection'],
        validation: 'strategy-appropriateness'
      },
      {
        name: 'tax-optimization',
        prompt: 'Optimize tax strategy: 1) Implement tax-advantaged investment accounts, 2) Plan for capital gains and tax-efficient withdrawals, 3) Utilize tax deductions and credits, 4) Coordinate with tax professional recommendations',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['tax-planning', 'optimization-tools'],
        validation: 'tax-efficiency'
      },
      {
        name: 'monitoring-review',
        prompt: 'Monitor and review financial plan: 1) Track portfolio performance and progress, 2) Review and adjust investment strategy, 3) Update financial goals and circumstances, 4) Provide ongoing financial education and guidance',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['performance-monitoring', 'plan-review'],
        validation: 'monitoring-effectiveness'
      }
    ],
    outputFormat: 'financial-planning-report',
    qualityMetrics: ['portfolio-performance', 'goal-achievement', 'risk-management', 'tax-efficiency']
  },

  'security-expert': {
    name: 'Security Expert Agent',
    description: 'Cybersecurity specialist providing threat analysis, security architecture, and incident response with comprehensive protection strategies',
    capabilities: ['threat-analysis', 'security-architecture', 'incident-response', 'vulnerability-assessment', 'compliance-security'],
    tools: ['threat-intelligence', 'security-scanners', 'incident-response-tools', 'compliance-frameworks'],
    steps: [
      {
        name: 'security-assessment',
        prompt: 'Conduct security assessment: 1) Analyze current security posture and controls, 2) Identify vulnerabilities and weaknesses, 3) Assess threat landscape and risk exposure, 4) Evaluate compliance with security standards',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['vulnerability-scanning', 'risk-assessment'],
        validation: 'assessment-accuracy'
      },
      {
        name: 'threat-analysis',
        prompt: 'Analyze security threats: 1) Monitor emerging threats and attack vectors, 2) Assess threat actor capabilities and motivations, 3) Evaluate potential impact and likelihood, 4) Develop threat intelligence and indicators',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['threat-intelligence', 'impact-analysis'],
        validation: 'threat-accuracy'
      },
      {
        name: 'security-architecture',
        prompt: 'Design security architecture: 1) Develop defense-in-depth security layers, 2) Implement access controls and authentication, 3) Design network segmentation and isolation, 4) Create incident detection and response systems',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['architecture-design', 'security-frameworks'],
        validation: 'architecture-effectiveness'
      },
      {
        name: 'incident-response',
        prompt: 'Develop incident response capabilities: 1) Create incident response plans and procedures, 2) Implement monitoring and alerting systems, 3) Develop forensic investigation capabilities, 4) Plan recovery and business continuity',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['incident-planning', 'forensic-tools'],
        validation: 'response-effectiveness'
      },
      {
        name: 'compliance-monitoring',
        prompt: 'Ensure security compliance: 1) Implement security policies and standards, 2) Monitor compliance with regulations and frameworks, 3) Conduct regular security audits and assessments, 4) Develop security awareness and training programs',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['compliance-tools', 'audit-frameworks'],
        validation: 'compliance-effectiveness'
      }
    ],
    outputFormat: 'security-assessment-report',
    qualityMetrics: ['threat-detection', 'incident-response-time', 'compliance-rating', 'security-posture']
  },

  // 🎮 SIMULATION AGENTS
  'scenario-simulator': {
    name: 'Scenario Simulator Agent',
    description: 'Advanced simulation specialist providing Monte Carlo analysis, scenario planning, and probabilistic modeling for decision support',
    capabilities: ['monte-carlo-simulation', 'scenario-planning', 'probabilistic-modeling', 'sensitivity-analysis', 'decision-analysis'],
    tools: ['simulation-engines', 'statistical-models', 'scenario-frameworks', 'decision-trees'],
    steps: [
      {
        name: 'model-development',
        prompt: 'Develop simulation models: 1) Identify key variables and relationships, 2) Define probability distributions and correlations, 3) Build mathematical and logical models, 4) Validate model assumptions and parameters',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['model-building', 'parameter-estimation'],
        validation: 'model-accuracy'
      },
      {
        name: 'scenario-definition',
        prompt: 'Define simulation scenarios: 1) Identify critical uncertainties and variables, 2) Create base case and alternative scenarios, 3) Define scenario probabilities and triggers, 4) Establish scenario boundaries and constraints',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['scenario-design', 'uncertainty-analysis'],
        validation: 'scenario-completeness'
      },
      {
        name: 'monte-carlo-execution',
        prompt: 'Execute Monte Carlo simulations: 1) Run large-scale probabilistic simulations, 2) Generate distribution of possible outcomes, 3) Calculate confidence intervals and risk metrics, 4) Identify key drivers and sensitivities',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['monte-carlo-engine', 'statistical-analysis'],
        validation: 'simulation-accuracy'
      },
      {
        name: 'sensitivity-analysis',
        prompt: 'Perform sensitivity analysis: 1) Test model sensitivity to parameter changes, 2) Identify critical success factors and risks, 3) Analyze scenario robustness and stability, 4) Develop risk mitigation strategies',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['sensitivity-testing', 'risk-analysis'],
        validation: 'sensitivity-completeness'
      },
      {
        name: 'decision-support',
        prompt: 'Provide decision support: 1) Analyze simulation results and implications, 2) Develop decision recommendations and options, 3) Create risk-adjusted decision frameworks, 4) Present probabilistic decision outcomes',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['decision-analysis', 'recommendation-framework'],
        validation: 'decision-usefulness'
      }
    ],
    outputFormat: 'simulation-analysis-report',
    qualityMetrics: ['model-accuracy', 'simulation-convergence', 'risk-assessment', 'decision-support-value']
  },

  'game-theory-optimizer': {
    name: 'Game Theory Optimizer Agent',
    description: 'Strategic decision-making specialist using game theory, Nash equilibrium analysis, and competitive strategy optimization',
    capabilities: ['game-theory-analysis', 'nash-equilibrium', 'strategy-optimization', 'competitive-analysis', 'decision-theory'],
    tools: ['game-theory-models', 'equilibrium-solvers', 'strategy-matrices', 'payoff-analysis'],
    steps: [
      {
        name: 'game-modeling',
        prompt: 'Model strategic situations: 1) Identify players, strategies, and payoffs, 2) Define game structure and rules, 3) Assess information availability and timing, 4) Validate game theory assumptions and applicability',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['game-modeling', 'payoff-analysis'],
        validation: 'model-appropriateness'
      },
      {
        name: 'equilibrium-analysis',
        prompt: 'Analyze strategic equilibria: 1) Calculate Nash equilibria and dominant strategies, 2) Identify Pareto optimal outcomes, 3) Assess equilibrium stability and robustness, 4) Evaluate multiple equilibrium scenarios',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['equilibrium-solvers', 'stability-analysis'],
        validation: 'equilibrium-accuracy'
      },
      {
        name: 'strategy-optimization',
        prompt: 'Optimize strategic decisions: 1) Develop optimal strategy recommendations, 2) Analyze trade-offs and opportunity costs, 3) Consider behavioral factors and bounded rationality, 4) Create contingency strategies for different outcomes',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['strategy-optimization', 'decision-analysis'],
        validation: 'strategy-effectiveness'
      },
      {
        name: 'competitive-dynamics',
        prompt: 'Analyze competitive dynamics: 1) Model competitor responses and reactions, 2) Assess market entry and exit strategies, 3) Evaluate bargaining power and negotiation leverage, 4) Develop competitive positioning strategies',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['competitive-analysis', 'market-modeling'],
        validation: 'dynamics-accuracy'
      },
      {
        name: 'implementation-planning',
        prompt: 'Plan strategy implementation: 1) Develop tactical implementation plans, 2) Create monitoring and adjustment mechanisms, 3) Plan communication and coordination strategies, 4) Establish success metrics and evaluation frameworks',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['implementation-planning', 'monitoring-frameworks'],
        validation: 'implementation-feasibility'
      }
    ],
    outputFormat: 'game-theory-analysis-report',
    qualityMetrics: ['equilibrium-identification', 'strategy-optimality', 'predictive-accuracy', 'implementation-success']
  },

  'system-simulator': {
    name: 'System Simulator Agent',
    description: 'Complex system modeling specialist providing discrete event simulation, system dynamics, and performance prediction',
    capabilities: ['system-modeling', 'discrete-event-simulation', 'system-dynamics', 'performance-prediction', 'bottleneck-analysis'],
    tools: ['simulation-software', 'system-modeling-tools', 'performance-analyzers', 'optimization-engines'],
    steps: [
      {
        name: 'system-analysis',
        prompt: 'Analyze system requirements: 1) Define system boundaries and components, 2) Identify key performance indicators and metrics, 3) Assess system constraints and limitations, 4) Determine simulation objectives and scope',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['system-analysis', 'requirement-definition'],
        validation: 'analysis-completeness'
      },
      {
        name: 'model-construction',
        prompt: 'Construct simulation models: 1) Build mathematical and physical models, 2) Implement entity behaviors and interactions, 3) Create resource allocation and queuing, 4) Develop feedback loops and system dynamics',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['model-construction', 'entity-modeling'],
        validation: 'model-accuracy'
      },
      {
        name: 'simulation-execution',
        prompt: 'Execute system simulations: 1) Run simulation experiments with varying parameters, 2) Collect performance data and statistics, 3) Analyze system behavior under different conditions, 4) Identify performance bottlenecks and constraints',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['simulation-execution', 'performance-analysis'],
        validation: 'simulation-validity'
      },
      {
        name: 'optimization-analysis',
        prompt: 'Analyze optimization opportunities: 1) Identify system improvement opportunities, 2) Test alternative configurations and designs, 3) Optimize resource allocation and utilization, 4) Develop system enhancement recommendations',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['optimization-analysis', 'configuration-testing'],
        validation: 'optimization-effectiveness'
      },
      {
        name: 'validation-reporting',
        prompt: 'Validate and report findings: 1) Validate simulation results against real-world data, 2) Assess model accuracy and reliability, 3) Create comprehensive simulation reports, 4) Provide implementation recommendations and guidelines',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['validation-frameworks', 'reporting-tools'],
        validation: 'validation-completeness'
      }
    ],
    outputFormat: 'system-simulation-report',
    qualityMetrics: ['model-fidelity', 'simulation-accuracy', 'optimization-impact', 'predictive-reliability']
  },

  // 🧠 META-AGENTS (AGENTS THAT MANAGE OTHER AGENTS)
  'task-router': {
    name: 'Intelligent Task Router Agent',
    description: 'Meta-agent that analyzes tasks and routes them to the most appropriate specialized agents with load balancing',
    capabilities: ['task-analysis', 'agent-matching', 'load-balancing', 'performance-monitoring', 'workflow-optimization'],
    tools: ['task-classification', 'agent-capability-mapping', 'performance-metrics', 'routing-algorithms'],
    steps: [
      {
        name: 'task-analysis',
        prompt: 'Analyze incoming task: 1) Classify task type and complexity, 2) Identify required skills and capabilities, 3) Assess time sensitivity and priority, 4) Determine resource requirements and constraints',
        model: 'gpt-4-turbo-preview',
        requiresInput: true,
        tools: ['task-classification', 'requirement-analysis'],
        validation: 'analysis-accuracy'
      },
      {
        name: 'agent-matching',
        prompt: 'Match task to optimal agent: 1) Evaluate agent capabilities against task requirements, 2) Consider agent current load and availability, 3) Assess historical performance on similar tasks, 4) Factor in cost and quality preferences',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['agent-matching', 'performance-history'],
        validation: 'matching-optimality'
      },
      {
        name: 'workflow-orchestration',
        prompt: 'Orchestrate multi-agent workflows: 1) Break complex tasks into sub-tasks, 2) Sequence agent handoffs and dependencies, 3) Implement parallel processing where possible, 4) Manage inter-agent communication and data flow',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['workflow-design', 'dependency-mapping'],
        validation: 'orchestration-efficiency'
      },
      {
        name: 'quality-assurance',
        prompt: 'Ensure quality and consistency: 1) Monitor agent performance in real-time, 2) Implement quality checkpoints and validation, 3) Handle agent failures and retries, 4) Aggregate and reconcile multiple agent outputs',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['quality-monitoring', 'failure-handling'],
        validation: 'quality-maintenance'
      },
      {
        name: 'continuous-improvement',
        prompt: 'Learn and optimize routing: 1) Analyze routing success rates and performance, 2) Update agent capability mappings, 3) Refine matching algorithms, 4) Implement A/B testing for routing strategies',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['performance-analysis', 'algorithm-optimization'],
        validation: 'improvement-effectiveness'
      }
    ],
    outputFormat: 'routed-task-execution',
    qualityMetrics: ['routing-accuracy', 'completion-time', 'quality-consistency', 'resource-efficiency']
  },

  'quality-assurance-meta': {
    name: 'Quality Assurance Meta Agent',
    description: 'Expert reviewer that validates outputs from all other agents using multiple quality frameworks and standards',
    capabilities: ['output-validation', 'quality-assessment', 'consistency-checking', 'standards-compliance', 'improvement-recommendations'],
    tools: ['quality-frameworks', 'validation-rules', 'consistency-checkers', 'improvement-trackers'],
    steps: [
      {
        name: 'output-assessment',
        prompt: 'Assess agent output quality: 1) Evaluate completeness against requirements, 2) Check accuracy and factual correctness, 3) Assess clarity and comprehensibility, 4) Review adherence to best practices and standards',
        model: 'gpt-4-turbo-preview',
        requiresInput: true,
        tools: ['quality-assessment', 'standards-checking'],
        validation: 'assessment-accuracy'
      },
      {
        name: 'consistency-validation',
        prompt: 'Validate internal consistency: 1) Check logical coherence and flow, 2) Verify consistency across sections/components, 3) Validate terminology and naming conventions, 4) Ensure alignment with stated objectives',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['consistency-analysis', 'logic-validation'],
        validation: 'consistency-accuracy'
      },
      {
        name: 'standards-compliance',
        prompt: 'Check compliance with standards: 1) Verify adherence to industry standards, 2) Check regulatory compliance requirements, 3) Validate against organizational guidelines, 4) Assess accessibility and usability standards',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['compliance-checking', 'standards-validation'],
        validation: 'compliance-accuracy'
      },
      {
        name: 'improvement-analysis',
        prompt: 'Analyze improvement opportunities: 1) Identify quality gaps and weaknesses, 2) Suggest specific improvement actions, 3) Prioritize recommendations by impact, 4) Create action plan with timelines and responsibilities',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['gap-analysis', 'improvement-planning'],
        validation: 'improvement-practicality'
      },
      {
        name: 'feedback-integration',
        prompt: 'Integrate feedback for learning: 1) Document quality patterns and trends, 2) Update quality standards and guidelines, 3) Provide feedback to originating agents, 4) Implement continuous improvement processes',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['feedback-systems', 'learning-integration'],
        validation: 'feedback-effectiveness'
      }
    ],
    outputFormat: 'quality-assessment-report',
    qualityMetrics: ['assessment-accuracy', 'improvement-identification', 'standards-compliance', 'feedback-actionability']
  },

  'agent-coordinator': {
    name: 'Agent Coordinator Meta Agent',
    description: 'Orchestration specialist managing complex multi-agent workflows, task delegation, and collaborative problem-solving across agent teams',
    capabilities: ['multi-agent-orchestration', 'task-delegation', 'collaboration-management', 'workflow-optimization', 'conflict-resolution'],
    tools: ['orchestration-frameworks', 'delegation-tools', 'collaboration-platforms', 'conflict-resolution-tools'],
    steps: [
      {
        name: 'task-analysis',
        prompt: 'Analyze complex tasks: 1) Break down complex problems into manageable components, 2) Identify required agent capabilities and expertise, 3) Assess task dependencies and sequencing requirements, 4) Define success criteria and quality standards',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['task-decomposition', 'capability-assessment'],
        validation: 'task-analysis-accuracy'
      },
      {
        name: 'agent-selection',
        prompt: 'Select appropriate agents: 1) Match agent capabilities to task requirements, 2) Assess agent current load and workload capacity, 3) Consider agent performance history and reliability, 4) Factor in cost and quality preferences',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['agent-matching', 'performance-evaluation'],
        validation: 'selection-appropriateness'
      },
      {
        name: 'workflow-orchestration',
        prompt: 'Orchestrate multi-agent workflows: 1) Design agent interaction and data flow patterns, 2) Implement task delegation and handoff procedures, 3) Create error handling and recovery mechanisms, 4) Optimize workflow execution and resource utilization',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['workflow-design', 'resource-optimization'],
        validation: 'orchestration-efficiency'
      },
      {
        name: 'collaboration-management',
        prompt: 'Manage agent collaboration: 1) Facilitate inter-agent communication and coordination, 2) Resolve conflicts and dependency issues, 3) Ensure consistent data sharing and context preservation, 4) Monitor collaborative performance and quality',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['collaboration-tools', 'conflict-management'],
        validation: 'collaboration-effectiveness'
      },
      {
        name: 'performance-optimization',
        prompt: 'Optimize coordination performance: 1) Monitor overall workflow performance and efficiency, 2) Identify bottlenecks and optimization opportunities, 3) Implement continuous improvement processes, 4) Scale coordination for increasingly complex tasks',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['performance-monitoring', 'optimization-frameworks'],
        validation: 'optimization-effectiveness'
      }
    ],
    outputFormat: 'coordination-report',
    qualityMetrics: ['task-completion-rate', 'orchestration-efficiency', 'collaboration-quality', 'performance-scalability']
  },

  'learning-adaptor': {
    name: 'Learning Adaptor Meta Agent',
    description: 'Adaptive learning specialist continuously improving agent performance through feedback analysis, pattern recognition, and capability enhancement',
    capabilities: ['performance-learning', 'feedback-analysis', 'pattern-recognition', 'capability-enhancement', 'adaptive-optimization'],
    tools: ['learning-algorithms', 'feedback-analysis-tools', 'pattern-recognition', 'optimization-frameworks'],
    steps: [
      {
        name: 'performance-analysis',
        prompt: 'Analyze agent performance: 1) Collect and analyze performance metrics and feedback, 2) Identify strengths, weaknesses, and improvement areas, 3) Assess learning patterns and adaptation needs, 4) Evaluate performance trends and stability',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['performance-analysis', 'feedback-collection'],
        validation: 'analysis-accuracy'
      },
      {
        name: 'pattern-recognition',
        prompt: 'Identify performance patterns: 1) Recognize successful strategies and approaches, 2) Identify common failure modes and challenges, 3) Discover context-dependent performance variations, 4) Extract reusable knowledge and best practices',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['pattern-analysis', 'knowledge-extraction'],
        validation: 'pattern-accuracy'
      },
      {
        name: 'capability-enhancement',
        prompt: 'Enhance agent capabilities: 1) Develop improved prompts and strategies, 2) Expand tool utilization and integration, 3) Enhance decision-making and problem-solving, 4) Implement new learning and adaptation mechanisms',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['capability-development', 'strategy-improvement'],
        validation: 'enhancement-effectiveness'
      },
      {
        name: 'adaptive-optimization',
        prompt: 'Implement adaptive optimization: 1) Create dynamic adjustment and learning systems, 2) Implement context-aware behavior modification, 3) Develop predictive performance optimization, 4) Establish continuous learning and evolution processes',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['adaptive-systems', 'optimization-engines'],
        validation: 'adaptation-effectiveness'
      },
      {
        name: 'knowledge-integration',
        prompt: 'Integrate learned knowledge: 1) Synthesize insights across different contexts, 2) Update agent knowledge bases and capabilities, 3) Implement learned improvements and optimizations, 4) Monitor effectiveness of knowledge integration',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['knowledge-synthesis', 'integration-tools'],
        validation: 'integration-success'
      }
    ],
    outputFormat: 'learning-adaptation-report',
    qualityMetrics: ['learning-effectiveness', 'adaptation-speed', 'performance-improvement', 'knowledge-retention']
  },

  // 🧩 ULTRA-SPECIALIZED MICRO-AGENTS
  'regex-generator': {
    name: 'Regular Expression Specialist Agent',
    description: 'Pattern matching expert that creates optimized, readable regex with comprehensive testing and documentation',
    capabilities: ['pattern-analysis', 'regex-optimization', 'cross-platform-compatibility', 'performance-tuning', 'comprehensive-testing'],
    tools: ['regex-analyzers', 'performance-testers', 'compatibility-checkers', 'documentation-generators'],
    steps: [
      {
        name: 'pattern-requirements',
        prompt: 'Analyze pattern requirements: 1) Document all match cases and examples, 2) Identify edge cases and exclusions, 3) Specify regex engine and flavor requirements, 4) Define performance and readability priorities',
        model: 'gpt-4',
        requiresInput: true,
        tools: ['requirement-analysis', 'example-collection'],
        validation: 'requirement-completeness'
      },
      {
        name: 'regex-development',
        prompt: 'Develop optimized regex: 1) Create initial regex pattern with clear structure, 2) Implement efficient quantifiers and alternation, 3) Add named groups for readability, 4) Optimize for performance (avoid backtracking)',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['regex-construction', 'optimization-tools'],
        validation: 'regex-correctness'
      },
      {
        name: 'comprehensive-testing',
        prompt: 'Test extensively: 1) Test all positive and negative cases, 2) Validate edge cases and boundary conditions, 3) Performance test with large inputs, 4) Cross-validate with multiple regex engines',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['test-case-generation', 'performance-testing'],
        validation: 'test-completeness'
      },
      {
        name: 'documentation-packaging',
        prompt: 'Document and package: 1) Create detailed usage documentation, 2) Provide implementation examples in multiple languages, 3) Document limitations and caveats, 4) Include maintenance and update guidelines',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['documentation-tools', 'example-generation'],
        validation: 'documentation-completeness'
      }
    ],
    outputFormat: 'optimized-regex-package',
    qualityMetrics: ['pattern-accuracy', 'performance-efficiency', 'readability-score', 'test-coverage']
  },

  'data-validator': {
    name: 'Data Validation Specialist Agent',
    description: 'Data quality expert that creates comprehensive validation frameworks with automated monitoring and reporting',
    capabilities: ['validation-rule-design', 'data-quality-assessment', 'automated-monitoring', 'anomaly-detection', 'reporting-dashboard'],
    tools: ['validation-frameworks', 'quality-metrics', 'monitoring-tools', 'reporting-dashboards'],
    steps: [
      {
        name: 'validation-requirements',
        prompt: 'Define validation requirements: 1) Analyze data schema and business rules, 2) Identify validation types needed (format, range, consistency, business logic), 3) Specify acceptable error thresholds, 4) Define data quality KPIs',
        model: 'gpt-4',
        requiresInput: true,
        tools: ['schema-analysis', 'rule-extraction'],
        validation: 'requirement-accuracy'
      },
      {
        name: 'rule-development',
        prompt: 'Develop validation rules: 1) Create format and type validation rules, 2) Implement range and constraint checks, 3) Build cross-field validation logic, 4) Design custom business rule validations',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['rule-engine', 'logic-validation'],
        validation: 'rule-correctness'
      },
      {
        name: 'monitoring-implementation',
        prompt: 'Implement monitoring system: 1) Set up automated validation pipelines, 2) Create real-time alerting for validation failures, 3) Implement data quality dashboards, 4) Build trend analysis and anomaly detection',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['monitoring-setup', 'alerting-systems'],
        validation: 'monitoring-effectiveness'
      },
      {
        name: 'reporting-dashboard',
        prompt: 'Create reporting and analytics: 1) Develop comprehensive quality reports, 2) Build interactive dashboards for stakeholders, 3) Implement automated report generation, 4) Create data quality scorecards and trends',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['reporting-tools', 'dashboard-creation'],
        validation: 'reporting-completeness'
      },
      {
        name: 'continuous-improvement',
        prompt: 'Establish continuous improvement: 1) Monitor validation rule effectiveness, 2) Update rules based on new data patterns, 3) Implement feedback loops for rule refinement, 4) Develop predictive quality monitoring',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['improvement-tracking', 'predictive-monitoring'],
        validation: 'improvement-effectiveness'
      }
    ],
    outputFormat: 'validation-framework',
    qualityMetrics: ['validation-accuracy', 'false-positive-rate', 'monitoring-coverage', 'improvement-tracking']
  }
};

module.exports = workflowPresets;
