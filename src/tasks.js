// Task inventory for the DPM transition worksheet.
//
// Every task is a paraphrase of a real bullet from one of eight Design Program
// Manager job postings read 22 to 23 August 2026. Sources and verification
// status are in SOURCES.md. Paraphrased, not quoted, so wording is ours.
//
// `post` is the position taken in "Design roles are shifting. So should the DPM
// role." It is shown to the reader only AFTER they make their own call, so the
// tool collects an honest answer first and argues second.

export const CALLS = [
  {
    id: 'shift',
    label: 'Shift',
    verb: 'Goes to a TPM or another program function',
    hint: 'Real work that has to happen, but someone outside design can hold it. This is the call most people skip.',
  },
  {
    id: 'automate',
    label: 'Automate',
    verb: 'A tool does this reliably today',
    hint: 'Not could in principle. Not with the right prompt. You have watched it happen end to end without correction.',
  },
  {
    id: 'retire',
    label: 'Retire',
    verb: 'Stop producing it',
    hint: 'The workflow no longer needs the output. Start here. Retire is the only call that costs nothing to act on.',
  },
  {
    id: 'evolve',
    label: 'Evolve',
    verb: 'Stays, but changes shape',
    hint: 'The work survives and the nature of it changes, usually from administration toward a decision someone owns.',
  },
  {
    id: 'elevate',
    label: 'Elevate',
    verb: 'Becomes more valuable, invest here',
    hint: 'Needs context, judgment, or standing in the room. This is what the role is for once coordination is not the center of it.',
  },
];

export const CLUSTERS = [
  {
    id: 'coordination',
    name: 'Program and roadmap coordination',
    post: 'shift',
    note: 'Present in five of eight postings. The historic centre of the role.',
    tasks: [
      ['Translate complex roadmaps into executable plans with milestones and dependencies', 'Nothing'],
      ['Drive large initiatives with multiple stakeholders, competing deadlines, many moving parts', 'Meta'],
      ['Drive roadmaps and intake so design and engineering capacity stay aligned', 'Discord'],
      ['Build roadmaps, milestones, risks, dependencies, decision logs and reporting mechanisms', 'Cisco'],
    ],
  },
  {
    id: 'rituals',
    name: 'Ritual and meeting facilitation',
    post: 'shift',
    note: 'Three of eight. Recurring ceremonies rarely need a dedicated owner inside design.',
    tasks: [
      ['Facilitate design sprints, critiques and reviews', 'Figma'],
      ['Own and facilitate meetings, establish clear next steps and owners', 'Meta'],
      ['Support leadership in establishing operating rhythms for planning and resourcing', 'Discord'],
    ],
  },
  {
    id: 'liaison',
    name: 'Cross-functional liaison',
    post: 'evolve',
    note: 'Three of eight. The direction of travel matters here. Stop relaying, start translating.',
    tasks: [
      ['Act as primary liaison between design, engineering, industrial design, product and marketing', 'Nothing'],
      ['Serve as connector, facilitating conversations that surface dependencies', 'Discord'],
      ['Act as operational connector across design, marketing, product and engineering', 'WorkOS'],
    ],
  },
  {
    id: 'status',
    name: 'Reporting and status artifacts',
    post: 'retire',
    note: 'Four of eight. The cluster most likely to be producing documents nobody opens.',
    tasks: [
      ['Communicate progress and dependencies, provide updates to executives', 'Figma'],
      ['Define and measure impact of programs qualitatively and quantitatively', 'Meta'],
      ['Track adoption, risks and impact, surface decisions for leadership visibility', 'Cisco'],
    ],
  },
  {
    id: 'risk',
    name: 'Risk and blocker escalation',
    post: 'shift',
    note: 'Three of eight, and every one of them words it as pre-emption rather than reporting.',
    tasks: [
      ['Proactively assess risk, raise flags, resolve issues before they become problems', 'Meta'],
      ['Identify potential blockers before they impact timelines', 'Nothing'],
      ['Surface blockers early and keep stakeholders informed at the right level of detail', 'Discord'],
    ],
  },
  {
    id: 'docs',
    name: 'Documentation and source of truth',
    post: 'automate',
    note: 'Three of eight. Capture is now cheap. Deciding what is worth capturing is not.',
    tasks: [
      ['Maintain the source of truth with briefs and design specs', 'Nothing'],
      ['Document every tool, playbook and transformation pattern you build', 'Stripe'],
      ['Establish project briefs, kickoff protocols and internal review cycles', 'WorkOS'],
    ],
  },
  {
    id: 'tooling',
    name: 'Tooling and file administration',
    post: 'automate',
    note: 'Two of eight, and both concentrated at the junior end. Note where this sits in your org.',
    tasks: [
      ['Define and maintain a file organization system across Figma and Drive', 'WorkOS'],
      ['Oversee task and documentation systems in Linear, Notion, Quip and Docs', 'WorkOS'],
      ['Optimize internal tools', 'Nothing'],
    ],
  },
  {
    id: 'resourcing',
    name: 'Resourcing and allocation',
    post: 'elevate',
    note: 'Two of eight. Tracking capacity is admin. Deciding where capacity goes is not.',
    tasks: [
      ['Manage team bandwidth and resource allocation', 'Nothing'],
      ['Keep design and engineering capacity aligned with incoming requests', 'Discord'],
    ],
  },
  {
    id: 'intake',
    name: 'Intake and governance',
    post: 'shift',
    note: 'Two of eight. Upstream of everything else, and the first thing to go unowned.',
    tasks: [
      ['Own the intake and prioritization process as a named path for partners', 'Discord'],
      ['Establish governance including intake, prioritization and adoption tracking', 'Cisco'],
    ],
  },
  {
    id: 'vendor',
    name: 'Vendor, budget and procurement',
    post: 'evolve',
    note: 'Three of eight, and almost always missing from how people describe the role from memory.',
    tasks: [
      ['Source and manage operational budgets, vendor relationships and contracts', 'Meta'],
      ['Source and evaluate vendors, interface with legal, security and procurement', 'Stripe'],
      ['Manage partnerships with external research platforms as primary point of contact', 'Discord'],
    ],
  },
  {
    id: 'quality',
    name: 'Quality and craft stewardship',
    post: 'elevate',
    note: 'The judgment duty. Hardest to move, easiest to leave off the list.',
    tasks: [
      ['Protect quality by tracking design decisions against technical feasibility and scope', 'Nothing'],
      ['Establish quality standards for self-service work to ensure consistency', 'Discord'],
    ],
  },
  {
    id: 'workflow',
    name: 'Workflow and process improvement',
    post: 'elevate',
    note: 'Three of eight. Finding the friction and redesigning around it.',
    tasks: [
      ['Identify and document the highest-leverage workflow transformations in the day to day', 'Stripe'],
      ['Identify and implement improvements to how the team plans, shares knowledge and operates', 'Discord'],
      ['Continuously refine workflows to increase efficiency and improve the stakeholder experience', 'WorkOS'],
    ],
  },
  {
    id: 'enablement',
    name: 'Capability building and AI enablement',
    post: 'elevate',
    note: 'The new cluster. Four of eight postings are substantially this.',
    tasks: [
      ['Build custom tools, agents, automations and skills tailored to team workflows', 'Stripe'],
      ['Enable and uplevel the team to build and iterate on their own tools over time', 'Stripe'],
      ['Own AI methodology, education, governance and cross-portfolio readiness', 'Cisco'],
      ['Define the playbook for how DPMs operate alongside TPMs and other partners', 'Figma'],
    ],
  },
];

