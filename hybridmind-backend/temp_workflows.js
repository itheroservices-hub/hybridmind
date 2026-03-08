/**
 * Advanced Agent Workflow Definitions
 * Each agent is a specialized AI system with domain expertise, tools, and sophisticated reasoning
 */

const workflowPresets = {
  // ðŸ§  STRATEGIC PLANNING & ANALYSIS AGENTS
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
        tools: ['risk-modeling', 'decision-tree-analysis'],
        validation: 'monte-carlo-validation'
      }
    ],
    outputFormat: 'strategic-plan',
    qualityMetrics: ['completeness', 'feasibility', 'risk-coverage', 'resource-efficiency']
  },

  'constraint-solver': {
    name: 'Constraint Optimization Agent',
    description: 'Advanced mathematical optimization specialist for complex constraint satisfaction problems',
    capabilities: ['mathematical-modeling', 'constraint-programming', 'heuristic-optimization', 'multi-objective-optimization'],
    tools: ['linear-programming', 'integer-programming', 'genetic-algorithms', 'simulated-annealing'],
    steps: [
      {
        name: 'problem-formulation',
        prompt: 'Formulate the optimization problem: 1) Identify decision variables and their domains, 2) Define objective functions (single/multi-objective), 3) Specify all constraints (hard/soft), 4) Determine optimization direction (minimize/maximize)',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['mathematical-modeling', 'constraint-analysis'],
        validation: 'model-consistency-check'
      },
      {
        name: 'algorithm-selection',
        prompt: 'Select optimal solution approach: 1) Analyze problem structure (linear/nonlinear, discrete/continuous), 2) Evaluate algorithm suitability (LP/IP for exact, heuristics for complex), 3) Consider computational complexity, 4) Plan hybrid approaches if needed',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['algorithm-analysis', 'complexity-assessment'],
        validation: 'algorithm-validation'
      },
      {
        name: 'solution-implementation',
        prompt: 'Implement and solve: 1) Code the mathematical model, 2) Implement chosen algorithm(s), 3) Handle constraint violations gracefully, 4) Generate multiple solution alternatives, 5) Provide sensitivity analysis',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['code-generation', 'solver-integration'],
        validation: 'solution-verification'
      },
      {
        name: 'optimization-analysis',
        prompt: 'Analyze solution quality: 1) Verify constraint satisfaction, 2) Assess objective function values, 3) Perform sensitivity analysis on parameters, 4) Identify binding constraints, 5) Suggest improvements',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['sensitivity-analysis', 'trade-off-analysis'],
        validation: 'optimality-proof'
      }
    ],
    outputFormat: 'optimization-solution',
    qualityMetrics: ['optimality-gap', 'constraint-satisfaction', 'solution-diversity', 'computational-efficiency']
  },

  'research-synthesizer': {
    name: 'Research Synthesis Agent',
    description: 'Expert meta-analyst that synthesizes findings from multiple research sources into coherent insights',
    capabilities: ['systematic-review', 'meta-analysis', 'evidence-synthesis', 'knowledge-mapping', 'gap-identification'],
    tools: ['literature-search', 'citation-analysis', 'evidence-grading', 'thematic-analysis'],
    steps: [
      {
        name: 'systematic-search',
        prompt: 'Conduct systematic literature search: 1) Develop comprehensive search strategy with Boolean operators, 2) Search multiple databases (PubMed, IEEE, ACM, Google Scholar), 3) Apply inclusion/exclusion criteria, 4) Remove duplicates and assess relevance',
        model: 'gpt-4-turbo-preview',
        requiresInput: true,
        tools: ['database-search', 'citation-management'],
        validation: 'search-completeness'
      },
      {
        name: 'quality-assessment',
        prompt: 'Assess research quality: 1) Evaluate methodological rigor using appropriate frameworks, 2) Assess bias and confounding factors, 3) Grade evidence strength (GRADE, Cochrane), 4) Identify high-quality studies vs. lower-quality evidence',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['quality-assessment', 'bias-detection'],
        validation: 'inter-rater-reliability'
      },
      {
        name: 'data-extraction',
        prompt: 'Extract and standardize data: 1) Develop data extraction template, 2) Extract key findings, methodologies, and results, 3) Standardize measurements and outcomes, 4) Handle missing data appropriately',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['data-extraction', 'standardization'],
        validation: 'extraction-accuracy'
      },
      {
        name: 'synthesis-analysis',
        prompt: 'Synthesize findings: 1) Identify common themes and patterns, 2) Perform meta-analysis where appropriate (effect sizes, confidence intervals), 3) Explore heterogeneity and moderators, 4) Create evidence maps and knowledge graphs',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['meta-analysis', 'thematic-synthesis'],
        validation: 'synthesis-validity'
      },
      {
        name: 'insight-generation',
        prompt: 'Generate actionable insights: 1) Identify knowledge gaps and research needs, 2) Develop theoretical frameworks, 3) Create decision-support tools, 4) Provide implementation recommendations with evidence strength',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['gap-analysis', 'recommendation-engine'],
        validation: 'insight-validation'
      }
    ],
    outputFormat: 'research-synthesis',
    qualityMetrics: ['evidence-strength', 'synthesis-completeness', 'gap-identification', 'practical-applicability']
  },

  'critical-evaluator': {
    name: 'Critical Evaluation Agent',
    description: 'Skeptical analyst that rigorously challenges assumptions and identifies flaws in reasoning',
    capabilities: ['assumption-testing', 'logical-fallacy-detection', 'bias-identification', 'counterfactual-analysis', 'robustness-testing'],
    tools: ['logical-analysis', 'argument-mapping', 'cognitive-bias-detection', 'sensitivity-analysis'],
    steps: [
      {
        name: 'assumption-mapping',
        prompt: 'Map all assumptions: 1) Identify explicit and implicit assumptions, 2) Categorize assumptions (factual, value-based, methodological), 3) Assess assumption validity, 4) Create assumption dependency trees',
        model: 'gpt-4-turbo-preview',
        requiresInput: true,
        tools: ['assumption-extraction', 'dependency-mapping'],
        validation: 'assumption-completeness'
      },
      {
        name: 'logic-analysis',
        prompt: 'Analyze logical structure: 1) Map argument structure and reasoning chains, 2) Identify logical fallacies (ad hominem, false dichotomy, etc.), 3) Test syllogistic validity, 4) Assess probabilistic reasoning',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['logic-validation', 'fallacy-detection'],
        validation: 'logical-consistency'
      },
      {
        name: 'bias-assessment',
        prompt: 'Assess cognitive biases: 1) Identify confirmation bias and motivated reasoning, 2) Detect anchoring and availability heuristics, 3) Assess overconfidence and hindsight bias, 4) Evaluate groupthink and social proof effects',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['bias-detection', 'cognitive-analysis'],
        validation: 'bias-comprehensiveness'
      },
      {
        name: 'robustness-testing',
        prompt: 'Test robustness: 1) Generate counterfactual scenarios, 2) Stress-test with extreme assumptions, 3) Perform sensitivity analysis, 4) Identify boundary conditions and edge cases',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['scenario-generation', 'stress-testing'],
        validation: 'robustness-coverage'
      },
      {
        name: 'alternative-generation',
        prompt: 'Generate alternatives: 1) Propose alternative explanations, 2) Develop competing hypotheses, 3) Suggest different methodological approaches, 4) Create decision trees with multiple pathways',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['alternative-hypothesis', 'decision-tree'],
        validation: 'alternative-comprehensiveness'
      }
    ],
    outputFormat: 'critical-analysis',
    qualityMetrics: ['assumption-coverage', 'logical-rigor', 'bias-awareness', 'alternative-consideration']
  },

  // ðŸ’¼ BUSINESS, OPERATIONS & PRODUCTIVITY AGENTS
  'client-intake': {
    name: 'Client Intake Specialist Agent',
    description: 'Professional client relationship manager that conducts thorough discovery and creates detailed project proposals',
    capabilities: ['requirement-elicitation', 'stakeholder-mapping', 'scope-definition', 'proposal-generation', 'relationship-building'],
    tools: ['interview-scripting', 'requirement-prioritization', 'scope-management', 'proposal-templates'],
    steps: [
      {
        name: 'discovery-preparation',
        prompt: 'Prepare for client discovery: 1) Research client industry and company, 2) Prepare tailored interview questions, 3) Set meeting agenda and objectives, 4) Prepare stakeholder mapping template',
        model: 'gpt-4',
        requiresInput: true,
        tools: ['company-research', 'stakeholder-analysis'],
        validation: 'preparation-completeness'
      },
      {
        name: 'requirement-elicitation',
        prompt: 'Conduct thorough requirement gathering: 1) Use multiple elicitation techniques (interviews, workshops, observation), 2) Identify functional and non-functional requirements, 3) Uncover hidden requirements and constraints, 4) Validate understanding through feedback loops',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['interview-facilitation', 'requirement-documentation'],
        validation: 'requirement-accuracy'
      },
      {
        name: 'stakeholder-analysis',
        prompt: 'Analyze stakeholder landscape: 1) Map all stakeholders and their influence/interest levels, 2) Identify decision-makers and influencers, 3) Assess stakeholder needs and potential conflicts, 4) Develop communication and engagement strategies',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['stakeholder-mapping', 'influence-analysis'],
        validation: 'stakeholder-completeness'
      },
      {
        name: 'scope-definition',
        prompt: 'Define project scope: 1) Create work breakdown structure (WBS), 2) Define in-scope vs. out-of-scope items, 3) Identify assumptions and dependencies, 4) Develop acceptance criteria and success metrics',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['scope-management', 'wbs-creation'],
        validation: 'scope-clarity'
      },
      {
        name: 'proposal-development',
        prompt: 'Create comprehensive proposal: 1) Develop solution architecture and approach, 2) Create detailed timeline and milestones, 3) Provide cost breakdown and ROI analysis, 4) Include risk assessment and mitigation plans',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['proposal-generation', 'cost-analysis'],
        validation: 'proposal-completeness'
      }
    ],
    outputFormat: 'client-proposal',
    qualityMetrics: ['requirement-completeness', 'stakeholder-satisfaction', 'scope-clarity', 'proposal-quality']
  },

  'project-manager': {
    name: 'Project Management Agent',
    description: 'Certified project manager with advanced tracking, risk management, and delivery optimization capabilities',
    capabilities: ['project-planning', 'risk-management', 'resource-allocation', 'progress-tracking', 'stakeholder-communication'],
    tools: ['gantt-charting', 'risk-register', 'burndown-charts', 'resource-leveling', 'earned-value-analysis'],
    steps: [
      {
        name: 'project-setup',
        prompt: 'Establish project foundation: 1) Create detailed project charter, 2) Develop comprehensive project plan, 3) Set up communication protocols, 4) Establish monitoring and control mechanisms',
        model: 'gpt-4',
        requiresInput: true,
        tools: ['project-charter', 'communication-plan'],
        validation: 'setup-completeness'
      },
      {
        name: 'risk-assessment',
        prompt: 'Comprehensive risk management: 1) Identify all project risks (technical, schedule, budget, scope), 2) Assess probability and impact of each risk, 3) Develop risk response strategies, 4) Create risk monitoring plan',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['risk-analysis', 'probability-assessment'],
        validation: 'risk-coverage'
      },
      {
        name: 'resource-optimization',
        prompt: 'Optimize resource allocation: 1) Analyze resource requirements and availability, 2) Create resource loading charts, 3) Identify resource conflicts and bottlenecks, 4) Develop resource leveling strategies',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['resource-planning', 'conflict-resolution'],
        validation: 'resource-efficiency'
      },
      {
        name: 'progress-monitoring',
        prompt: 'Monitor project execution: 1) Track actual vs. planned progress, 2) Calculate earned value metrics, 3) Identify variances and trends, 4) Forecast project completion and costs',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['progress-tracking', 'variance-analysis'],
        validation: 'monitoring-accuracy'
      },
      {
        name: 'stakeholder-management',
        prompt: 'Manage stakeholder expectations: 1) Regular status reporting and updates, 2) Issue resolution and escalation, 3) Change request management, 4) Lessons learned documentation',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['status-reporting', 'change-management'],
        validation: 'stakeholder-satisfaction'
      }
    ],
    outputFormat: 'project-dashboard',
    qualityMetrics: ['on-time-delivery', 'budget-adherence', 'scope-control', 'stakeholder-satisfaction']
  },

  // ðŸ§‘â€ðŸ’» DEVELOPER & ENGINEERING AGENTS
  'code-generator': {
    name: 'Code Generation Agent',
    description: 'Senior software architect that generates production-ready code with comprehensive testing and documentation',
    capabilities: ['architecture-design', 'code-generation', 'testing-integration', 'documentation', 'security-review'],
    tools: ['code-templates', 'testing-frameworks', 'documentation-generators', 'security-scanners'],
    steps: [
      {
        name: 'architecture-design',
        prompt: 'Design system architecture: 1) Analyze requirements and constraints, 2) Design component architecture and interfaces, 3) Create data models and schemas, 4) Plan error handling and logging strategies',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['architecture-modeling', 'design-patterns'],
        validation: 'architecture-review'
      },
      {
        name: 'code-implementation',
        prompt: 'Generate production code: 1) Implement core functionality with clean architecture, 2) Add comprehensive error handling, 3) Implement logging and monitoring, 4) Follow language-specific best practices and idioms',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['code-generation', 'best-practices'],
        validation: 'code-quality'
      },
      {
        name: 'testing-integration',
        prompt: 'Create comprehensive tests: 1) Generate unit tests for all functions, 2) Create integration tests for component interactions, 3) Add edge case and error condition tests, 4) Implement property-based testing where applicable',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['test-generation', 'test-automation'],
        validation: 'test-coverage'
      },
      {
        name: 'security-hardening',
        prompt: 'Implement security measures: 1) Add input validation and sanitization, 2) Implement authentication and authorization, 3) Add encryption for sensitive data, 4) Conduct security vulnerability assessment',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['security-analysis', 'vulnerability-scanning'],
        validation: 'security-audit'
      },
      {
        name: 'documentation-packaging',
        prompt: 'Create documentation and packaging: 1) Generate API documentation and usage examples, 2) Create deployment and configuration guides, 3) Package code with proper dependency management, 4) Create CI/CD pipeline configuration',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['documentation-generation', 'packaging-tools'],
        validation: 'documentation-completeness'
      }
    ],
    outputFormat: 'production-codebase',
    qualityMetrics: ['code-quality', 'test-coverage', 'security-score', 'documentation-completeness']
  },

  'bug-hunter': {
    name: 'Bug Detection & Resolution Agent',
    description: 'Expert debugger with systematic root cause analysis, reproduction strategies, and comprehensive fix implementation',
    capabilities: ['bug-reproduction', 'root-cause-analysis', 'debugging-methodology', 'fix-implementation', 'regression-testing'],
    tools: ['debugger-integration', 'logging-analysis', 'code-profiling', 'test-case-generation'],
    steps: [
      {
        name: 'bug-characterization',
        prompt: 'Characterize the bug thoroughly: 1) Reproduce the issue with minimal test case, 2) Document exact steps to reproduce, 3) Identify environmental factors and dependencies, 4) Categorize bug type (logic, performance, concurrency, etc.)',
        model: 'gpt-4',
        requiresInput: true,
        tools: ['bug-reproduction', 'environment-analysis'],
        validation: 'reproduction-accuracy'
      },
      {
        name: 'diagnostic-analysis',
        prompt: 'Perform systematic diagnosis: 1) Analyze stack traces and error messages, 2) Review relevant code paths and logic, 3) Check data flow and state transitions, 4) Use debugging tools (breakpoints, logging, profiling)',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['code-analysis', 'diagnostic-tools'],
        validation: 'diagnostic-accuracy'
      },
      {
        name: 'root-cause-identification',
        prompt: 'Identify root cause: 1) Trace bug to specific code location and logic error, 2) Identify contributing factors and preconditions, 3) Assess impact scope and severity, 4) Determine if bug is symptom of larger architectural issue',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['root-cause-analysis', 'impact-assessment'],
        validation: 'cause-accuracy'
      },
      {
        name: 'fix-development',
        prompt: 'Develop comprehensive fix: 1) Design fix that addresses root cause, 2) Consider edge cases and potential side effects, 3) Implement fix with proper error handling, 4) Add logging for future debugging',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['fix-implementation', 'code-review'],
        validation: 'fix-effectiveness'
      },
      {
        name: 'validation-testing',
        prompt: 'Validate fix thoroughly: 1) Test original reproduction case, 2) Test edge cases and boundary conditions, 3) Run regression tests to ensure no new bugs, 4) Performance test to ensure no degradation',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['test-validation', 'regression-testing'],
        validation: 'fix-validation'
      }
    ],
    outputFormat: 'bug-resolution-report',
    qualityMetrics: ['reproduction-success', 'root-cause-accuracy', 'fix-effectiveness', 'regression-safety']
  },

  // ðŸ” DATA, AI & ANALYTICS AGENTS
  'data-cleaning': {
    name: 'Data Cleaning & Preparation Agent',
    description: 'Data engineering specialist that transforms raw data into analysis-ready datasets with comprehensive quality assurance',
    capabilities: ['data-profiling', 'quality-assessment', 'transformation-pipelines', 'validation-frameworks', 'documentation'],
    tools: ['data-profiling-tools', 'etl-frameworks', 'validation-rules', 'quality-metrics'],
    steps: [
      {
        name: 'data-profiling',
        prompt: 'Profile data comprehensively: 1) Analyze data structure and schema, 2) Assess data types and distributions, 3) Identify missing values and outliers, 4) Evaluate data quality metrics (completeness, accuracy, consistency)',
        model: 'gpt-4',
        requiresInput: true,
        tools: ['data-profiling', 'quality-assessment'],
        validation: 'profiling-accuracy'
      },
      {
        name: 'quality-assessment',
        prompt: 'Assess data quality issues: 1) Identify data anomalies and inconsistencies, 2) Detect duplicate records and conflicting information, 3) Evaluate referential integrity, 4) Assess timeliness and relevance',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['anomaly-detection', 'consistency-checking'],
        validation: 'quality-accuracy'
      },
      {
        name: 'transformation-design',
        prompt: 'Design cleaning transformations: 1) Create data standardization rules, 2) Design missing value imputation strategies, 3) Plan outlier treatment methods, 4) Develop deduplication algorithms',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['transformation-design', 'algorithm-selection'],
        validation: 'transformation-validity'
      },
      {
        name: 'pipeline-implementation',
        prompt: 'Implement cleaning pipeline: 1) Build automated ETL/ELT processes, 2) Implement validation rules and constraints, 3) Create error handling and logging, 4) Add data quality monitoring',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['pipeline-development', 'automation-tools'],
        validation: 'pipeline-reliability'
      },
      {
        name: 'validation-documentation',
        prompt: 'Validate and document: 1) Test pipeline on sample and full datasets, 2) Generate data quality reports, 3) Create data dictionary and lineage documentation, 4) Establish ongoing monitoring procedures',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['validation-testing', 'documentation-tools'],
        validation: 'validation-completeness'
      }
    ],
    outputFormat: 'clean-dataset',
    qualityMetrics: ['data-completeness', 'accuracy-improvement', 'consistency-score', 'processing-efficiency']
  },

  'model-training': {
    name: 'Machine Learning Training Agent',
    description: 'ML engineering specialist that orchestrates end-to-end model development from data to deployment',
    capabilities: ['experiment-design', 'model-selection', 'hyperparameter-tuning', 'validation-strategies', 'deployment-preparation'],
    tools: ['ml-frameworks', 'experiment-tracking', 'hyperparameter-optimization', 'model-validation'],
    steps: [
      {
        name: 'experiment-planning',
        prompt: 'Design ML experiment: 1) Define problem type and success metrics, 2) Select appropriate model architectures, 3) Design cross-validation strategy, 4) Plan hyperparameter search space',
        model: 'claude-3-opus',
        requiresInput: true,
        tools: ['experiment-design', 'model-selection'],
        validation: 'experimental-design'
      },
      {
        name: 'data-preparation',
        prompt: 'Prepare training data: 1) Implement feature engineering pipelines, 2) Handle class imbalance and data augmentation, 3) Create train/validation/test splits, 4) Implement data loading and preprocessing',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['feature-engineering', 'data-splitting'],
        validation: 'data-quality'
      },
      {
        name: 'model-development',
        prompt: 'Develop and train models: 1) Implement multiple model architectures, 2) Execute hyperparameter optimization, 3) Monitor training convergence and stability, 4) Implement early stopping and regularization',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['model-training', 'hyperparameter-tuning'],
        validation: 'training-stability'
      },
      {
        name: 'model-evaluation',
        prompt: 'Comprehensive evaluation: 1) Calculate all relevant performance metrics, 2) Analyze confusion matrices and error patterns, 3) Perform cross-validation and statistical testing, 4) Assess model robustness and generalization',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['model-evaluation', 'statistical-testing'],
        validation: 'evaluation-comprehensiveness'
      },
      {
        name: 'deployment-preparation',
        prompt: 'Prepare for deployment: 1) Optimize model for inference speed, 2) Implement model serialization and versioning, 3) Create monitoring and logging infrastructure, 4) Develop model serving and API endpoints',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['model-optimization', 'deployment-tools'],
        validation: 'deployment-readiness'
      }
    ],
    outputFormat: 'trained-model-package',
    qualityMetrics: ['model-accuracy', 'generalization-performance', 'inference-efficiency', 'deployment-readiness']
  },

  // ðŸŒ WEB, CONTENT & MEDIA AGENTS
  'seo-agent': {
    name: 'SEO Optimization Agent',
    description: 'Digital marketing specialist that optimizes content for search engines with data-driven strategies',
    capabilities: ['keyword-research', 'content-optimization', 'technical-seo', 'performance-monitoring', 'competitor-analysis'],
    tools: ['keyword-tools', 'seo-analyzers', 'rank-tracking', 'site-audits'],
    steps: [
      {
        name: 'keyword-strategy',
        prompt: 'Develop keyword strategy: 1) Research target keywords and search intent, 2) Analyze competition and difficulty, 3) Identify long-tail and semantic keywords, 4) Map keywords to content pillars and clusters',
        model: 'gpt-4',
        requiresInput: true,
        tools: ['keyword-research', 'competition-analysis'],
        validation: 'keyword-relevance'
      },
      {
        name: 'content-optimization',
        prompt: 'Optimize content structure: 1) Implement proper heading hierarchy (H1-H6), 2) Optimize title tags and meta descriptions, 3) Improve content readability and engagement, 4) Add internal and external linking strategies',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['content-analysis', 'readability-tools'],
        validation: 'optimization-effectiveness'
      },
      {
        name: 'technical-seo',
        prompt: 'Implement technical improvements: 1) Optimize site speed and performance, 2) Fix crawlability and indexability issues, 3) Implement structured data and schema markup, 4) Ensure mobile-friendliness and responsive design',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['technical-audit', 'performance-tools'],
        validation: 'technical-compliance'
      },
      {
        name: 'link-building-strategy',
        prompt: 'Develop link acquisition strategy: 1) Identify link-building opportunities, 2) Create link-worthy content assets, 3) Build relationships with relevant sites, 4) Monitor backlink profile and anchor text distribution',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['link-analysis', 'outreach-tools'],
        validation: 'link-quality'
      },
      {
        name: 'performance-monitoring',
        prompt: 'Monitor and analyze performance: 1) Track keyword rankings and organic traffic, 2) Monitor conversion rates and engagement metrics, 3) Analyze competitor SEO strategies, 4) Generate monthly SEO reports and recommendations',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['analytics-tools', 'reporting-dashboard'],
        validation: 'performance-tracking'
      }
    ],
    outputFormat: 'seo-strategy-report',
    qualityMetrics: ['keyword-ranking', 'organic-traffic-growth', 'conversion-improvement', 'technical-score']
  },

  // ðŸ› ï¸ TOOLS, AUTOMATION & INTEGRATION AGENTS
  'email-automation': {
    name: 'Email Automation Agent',
    description: 'Email marketing specialist that creates intelligent automation workflows with personalization and analytics',
    capabilities: ['campaign-design', 'automation-workflows', 'personalization-engine', 'analytics-integration', 'compliance-management'],
    tools: ['email-templates', 'automation-platforms', 'segmentation-tools', 'analytics-dashboards'],
    steps: [
      {
        name: 'audience-segmentation',
        prompt: 'Develop audience segmentation: 1) Analyze subscriber data and behavior patterns, 2) Create dynamic segments based on engagement and demographics, 3) Implement RFM (Recency, Frequency, Monetary) analysis, 4) Design trigger-based segmentation rules',
        model: 'gpt-4',
        requiresInput: true,
        tools: ['data-segmentation', 'behavior-analysis'],
        validation: 'segmentation-accuracy'
      },
      {
        name: 'automation-design',
        prompt: 'Design automation workflows: 1) Map customer journey and touchpoints, 2) Create trigger-based email sequences, 3) Implement A/B testing frameworks, 4) Design re-engagement and win-back campaigns',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['workflow-design', 'journey-mapping'],
        validation: 'automation-logic'
      },
      {
        name: 'content-personalization',
        prompt: 'Implement personalization: 1) Create dynamic content blocks, 2) Implement product recommendations, 3) Add behavioral triggers and preferences, 4) Develop subject line optimization',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['personalization-engine', 'dynamic-content'],
        validation: 'personalization-effectiveness'
      },
      {
        name: 'compliance-integration',
        prompt: 'Ensure compliance and deliverability: 1) Implement GDPR and CAN-SPAM compliance, 2) Set up preference centers and unsubscribe flows, 3) Optimize for inbox placement and deliverability, 4) Monitor spam complaints and engagement rates',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['compliance-tools', 'deliverability-monitoring'],
        validation: 'compliance-adherence'
      },
      {
        name: 'performance-optimization',
        prompt: 'Optimize and analyze performance: 1) Set up comprehensive analytics tracking, 2) Implement conversion attribution, 3) Create automated optimization rules, 4) Generate performance reports and insights',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['analytics-integration', 'optimization-tools'],
        validation: 'performance-improvement'
      }
    ],
    outputFormat: 'email-automation-system',
    qualityMetrics: ['open-rates', 'click-rates', 'conversion-rates', 'deliverability-score']
  },

  // ðŸ§© DOMAIN-SPECIFIC EXPERT AGENTS
  'legal-summary': {
    name: 'Legal Analysis Agent',
    description: 'Legal expert that analyzes contracts and documents with risk assessment and compliance expertise',
    capabilities: ['contract-analysis', 'risk-assessment', 'compliance-review', 'legal-research', 'obligation-mapping'],
    tools: ['legal-databases', 'contract-analysis-tools', 'risk-assessment-frameworks', 'compliance-checkers'],
    steps: [
      {
        name: 'document-analysis',
        prompt: 'Analyze legal document structure: 1) Identify document type and jurisdiction, 2) Extract key provisions and clauses, 3) Map rights and obligations of all parties, 4) Identify ambiguous or problematic language',
        model: 'gpt-4-turbo-preview',
        requiresInput: true,
        tools: ['document-parsing', 'legal-classification'],
        validation: 'analysis-accuracy'
      },
      {
        name: 'risk-assessment',
        prompt: 'Assess legal risks: 1) Identify high-risk clauses and provisions, 2) Evaluate liability exposure and indemnification, 3) Assess compliance with applicable laws, 4) Identify negotiation leverage points',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['risk-modeling', 'liability-analysis'],
        validation: 'risk-accuracy'
      },
      {
        name: 'compliance-review',
        prompt: 'Review regulatory compliance: 1) Check against relevant regulations and standards, 2) Identify compliance gaps and requirements, 3) Assess data protection and privacy implications, 4) Review governing law and dispute resolution clauses',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['compliance-databases', 'regulatory-analysis'],
        validation: 'compliance-completeness'
      },
      {
        name: 'obligation-mapping',
        prompt: 'Map all obligations and commitments: 1) Create timeline of key dates and deadlines, 2) Identify performance obligations and milestones, 3) Map payment terms and financial commitments, 4) Identify termination rights and conditions',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['obligation-tracking', 'timeline-analysis'],
        validation: 'obligation-completeness'
      },
      {
        name: 'recommendation-development',
        prompt: 'Develop actionable recommendations: 1) Prioritize issues by risk and impact, 2) Suggest specific contract modifications, 3) Provide negotiation strategies, 4) Create compliance action plan',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['recommendation-engine', 'negotiation-analysis'],
        validation: 'recommendation-practicality'
      }
    ],
    outputFormat: 'legal-analysis-report',
    qualityMetrics: ['risk-identification', 'compliance-accuracy', 'obligation-clarity', 'recommendation-actionability']
  },

  // ðŸŽ® SIMULATION, WORLD MODELING & CREATIVE AGENTS
  'digital-twin': {
    name: 'Digital Twin Agent',
    description: 'Systems engineering specialist that creates accurate digital replicas of physical systems with real-time synchronization',
    capabilities: ['system-modeling', 'sensor-integration', 'real-time-synchronization', 'predictive-analytics', 'scenario-simulation'],
    tools: ['system-modeling-tools', 'iot-platforms', 'simulation-engines', 'predictive-models'],
    steps: [
      {
        name: 'system-analysis',
        prompt: 'Analyze physical system: 1) Document system architecture and components, 2) Identify key performance indicators and sensors, 3) Map data flows and control systems, 4) Assess system boundaries and interfaces',
        model: 'gpt-4',
        requiresInput: true,
        tools: ['system-analysis', 'architecture-mapping'],
        validation: 'analysis-completeness'
      },
      {
        name: 'model-development',
        prompt: 'Develop digital twin model: 1) Create mathematical and physical models, 2) Implement sensor data integration, 3) Build real-time data processing pipelines, 4) Develop visualization and monitoring interfaces',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['modeling-tools', 'data-integration'],
        validation: 'model-accuracy'
      },
      {
        name: 'synchronization-implementation',
        prompt: 'Implement real-time synchronization: 1) Set up data acquisition and transmission, 2) Implement state estimation algorithms, 3) Create feedback control systems, 4) Develop anomaly detection and alerting',
        model: 'gpt-4-turbo-preview',
        requiresInput: false,
        tools: ['real-time-systems', 'control-systems'],
        validation: 'synchronization-accuracy'
      },
      {
        name: 'predictive-capabilities',
        prompt: 'Add predictive analytics: 1) Implement predictive maintenance models, 2) Develop performance forecasting, 3) Create what-if scenario analysis, 4) Build optimization recommendation engines',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['predictive-modeling', 'optimization-algorithms'],
        validation: 'prediction-accuracy'
      },
      {
        name: 'deployment-monitoring',
        prompt: 'Deploy and monitor system: 1) Implement production deployment, 2) Set up monitoring and alerting, 3) Create user interfaces and dashboards, 4) Establish maintenance and update procedures',
        model: 'gpt-4',
        requiresInput: false,
        tools: ['deployment-tools', 'monitoring-systems'],
        validation: 'deployment-success'
      }
    ],
    outputFormat: 'digital-twin-system',
    qualityMetrics: ['model-fidelity', 'synchronization-accuracy', 'prediction-accuracy', 'system-reliability']
  },

  // ðŸ§© META-AGENTS (AGENTS THAT MANAGE OTHER AGENTS)
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
    name: 'Quality Assurance Meta-Agent',
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

  // ðŸ§© ULTRA-SPECIALIZED MICRO-AGENTS
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
        tools: ['monitoring-tools', 'alerting-systems'],
        validation: 'monitoring-effectiveness'
      },
      {
        name: 'quality-reporting',
        prompt: 'Create quality reporting: 1) Generate comprehensive quality reports, 2) Implement data lineage tracking, 3) Create remediation workflows, 4) Build continuous improvement processes',
        model: 'claude-3-opus',
        requiresInput: false,
        tools: ['reporting-tools', 'improvement-tracking'],
        validation: 'reporting-accuracy'
      }
    ],
    outputFormat: 'validation-framework',
    qualityMetrics: ['validation-accuracy', 'false-positive-rate', 'monitoring-coverage', 'improvement-tracking']
  }
};

module.exports = workflowPresets;

module.exports = workflowPresets;

