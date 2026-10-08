/**
 * Official criteria, scales, and definitions directly extracted from:
 * 1. Presentation Rating Sheet
 * 2. Manuscript Rating Sheet
 * 3. Report of Capstone Project Proposal (Mindanao State University at Naawan)
 */

import { DefenseResult, CommitteeAction } from '../types';

export interface RatingOption {
  value: number;
  label: string;
  shortLabel: string;
  badgeClass: string;
}

export const RATING_SCALE_OPTIONS: RatingOption[] = [
  { value: 1, label: 'Poor (1)', shortLabel: 'Poor', badgeClass: 'bg-rose-100 text-rose-800 border-rose-200' },
  { value: 2, label: 'Fair (2)', shortLabel: 'Fair', badgeClass: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 3, label: 'Good (3)', shortLabel: 'Good', badgeClass: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 4, label: 'Very Good (4)', shortLabel: 'Very Good', badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  { value: 5, label: 'Excellent (5)', shortLabel: 'Excellent', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
];

export interface PresentationCriteriaItem {
  id: 'clarityOfPresentation' | 'understandingOfProject' | 'engagementAndCommunication' | 'useOfVisualAids' | 'handlingOfQA' | 'teamCollaboration' | 'timeManagement' | 'professionalismAndConfidence';
  title: string;
  bulletPoints: string[];
}

export const PRESENTATION_GROUP_ITEMS: PresentationCriteriaItem[] = [
  {
    id: 'clarityOfPresentation',
    title: 'Clarity of Presentation Content',
    bulletPoints: [
      'Clear and concise articulation of the overview of the project objectives, related literature and systems, concepts and technical background, methodology, and initial results and discussion.',
      'Logical flow and organization of the presentation.',
    ],
  },
  {
    id: 'understandingOfProject',
    title: 'Understanding of the Project',
    bulletPoints: [
      'Demonstrated depth of understanding of the capstone project by all team members.',
      'Ability to answer questions and discuss various aspects of the project confidently.',
    ],
  },
  {
    id: 'engagementAndCommunication',
    title: 'Engagement and Communication Skills',
    bulletPoints: [
      'Ability to engage the panel throughout the presentation.',
      'Clear and effective communication by all team members, including speaking skills and body language.',
    ],
  },
  {
    id: 'useOfVisualAids',
    title: 'Use of Visual Aids and Technology',
    bulletPoints: [
      'Effective use of visual aids (slides, graphs) to support the presentation.',
    ],
  },
  {
    id: 'handlingOfQA',
    title: 'Handling of Q&A Session',
    bulletPoints: [
      'Ability to respond to questions confidently, demonstrating knowledge and expertise.',
      'Clear and thoughtful responses to queries from the defense panel.',
    ],
  },
  {
    id: 'teamCollaboration',
    title: 'Team Collaboration and Participation',
    bulletPoints: [
      'Balanced participation and contribution from all team members.',
      'Evidence of effective collaboration and teamwork during the presentation.',
    ],
  },
  {
    id: 'timeManagement',
    title: 'Time Management',
    bulletPoints: [
      'Adherence to the allocated presentation time.',
      'Balanced allocation of time among sections or team members.',
    ],
  },
  {
    id: 'professionalismAndConfidence',
    title: 'Professionalism and Confidence',
    bulletPoints: [
      'Professional demeanor, confidence, and poise exhibited by the team throughout the presentation.',
    ],
  },
];

export interface ManuscriptSection {
  chapterTitle: string;
  sectionCode: string;
  items: {
    id: string;
    label: string;
    description?: string;
  }[];
}

export const MANUSCRIPT_SECTIONS: ManuscriptSection[] = [
  {
    chapterTitle: 'Chapter 1 – Introduction',
    sectionCode: 'CH1',
    items: [
      { id: '1.1', label: '1.1. Background of the Project' },
      { id: '1.2', label: '1.2. Context of the Project' },
      { id: '1.3', label: '1.3. Narrative Listing' },
      { id: '1.4', label: '1.4. Issues and Problems' },
      { id: '1.5', label: '1.5. Objectives of the Project' },
      { id: '1.6', label: '1.6. Significance of the Project' },
      { id: '1.7', label: '1.7. Scope and Limitation of the Project' },
      { id: '1.8', label: '1.8. Software Development Model of the Project' },
    ],
  },
  {
    chapterTitle: 'Chapter 2 – Review of Related Literature and Systems',
    sectionCode: 'CH2',
    items: [
      {
        id: '2.1',
        label: 'Relevance & Insights',
        description: 'The literature and systems reviewed are directly related to the project. The content also provides valuable insights and connections to the project.',
      },
      {
        id: '2.2',
        label: 'Currency & Advancements',
        description: 'The literature and systems are up-to-date considering any recent advancements or changes in the field.',
      },
      {
        id: '2.3',
        label: 'Credibility of Sources',
        description: 'The sources are credible, considering the reputation of the authors, publication venues, peer-review processes, and the sources come from reputable academic journals, books, recognized conferences, or websites.',
      },
      {
        id: '2.4',
        label: 'Balanced Critique & Gap Analysis',
        description: 'The review provides a balanced critique, identifies gaps, contradictions, or limitations, and offer insights into how these relate to the project.',
      },
      {
        id: '2.5',
        label: 'Structure & Coherence',
        description: 'The review is structured and organized. The content is logically presented, and the writing is clear, concise, and coherent.',
      },
      {
        id: '2.6',
        label: 'Quality of Citations & Referencing',
        description: 'The citations and cross-referencing are of quality. The sources cited are relevant and appropriately used to support the arguments or claims presented.',
      },
    ],
  },
  {
    chapterTitle: 'Chapter 3 – Concepts, Theories and Technical Background',
    sectionCode: 'CH3',
    items: [
      {
        id: '3.1',
        label: 'Models & Technical Concepts',
        description: 'There is a clear and concise explanation of the models, technical terms, methods, and concepts used in the project.',
      },
      {
        id: '3.2',
        label: 'Identification of Tools & Technologies',
        description: 'There is a clear identification and explanation of tools, software, or technologies employed in the project.',
      },
      {
        id: '3.3',
        label: 'Role & Significance of Selected Tools',
        description: 'There is an adequate explanation for the role, contribution, and significance of the selected tools in the project.',
      },
    ],
  },
  {
    chapterTitle: 'Chapter 4 – Methodology',
    sectionCode: 'CH4',
    items: [
      {
        id: '4.1',
        label: 'Plan for Implementation',
        description: 'There is a detailed plan for implementing the methods based on the project’s objectives.',
      },
      {
        id: '4.2',
        label: 'Tools & Techniques Justification',
        description: 'There is a clear description and justification of specific tools, software, or techniques used within the methodology.',
      },
      {
        id: '4.3',
        label: 'Overall Methodological Clarity',
        description: 'As a whole, there is clarity in explaining the methodology of the project.',
      },
    ],
  },
  {
    chapterTitle: 'Chapter 5 – Results and Discussion',
    sectionCode: 'CH5',
    items: [
      { id: '5.1', label: 'System Architecture' },
      { id: '5.2', label: 'Hardware and Software Design Components' },
      { id: '5.3', label: 'Use Case Diagram' },
      { id: '5.4', label: 'Activity Diagrams' },
      { id: '5.5', label: 'Functional Decomposition Diagram' },
      { id: '5.6', label: 'Context Diagram' },
      { id: '5.7', label: 'Data Flow Diagrams' },
      { id: '5.8', label: 'Database Design using Entity Relationship Model' },
      { id: '5.9', label: 'Data Dictionary of the Designed Database' },
    ],
  },
  {
    chapterTitle: 'Overall Rating of the Manuscript',
    sectionCode: 'CH6',
    items: [
      {
        id: '6.1',
        label: 'Institutional Formatting Compliance',
        description: 'Format is strictly followed. Some formatting that must be observed are: Font: Arial; Font size for title and heading: 11pt; Font size for body: 10 pt; Body line spacing: 1.5; Margin: 1.5, 1, 1, 1; Pagination: Bottom-centered; Table and Figure numbers are continuous starting from 1; References: APA format.',
      },
      {
        id: '6.2',
        label: 'Coherence & Chapter Transitions',
        description: 'There is coherence and logical flow between different sections and the transitions between chapters and subsections are smooth.',
      },
      {
        id: '6.3',
        label: 'Language Appropriateness & Conciseness',
        description: 'There is clarity, conciseness, and appropriateness of language used.',
      },
      {
        id: '6.4',
        label: 'Academic Style & Reader Engagement',
        description: 'The writing style is engaging to the reader and is adhering to academic writing conventions.',
      },
    ],
  },
];

export const TOTAL_MANUSCRIPT_ITEMS_COUNT = MANUSCRIPT_SECTIONS.reduce(
  (acc, sec) => acc + sec.items.length,
  0
); // 33 items

export interface CommitteeDecisionDefinition {
  decision: DefenseResult;
  type?: DefenseResult;
  title: string;
  label?: string;
  description: string;
  badgeClass: string;
  requiresRedefense: boolean;
}

export const COMMITTEE_DECISIONS: CommitteeDecisionDefinition[] = [
  {
    decision: 'Passed',
    type: 'Passed',
    title: 'Passed',
    label: 'Passed',
    description: 'The oral examination result is excellent without any need for revision.',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    requiresRedefense: false,
  },
  {
    decision: 'Provisionally Passed',
    type: 'Provisionally Passed',
    title: 'Provisionally Passed',
    label: 'Provisionally Passed',
    description: 'The oral examination result is satisfactory, but revision(s) is/are needed. No formal session/presentation is required. The manuscript will be checked by the Panel Member(s).',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    requiresRedefense: false,
  },
  {
    decision: 'Re-defense',
    type: 'Re-defense',
    title: 'Re-defense',
    label: 'Re-defense',
    description: 'The oral examination result is not satisfactory, that is, other significant item(s) is/are not met and/or absent.',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    requiresRedefense: true,
  },
  {
    decision: 'Failed',
    type: 'Failed',
    title: 'Failed',
    label: 'Failed',
    description: 'The total finding of the oral examination is unacceptable.',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    requiresRedefense: true,
  },
];

export const COMMITTEE_ACTION_OPTIONS: CommitteeAction[] = [
  'For Acceptance',
  'For Rejection',
  'Provisional',
];

export const INSTITUTIONAL_INFO = {
  university: 'Mindanao State University at Naawan',
  campus: 'Naawan, Misamis Oriental',
  college: 'College of Business and Information Technology',
  department: 'Department of Information Technology',
  degree: 'Bachelor of Science in Information Technology',
  documentTitle: 'REPORT OF CAPSTONE PROJECT PROPOSAL',
  reportTitle: 'REPORT OF CAPSTONE PROJECT PROPOSAL',
  coordinatorName: 'Cris Niel Anthonny M. Gulfan',
  coordinatorTitle: 'Capstone Project 1 Coordinator',
  chairpersonName: 'Jehanie May A. Macasawang',
  chairpersonTitle: 'Department Chairperson',
  deanName: 'Dr. Lilibeth P. Coronel',
  deanTitle: 'College Dean',
};

export const INSTITUTION_INFO = INSTITUTIONAL_INFO;