// Flat, addressable task list. IDs are stable: cluster id + index.
export const TASKS = CLUSTERS.flatMap((c) =>
  c.tasks.map(([text, source], i) => ({
    id: `${c.id}-${i}`,
    text,
    source,
    cluster: c.id,
    clusterName: c.name,
    post: c.post,
  }))
);

export const TASK_COUNT = TASKS.length;

// The eight-item profile the post argues the role becomes.
export const NEW_PROFILE = [
  { id: 'operating-systems', label: 'Designing cross-functional operating systems', clusters: ['workflow', 'intake', 'rituals'] },
  { id: 'interop', label: 'Improving how Product, Engineering, Research and Design work together', clusters: ['liaison', 'coordination'] },
  { id: 'friction', label: 'Identifying workflow friction', clusters: ['workflow'] },
  { id: 'ai-workflows', label: 'Building AI-enabled workflows', clusters: ['enablement', 'tooling'] },
  { id: 'enablement', label: 'Creating enablement', clusters: ['enablement'] },
  { id: 'governance', label: 'Establishing governance', clusters: ['intake', 'quality'] },
  { id: 'readiness', label: 'Improving organizational readiness', clusters: ['enablement', 'resourcing'] },
  { id: 'translation', label: 'Translating design practice for non-design partners', clusters: ['liaison'] },
];

export const SOURCES = [
  { company: 'Stripe', role: 'Design Program Manager, AI', status: 'Open', accessed: '2026-08-23' },
  { company: 'Discord', role: 'Senior Design Program Manager', status: 'Open', accessed: '2026-08-23' },
  { company: 'Discord', role: 'Design Program Manager, Systems (Temporary)', status: 'Closed', accessed: '2026-08-23' },
  { company: 'Cisco', role: 'DPM, AI Transformation & Foundations', status: 'Closed 17 Aug 2026', accessed: '2026-08-23' },
  { company: 'Meta', role: 'Design Program Manager', status: 'No longer available', accessed: '2026-08-23' },
  { company: 'Nothing', role: 'Design Program Manager', status: 'Closed 23 Jan 2026', accessed: '2026-08-23' },
  { company: 'Figma', role: 'Design Program Manager, Platform', status: 'Closed 4 Dec 2025', accessed: '2026-08-23' },
  { company: 'WorkOS', role: 'Design Program Manager', status: 'Closed 9 Oct 2025', accessed: '2026-08-23' },
];
