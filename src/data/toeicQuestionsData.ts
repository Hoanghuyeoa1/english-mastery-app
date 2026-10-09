import { ToeicQuestion, ToeicQuestionGroup } from '../types';

/**
 * =============================================================================
 * TOEIC QUESTION GROUPS (Part 3, 4, 6, 7)
 * =============================================================================
 * Toàn bộ các nhóm câu hỏi chuẩn hóa có văn bản hoặc audio hoàn chỉnh.
 * Invariants: Mọi câu hỏi thuộc nhóm đều trỏ đúng groupId; nhóm sở hữu toàn bộ questionIds.
 */
export const TOEIC_QUESTION_GROUPS: ToeicQuestionGroup[] = [
  // ---------------------------------------------------------------------------
  // PART 3 CONVERSATIONS (LISTENING)
  // ---------------------------------------------------------------------------
  {
    id: 'toeic_grp_p3_1',
    part: 'part3_conv',
    skill: 'listening',
    type: 'audio_conversation',
    title: 'Quarterly Sales Presentation Preparation',
    topic: 'Sales & Presentation',
    difficulty: 'medium',
    estimatedDifficulty: 550,
    audioScript:
      'Man: Hello Sarah, have you finished the quarterly sales presentation for tomorrow? Woman: Almost, Mark. I am just waiting for the final revenue figures from the accounting department. Man: Great. Let me know if you need help polishing the PowerPoint slides.',
    questionIds: ['toeic_p3_1', 'toeic_p3_1_b', 'toeic_p3_1_c'],
    vocabularyTags: ['quarterly', 'revenue', 'presentation', 'slides'],
    grammarTags: ['present_continuous', 'conditional_if'],
  },
  {
    id: 'toeic_grp_p3_2',
    part: 'part3_conv',
    skill: 'listening',
    type: 'audio_conversation',
    title: 'Software Demonstration Rescheduling',
    topic: 'IT & Client Support',
    difficulty: 'medium',
    estimatedDifficulty: 600,
    audioScript:
      'Woman: David, did you hear that our software client wants to reschedule their on-site demonstration to Friday? Man: Yes, but Friday our primary demonstration server will undergo scheduled maintenance. Woman: We should contact their technical director immediately to propose Thursday afternoon instead.',
    questionIds: ['toeic_p3_2', 'toeic_p3_2_b', 'toeic_p3_2_c'],
    vocabularyTags: ['maintenance', 'reschedule', 'server', 'director'],
    grammarTags: ['cause_effect', 'modal_verbs'],
  },
  {
    id: 'toeic_grp_p3_3',
    part: 'part3_conv',
    skill: 'listening',
    type: 'audio_conversation',
    title: 'Office Chair Backorder Inquiry',
    topic: 'Procurement & Logistics',
    difficulty: 'medium',
    estimatedDifficulty: 550,
    audioScript:
      'Man: Good afternoon. I ordered thirty office chairs two weeks ago, but only twenty arrived this morning. Woman: Let me check your purchase order right now, sir. Ah, it appears the remaining ten units were backordered from the manufacturer and are scheduled to ship tomorrow.',
    questionIds: ['toeic_p3_3', 'toeic_p3_3_b', 'toeic_p3_3_c'],
    vocabularyTags: ['backordered', 'purchase_order', 'manufacturer', 'shipment'],
    grammarTags: ['passive_voice', 'past_simple'],
  },
  {
    id: 'toeic_grp_p3_4',
    part: 'part3_conv',
    skill: 'listening',
    type: 'audio_conversation',
    title: 'Hotel Conference Venue Booking',
    topic: 'Event Planning & Hospitality',
    difficulty: 'easy',
    estimatedDifficulty: 460,
    audioScript:
      'Man: Hello, I am calling from Summit Technologies to inquire about reserving your Grand Ballroom for our annual banquet on November fifteenth. Woman: I would be happy to check availability for you, sir. Unfortunately, the Grand Ballroom is already booked for that date, but our newly renovated Crystal Pavilion has identical capacity and modern audiovisual equipment. Man: That sounds promising. Could you send me the rental rates and catering menu by email?',
    questionIds: ['toeic_p3_4_a', 'toeic_p3_4_b', 'toeic_p3_4_c'],
    vocabularyTags: ['ballroom', 'banquet', 'renovated', 'catering'],
    grammarTags: ['polite_request', 'passive_voice'],
  },
  {
    id: 'toeic_grp_p3_5',
    part: 'part3_conv',
    skill: 'listening',
    type: 'audio_conversation',
    title: 'Budget Approval for Digital Marketing Campaign',
    topic: 'Finance & Advertising',
    difficulty: 'hard',
    estimatedDifficulty: 720,
    audioScript:
      'Woman: Marcus, has the finance committee approved our proposed budget for the upcoming social media advertising campaign? Man: Not quite yet, Linda. They requested more granular projections regarding our estimated return on investment across different demographics. Woman: I can extract those predictive metrics from our analytics dashboard before our executive briefing at two o’clock.',
    questionIds: ['toeic_p3_5_a', 'toeic_p3_5_b', 'toeic_p3_5_c'],
    vocabularyTags: ['committee', 'demographics', 'metrics', 'dashboard'],
    grammarTags: ['present_perfect', 'modal_can'],
  },
  {
    id: 'toeic_grp_p3_6',
    part: 'part3_conv',
    skill: 'listening',
    type: 'audio_conversation',
    title: 'Supply Chain Warehouse Inventory Inspection',
    topic: 'Warehouse & Inventory Logistics',
    difficulty: 'easy',
    estimatedDifficulty: 460,
    audioScript:
      'Man: Rachel, have you completed the physical inventory count in Warehouse Section B? Woman: Yes, Mark. We finished verifying the pallet counts an hour ago, but there is a shortage of thirty heavy-duty shipping cartons. Man: I will notify the procurement team right now so they can expedite a replacement order before the afternoon shift starts.',
    questionIds: ['toeic_p3_6_a', 'toeic_p3_6_b', 'toeic_p3_6_c'],
    vocabularyTags: ['inventory', 'shortage', 'procurement', 'cartons', 'expedite'],
    grammarTags: ['present_perfect', 'future_simple'],
  },
  {
    id: 'toeic_grp_p3_7',
    part: 'part3_conv',
    skill: 'listening',
    type: 'audio_conversation',
    title: 'Corporate IT Security Two-Factor Authentication Rollout',
    topic: 'IT & Information Security',
    difficulty: 'medium',
    estimatedDifficulty: 580,
    audioScript:
      'Woman: Brian, several staff members in human resources are having trouble setting up the mandatory two-factor authentication on their mobile phones. Man: Ah, they might be using the outdated version of our authenticator application. I uploaded a step-by-step troubleshooting guide to the company intranet this morning. Woman: Thanks. I will send an email blast with the direct link to all department heads immediately.',
    questionIds: ['toeic_p3_7_a', 'toeic_p3_7_b', 'toeic_p3_7_c'],
    vocabularyTags: ['authentication', 'troubleshooting', 'intranet', 'mandatory'],
    grammarTags: ['modal_might', 'past_simple'],
  },
  {
    id: 'toeic_grp_p3_8',
    part: 'part3_conv',
    skill: 'listening',
    type: 'audio_conversation',
    title: 'Commercial Office Lease Renegotiation',
    topic: 'Real Estate & Lease Negotiations',
    difficulty: 'medium',
    estimatedDifficulty: 620,
    audioScript:
      'Man: Good morning, Ms. Vance. Our property management office received your inquiry regarding renewing the lease for your architectural firm on the ninth floor. Woman: Yes, Mr. Sterling. We would love to extend our contract for another three years, but we need additional space for our expanding graphic design department. Man: Conveniently, Suite 904 adjacent to your current office is becoming vacant at the end of next month. I can arrange a walk-through tour this Thursday afternoon.',
    questionIds: ['toeic_p3_8_a', 'toeic_p3_8_b', 'toeic_p3_8_c'],
    vocabularyTags: ['lease', 'adjacent', 'vacant', 'renewing', 'architectural'],
    grammarTags: ['conditional_would', 'present_continuous'],
  },
  {
    id: 'toeic_grp_p3_9',
    part: 'part3_conv',
    skill: 'listening',
    type: 'audio_conversation',
    title: 'Hospital Medical Equipment Procurement & Calibration',
    topic: 'Healthcare Technology & Procurement',
    difficulty: 'hard',
    estimatedDifficulty: 710,
    audioScript:
      'Woman: Dr. Al-Mansoor, has the logistics courier confirmed delivery of the digital ultrasound scanners for our diagnostic imaging wing? Man: They arrived at the receiving dock twenty minutes ago, but the biomedical engineering team noted that the calibration certificates were missing from the shipping crate. Woman: That is concerning because hospital regulations prohibit us from operating uncertified clinical apparatus. Let me call the European vendor’s compliance liaison immediately to obtain digital copies.',
    questionIds: ['toeic_p3_9_a', 'toeic_p3_9_b', 'toeic_p3_9_c'],
    vocabularyTags: ['ultrasound', 'calibration', 'apparatus', 'compliance', 'biomedical'],
    grammarTags: ['present_perfect', 'passive_voice'],
  },
  {
    id: 'toeic_grp_p3_10',
    part: 'part3_conv',
    skill: 'listening',
    type: 'audio_conversation',
    title: 'Cross-Border Mergers & Acquisitions Tax Advisory',
    topic: 'Corporate Finance & Legal Advisory',
    difficulty: 'hard',
    estimatedDifficulty: 750,
    audioScript:
      'Man: Eleanor, our Tokyo branch just sent over the finalized audit balance sheets for the semiconductor merger. Are the cross-border tax withholding liabilities in line with our legal assessment? Woman: Generally yes, Kenji, but our senior tax partner expressed hesitation regarding transfer pricing compliance in European subsidiary jurisdictions. Man: In that case, we should schedule an extraordinary briefing with our Zurich legal counsel before presenting the acquisition term sheet to the board of directors tomorrow.',
    questionIds: ['toeic_p3_10_a', 'toeic_p3_10_b', 'toeic_p3_10_c'],
    vocabularyTags: ['withholding', 'liabilities', 'jurisdictions', 'subsidiary', 'acquisition'],
    grammarTags: ['modal_should', 'past_simple'],
  },

  // ---------------------------------------------------------------------------
  // PART 4 SHORT TALKS / ANNOUNCEMENTS (LISTENING)
  // ---------------------------------------------------------------------------
  {
    id: 'toeic_grp_p4_1',
    part: 'part4_talks',
    skill: 'listening',
    type: 'audio_talk',
    title: 'Flight Delay Airport Announcement',
    topic: 'Travel & Transport',
    difficulty: 'easy',
    estimatedDifficulty: 450,
    audioScript:
      'Attention passengers on Flight VN-204 to Tokyo. Due to adverse weather conditions at the destination airport, our departure has been delayed by approximately forty-five minutes. Please remain seated near Gate 12 for further updates.',
    questionIds: ['toeic_p4_1', 'toeic_p4_1_b', 'toeic_p4_1_c'],
    vocabularyTags: ['adverse', 'departure', 'delay', 'passengers'],
    grammarTags: ['prepositional_due_to', 'imperative_polite'],
  },
  {
    id: 'toeic_grp_p4_2',
    part: 'part4_talks',
    skill: 'listening',
    type: 'audio_talk',
    title: 'Regional Distribution Center Opening Announcement',
    topic: 'Corporate Operations',
    difficulty: 'medium',
    estimatedDifficulty: 620,
    audioScript:
      'Good morning everyone. As Director of Operations, I am thrilled to announce that our new regional distribution center in Da Nang will officially open next month. This state-of-the-art facility will cut our average delivery turnaround from seventy-two hours down to less than twenty-four hours across the central provinces.',
    questionIds: ['toeic_p4_2', 'toeic_p4_2_b', 'toeic_p4_2_c'],
    vocabularyTags: ['turnaround', 'distribution_center', 'facility', 'regional'],
    grammarTags: ['comparative', 'future_simple'],
  },
  {
    id: 'toeic_grp_p4_3',
    part: 'part4_talks',
    skill: 'listening',
    type: 'audio_talk',
    title: 'International Green Energy Summit Welcome',
    topic: 'Energy & Conferences',
    difficulty: 'easy',
    estimatedDifficulty: 480,
    audioScript:
      'Welcome to this year’s International Green Energy Summit. Please be advised that keynotes by Dr. Tanaka and Minister Evans will take place in Hall A. All attendees are invited to join the networking buffet on the rooftop terrace starting at six o’clock this evening.',
    questionIds: ['toeic_p4_3', 'toeic_p4_3_b', 'toeic_p4_3_c'],
    vocabularyTags: ['summit', 'networking', 'keynotes', 'attendees'],
    grammarTags: ['passive_voice', 'future_time'],
  },
  {
    id: 'toeic_grp_p4_4',
    part: 'part4_talks',
    skill: 'listening',
    type: 'audio_talk',
    title: 'Manufacturing Plant Safety Inspection Protocols',
    topic: 'Safety & Industrial Operations',
    difficulty: 'hard',
    estimatedDifficulty: 740,
    audioScript:
      'Attention all manufacturing personnel on the assembly floor. As part of our annual safety audit, routine maintenance on the robotic welding arms will begin at three o’clock today. All operators must wear certified protective goggles and high-visibility vests while entering Zone C. Please report any equipment anomalies directly to the shift supervisor.',
    questionIds: ['toeic_p4_4_a', 'toeic_p4_4_b', 'toeic_p4_4_c'],
    vocabularyTags: ['personnel', 'maintenance', 'anomalies', 'supervisor'],
    grammarTags: ['modal_must', 'adverbial_clause'],
  },
  {
    id: 'toeic_grp_p4_5',
    part: 'part4_talks',
    skill: 'listening',
    type: 'audio_talk',
    title: 'Corporate Headquarters Fire Drill Evacuation Announcement',
    contextType: 'announcement',
    topic: 'Workplace Safety & Facility Operations',
    difficulty: 'easy',
    estimatedDifficulty: 450,
    audioScript:
      'Attention all employees in the North Tower. At ten thirty this morning, building management will conduct an unannounced fire evacuation drill. When the alarm sounds, please cease all work, secure confidential documents, and proceed calmly to the nearest marked emergency stairwell. Do not use the elevators under any circumstances. Once outside, assemble at designated Assembly Point 3 in the courtyard behind the main lobby.',
    questionIds: ['toeic_p4_5_a', 'toeic_p4_5_b', 'toeic_p4_5_c'],
    vocabularyTags: ['evacuation', 'drill', 'stairwell', 'confidential', 'courtyard'],
    grammarTags: ['imperative_polite', 'modal_will'],
  },
  {
    id: 'toeic_grp_p4_6',
    part: 'part4_talks',
    skill: 'listening',
    type: 'audio_talk',
    title: 'Client Project Delay Voicemail Message',
    contextType: 'talk',
    topic: 'Client Services & Web Development',
    difficulty: 'medium',
    estimatedDifficulty: 570,
    audioScript:
      'Hello, Mr. Delgado. This is Fiona Gallagher calling from Apex Digital Media. I am calling to provide a status update on your company’s website redesign project. Our front-end team has encountered unexpected compatibility delays with your existing inventory database API. Consequently, our beta launch date will need to shift from November twelfth to November nineteenth. I have attached an updated development milestone timetable to your email, and I am available for a phone conference tomorrow morning at nine to review any questions.',
    questionIds: ['toeic_p4_6_a', 'toeic_p4_6_b', 'toeic_p4_6_c'],
    vocabularyTags: ['compatibility', 'milestone', 'timetable', 'encountered', 'redesign'],
    grammarTags: ['present_perfect', 'future_need_to'],
  },
  {
    id: 'toeic_grp_p4_7',
    part: 'part4_talks',
    skill: 'listening',
    type: 'audio_talk',
    title: 'Business Exhibition Trade Fair Keynote Introduction',
    contextType: 'talk',
    topic: 'Conferences & Keynote Presentation',
    difficulty: 'medium',
    estimatedDifficulty: 610,
    audioScript:
      'Good afternoon, distinguished guests and industry delegates. Welcome to Session B of the Global Logistics Expo. It is my sincere honor to introduce our keynote speaker, Ms. Hiroko Sato, Vice President of Sustainable Supply Chains at Orion Freight. Over the past decade, Ms. Sato has pioneered automated port handling solutions that reduce greenhouse gas emissions by up to forty percent. Following her forty-minute presentation, we will open the floor for audience questions. Please ensure your mobile devices are set to silent mode.',
    questionIds: ['toeic_p4_7_a', 'toeic_p4_7_b', 'toeic_p4_7_c'],
    vocabularyTags: ['delegates', 'keynote', 'pioneered', 'emissions', 'sustainable'],
    grammarTags: ['present_perfect', 'future_simple'],
  },
  {
    id: 'toeic_grp_p4_8',
    part: 'part4_talks',
    skill: 'listening',
    type: 'audio_talk',
    title: 'Radio Traffic & Weather Advisory for Highway Commuters',
    contextType: 'announcement',
    topic: 'Transportation & Public Broadcast',
    difficulty: 'hard',
    estimatedDifficulty: 720,
    audioScript:
      'This is Metro Transit 24 with your peak-hour regional travel bulletin. Severe flash flooding resulting from an unseasonal coastal downpour has forced the Department of Transportation to close two northbound lanes on the Interstate 80 bridge. Motorists traveling toward the downtown business district should expect bumper-to-bumper delays exceeding fifty minutes. Commuters are strongly urged to divert onto Route 4 express lanes or utilize the commuter rail system, which is currently running on full schedule with additional express coaches.',
    questionIds: ['toeic_p4_8_a', 'toeic_p4_8_b', 'toeic_p4_8_c'],
    vocabularyTags: ['commuters', 'bulletin', 'downpour', 'divert', 'congestion'],
    grammarTags: ['passive_urged', 'participial_resulting'],
  },
  {
    id: 'toeic_grp_p4_9',
    part: 'part4_talks',
    skill: 'listening',
    type: 'audio_talk',
    title: 'Factory Automated Robotics Calibration Instructions',
    contextType: 'talk',
    topic: 'Industrial Engineering & Manufacturing',
    difficulty: 'hard',
    estimatedDifficulty: 760,
    audioScript:
      'Good morning, shift technicians. Before we initiate production run forty-seven on the microchip assembly line, I need your complete attention regarding sensor recalibration protocols. Following yesterday’s precision drift on robotic pick-and-place units three and four, all line operators must execute manual optical alignments every ninety minutes rather than once per shift. Record all laser refraction tolerances in the digital maintenance log. If optical deviation exceeds zero point zero two millimeters, halt the conveyer belt immediately and alert quality assurance.',
    questionIds: ['toeic_p4_9_a', 'toeic_p4_9_b', 'toeic_p4_9_c'],
    vocabularyTags: ['calibration', 'recalibration', 'deviation', 'tolerances', 'refraction'],
    grammarTags: ['conditional_if', 'imperative_halt'],
  },

  // ---------------------------------------------------------------------------
  // PART 6 TEXT COMPLETION (READING)
  // ---------------------------------------------------------------------------
  {
    id: 'toeic_grp_p6_1',
    part: 'part6_text',
    skill: 'reading',
    type: 'text_completion',
    title: 'Logistics Cloud Tracking Infrastructure Memo',
    contextType: 'internal_memo',
    topic: 'Logistics & IT Infrastructure',
    difficulty: 'medium',
    estimatedDifficulty: 530,
    passageText: `INTERNAL MEMORANDUM
To: Regional Operations Staff
From: Corporate Logistics Management
Date: September 15

In order to optimize our nationwide parcel delivery network, we are currently [ ___1___ ] a brand-new cloud tracking infrastructure. This enhancement will provide real-time updates to our enterprise clients. [ ___2___ ], local hub managers are instructed to complete the training module by the end of next week. Any technical inquiries regarding portal navigation should be directed to the IT helpdesk [ ___3___ ].`,
    questionIds: ['toeic_p6_1', 'toeic_p6_2', 'toeic_p6_3'],
    vocabularyTags: ['implementing', 'infrastructure', 'therefore', 'promptly'],
    grammarTags: ['present_continuous', 'adverbial_transition', 'passive_voice'],
  },
  {
    id: 'toeic_grp_p6_2',
    part: 'part6_text',
    skill: 'reading',
    type: 'text_completion',
    title: 'Headquarters Facility Renovation Notice',
    contextType: 'announcement',
    topic: 'Facilities & Workplace',
    difficulty: 'easy',
    estimatedDifficulty: 440,
    passageText: `FACILITY UPDATE NOTICE
To: All Headquarters Employees
From: Building Administration
Date: March 10

Please be advised that scheduled carpeting and lighting upgrades on the fourth floor will commence this Saturday. During the work period, access to conference rooms 4A and 4B will be [ ___1___ ] restricted. [ ___2___ ], staff members scheduled to host client briefings are encouraged to book alternative spaces in the East Wing. We sincerely appreciate your patience and [ ___3___ ] during these necessary workplace improvements.`,
    questionIds: ['toeic_p6_4', 'toeic_p6_5', 'toeic_p6_6'],
    vocabularyTags: ['temporarily', 'consequently', 'cooperation', 'renovation'],
    grammarTags: ['adverb_modifier', 'causal_transition', 'parallel_nouns'],
  },
  {
    id: 'toeic_grp_p6_3',
    part: 'part6_text',
    skill: 'reading',
    type: 'text_completion',
    title: 'Corporate Paid Time Off Policy Guidelines',
    contextType: 'email',
    topic: 'Human Resources Policy',
    difficulty: 'hard',
    estimatedDifficulty: 700,
    passageText: `POLICY BULLETIN: ANNUAL LEAVE ROLLOVER
To: All Department Heads and Permanent Staff
From: Global HR Benefits Committee
Date: November 20

As we approach the fiscal year-end, employees are reminded to review their remaining paid time off (PTO) balances. Under revised corporate regulations, up to five unused days may be [ ___1___ ] into the upcoming calendar year. [ ___2___ ], requests exceeding this ceiling will require written authorization from department vice presidents. Staff must submit their final leave schedules [ ___3___ ] ensure seamless operational coverage throughout December.`,
    questionIds: ['toeic_p6_7', 'toeic_p6_8', 'toeic_p6_9'],
    vocabularyTags: ['transferred', 'furthermore', 'in_order_to', 'authorization'],
    grammarTags: ['passive_modal', 'additive_transition', 'infinitive_purpose'],
  },
  {
    id: 'toeic_grp_p6_4',
    part: 'part6_text',
    skill: 'reading',
    type: 'text_completion',
    title: 'Customer Satisfaction Survey Thank-You Letter',
    contextType: 'email',
    topic: 'Customer Relations & Retail Feedback',
    difficulty: 'easy',
    estimatedDifficulty: 460,
    passageText: `Dear Valued Customer,
Thank you for recently dining at Bistro Royale. We strive to offer memorable culinary experiences to all our guests. We would be immensely grateful if you could take three minutes to complete our online customer satisfaction [ ___1___ ]. Your honest comments will help us [ ___2___ ] our seasonal lunch and dinner selections. As a token of our heartfelt appreciation, you will receive a coupon code for fifteen percent off your next visit upon [ ___3___ ] the questionnaire.`,
    questionIds: ['toeic_p6_10', 'toeic_p6_11', 'toeic_p6_12'],
    vocabularyTags: ['satisfaction', 'questionnaire', 'appreciation', 'culinary'],
    grammarTags: ['gerund_preposition', 'infinitive_purpose'],
  },
  {
    id: 'toeic_grp_p6_5',
    part: 'part6_text',
    skill: 'reading',
    type: 'text_completion',
    title: 'Company Travel Expense Reimbursement Policy Update',
    contextType: 'internal_memo',
    topic: 'Corporate Finance & Travel Policy',
    difficulty: 'medium',
    estimatedDifficulty: 570,
    passageText: `MEMORANDUM
To: All Corporate Sales Representatives
From: Central Accounting Department
Date: May 8
Subject: Revised Travel Expense Guidelines

Please take note of upcoming revisions to our corporate travel reimbursement procedures effective June 1. Under the updated framework, all domestic flight reservations must be booked at least fourteen business days in advance to secure [ ___1___ ] airfares. Furthermore, expense claims lacking itemized digital receipts will no longer be [ ___2___ ] for processing. [ ___3___ ], employees traveling overseas are permitted a twenty percent increase in daily meal allowances to account for currency fluctuations.`,
    questionIds: ['toeic_p6_13', 'toeic_p6_14', 'toeic_p6_15'],
    vocabularyTags: ['reimbursement', 'economical', 'receipts', 'fluctuations'],
    grammarTags: ['adjective_modifier', 'passive_voice', 'additive_transition'],
  },
  {
    id: 'toeic_grp_p6_6',
    part: 'part6_text',
    skill: 'reading',
    type: 'text_completion',
    title: 'Annual Charity Gala Invitation & RSVP Guidelines',
    contextType: 'announcement',
    topic: 'Corporate Philanthropy & Events',
    difficulty: 'medium',
    estimatedDifficulty: 630,
    passageText: `CORDIAL INVITATION: HOPE FOUNDATION ANNUAL GALA
We cordially invite corporate sponsors and community partners to the 12th Annual Hope Foundation Charity Gala, held on Saturday, October 18, at the Bellevue Hotel. This prestigious black-tie evening [ ___1___ ] significant philanthropic contributions toward youth STEM education programs. Because dining capacity in the Grand Ballroom is strictly restricted, early registration is [ ___2___ ] advised. Guests who reserve executive corporate tables by September 15 will [ ___3___ ] complimentary sponsorship branding across all event digital banners.`,
    questionIds: ['toeic_p6_16', 'toeic_p6_17', 'toeic_p6_18'],
    vocabularyTags: ['philanthropic', 'prestigious', 'gala', 'complimentary'],
    grammarTags: ['subject_verb_agreement', 'adverb_degree', 'collocation'],
  },
  {
    id: 'toeic_grp_p6_7',
    part: 'part6_text',
    skill: 'reading',
    type: 'text_completion',
    title: 'IT Systems Migration Downtime Advisory',
    contextType: 'email',
    topic: 'Enterprise Cloud & System Maintenance',
    difficulty: 'hard',
    estimatedDifficulty: 710,
    passageText: `SYSTEMS ADVISORY: ENTERPRISE DATABASE MIGRATION
To: All Global Staff
From: Infrastructure Architecture Directorate
Date: August 2

Please be advised that our central enterprise database will undergo comprehensive cloud migration this coming weekend, beginning Friday at 9:00 PM and concluding Sunday at 6:00 PM. During this operational window, access to customer relationship records and internal accounting tools will be [ ___1___ ] unavailable. [ ___2___ ], local workstations will remain disconnected from external servers to protect sensitive client records during data transfer. We apologize for any temporary inconvenience and urge project managers to conclude all critical time-sensitive transactions [ ___3___ ] Friday afternoon.`,
    questionIds: ['toeic_p6_19', 'toeic_p6_20', 'toeic_p6_21'],
    vocabularyTags: ['migration', 'entirely', 'workstations', 'sensitive', 'inconvenience'],
    grammarTags: ['adverb_modifier', 'additive_transition', 'prepositional_time'],
  },
  {
    id: 'toeic_grp_p6_8',
    part: 'part6_text',
    skill: 'reading',
    type: 'text_completion',
    title: 'Executive Leadership Succession & Retirement Announcement',
    contextType: 'article',
    topic: 'Corporate Governance & Executive Succession',
    difficulty: 'hard',
    estimatedDifficulty: 770,
    passageText: `PRESS RELEASE: LEADERSHIP SUCCESSION AT VELOX ENERGY
HOUSTON — Velox Energy today announced that Chief Executive Officer Katherine Lindqvist plans to retire at the conclusion of the current fiscal quarter following twenty-two years of distinguished service. Under Ms. Lindqvist’s visionary leadership, Velox transformed into one of the nation’s [ ___1___ ] producers of renewable wind and solar energy. The Board of Directors has unanimously designated Chief Operating Officer Liam Gallagher as her successor. Mr. Gallagher’s extensive operational background makes him uniquely [ ___2___ ] to lead Velox into its next phase of global expansion. [ ___3___ ]`,
    questionIds: ['toeic_p6_22', 'toeic_p6_23', 'toeic_p6_24'],
    vocabularyTags: ['succession', 'foremost', 'distinguished', 'unanimously', 'handover'],
    grammarTags: ['superlative_adjective', 'participle_adjective', 'sentence_insertion'],
  },

  // ---------------------------------------------------------------------------
  // PART 7 READING COMPREHENSION (READING)
  // ---------------------------------------------------------------------------
  {
    id: 'toeic_grp_p7_1',
    part: 'part7_reading',
    skill: 'reading',
    type: 'reading_single',
    title: 'New Hybrid Work Policy Memorandum',
    contextType: 'internal_memo',
    topic: 'HR & Work Policy',
    difficulty: 'easy',
    estimatedDifficulty: 460,
    passageText: `MEMORANDUM
To: All Staff Members
From: Human Resources Department
Date: August 28
Subject: New Hybrid Work Policy Implementation

Starting next Monday, our company will formally transition to a hybrid work schedule. Employees in software engineering and product design are required to be present at the office on Tuesdays and Thursdays for core collaborative sessions. For the remaining three days, you may choose to work remotely from home, provided that all sprint deadlines and daily standup check-ins are met.

Please ensure your remote workspace meets our enterprise security standards by installing the updated VPN client available on the company intranet portal by Friday afternoon.`,
    questionIds: ['toeic_p7_1', 'toeic_p7_2', 'toeic_p7_1_c'],
    vocabularyTags: ['hybrid', 'collaborative', 'enterprise', 'security', 'standup'],
    grammarTags: ['passive_required', 'gerund_by_installing', 'conditional_provided'],
  },
  {
    id: 'toeic_grp_p7_2',
    part: 'part7_reading',
    skill: 'reading',
    type: 'reading_single',
    title: 'Projector Warranty & Repair Request Email',
    contextType: 'email',
    topic: 'Customer Support & Warranty',
    difficulty: 'medium',
    estimatedDifficulty: 580,
    passageText: `EMAIL CORRESPONDENCE
From: Clara Dupont <c.dupont@vortextech.com>
To: Support Desk <support@luminaoffice.com>
Date: October 4, 10:15 AM
Subject: Warranty inquiry for Lumina Pro Projector (Model LP-400)

Dear Lumina Support Team,
Our firm purchased four units of the Lumina Pro Projector last November for our executive conference rooms. Yesterday, one unit ceased displaying video signals while the cooling fan continued operating at maximum speed. 

According to our purchasing invoice, these projectors came with a comprehensive three-year corporate hardware warranty. Could you please provide instructions on shipping this defective unit for repair or dispatching an on-site technician? We have a major investor summit scheduled in two weeks.

Best regards,
Clara Dupont
Facility Coordinator, Vortex Technologies`,
    questionIds: ['toeic_p7_3', 'toeic_p7_4', 'toeic_p7_2_c'],
    vocabularyTags: ['defective', 'warranty', 'dispatching', 'coordinator', 'invoice'],
    grammarTags: ['past_simple', 'present_participle', 'polite_modal'],
  },
  {
    id: 'toeic_grp_p7_3',
    part: 'part7_reading',
    skill: 'reading',
    type: 'reading_single',
    title: 'Commercial Office Lease Agreement Summary',
    contextType: 'article',
    topic: 'Real Estate & Contracts',
    difficulty: 'medium',
    estimatedDifficulty: 630,
    passageText: `EXECUTIVE LEASE ABSTRACT
Property: Westlake Financial Tower, Suite 1400 (5,500 sq ft)
Landlord: Highline Commercial Properties LLC
Tenant: Nexus BioHealth Corp
Term: 36 Months (Effective January 1, 2027 to December 31, 2029)

Terms and Conditions:
1. Base Rent: $18,500 per calendar month, due on the first day of each month. Late payments past the fifth day will incur an automatic 5% penalty fee.
2. Tenant Improvements: Landlord agrees to furnish a $25,000 tenant improvement allowance dedicated exclusively to fiber-optic data cabling and HVAC recalibration.
3. Subleasing: Tenant shall not assign or sublease any portion of Suite 1400 without prior written consent from the Landlord, which shall not be unreasonably withheld.`,
    questionIds: ['toeic_p7_5', 'toeic_p7_6', 'toeic_p7_7'],
    vocabularyTags: ['tenant', 'landlord', 'penalty', 'sublease', 'allowance'],
    grammarTags: ['future_modal_shall', 'prepositional_due_on'],
  },
  {
    id: 'toeic_grp_p7_4',
    part: 'part7_reading',
    skill: 'reading',
    type: 'reading_double',
    title: 'Client Invoicing Discrepancy & Resolution Email Exchange',
    contextType: 'email',
    topic: 'Client Accounting & Invoicing',
    difficulty: 'hard',
    estimatedDifficulty: 780,
    passageText: `[DOCUMENT 1: EMAIL]
From: Arthur Campbell <a.campbell@campbelldesign.com>
To: Accounts Receivable <billing@veritascloud.io>
Date: April 14
Subject: Discrepancy on Invoice #VC-8841

Dear Veritas Billing Team,
I am reviewing our monthly subscription invoice #VC-8841 for March services. We were billed for fifty active enterprise cloud seats at $40 per user ($2,000). However, according to our contract amendment signed on February 28, our team downsized to thirty-five active seats effective March 1. Please re-issue an adjusted invoice reflecting the accurate total of $1,400.

Sincerely,
Arthur Campbell
Managing Partner, Campbell Design Studio

---
[DOCUMENT 2: RESPONSE EMAIL]
From: Elena Rostova <e.rostova@veritascloud.io>
To: Arthur Campbell <a.campbell@campbelldesign.com>
Date: April 15
Subject: RE: Discrepancy on Invoice #VC-8841

Dear Mr. Campbell,
Thank you for bringing this to our attention. Our automated billing engine had not refreshed your user tier prior to the March billing run. We have verified your February 28 amendment and issued revised Invoice #VC-8841-A for $1,400. Additionally, we have credited a $50 courtesy voucher toward your April account balance for the inconvenience.

Best regards,
Elena Rostova
Senior Billing Specialist, Veritas Cloud Solutions`,
    questionIds: ['toeic_p7_8', 'toeic_p7_9', 'toeic_p7_10'],
    vocabularyTags: ['discrepancy', 'subscription', 'amendment', 'voucher', 'courtesy'],
    grammarTags: ['past_perfect', 'passive_voice', 'present_perfect'],
  },
  {
    id: 'toeic_grp_p7_5',
    part: 'part7_reading',
    skill: 'reading',
    type: 'reading_single',
    title: 'Public Transit Weekend Rail Maintenance Schedule & Shuttle Notice',
    contextType: 'schedule',
    topic: 'Transportation & Commuter Advisory',
    difficulty: 'easy',
    estimatedDifficulty: 470,
    passageText: `METROPOLITAN TRANSIT AUTHORITY (MTA)
WEEKEND RAILWAY SERVICE RESTRUCTURING
Dates: Saturday, October 12 – Sunday, October 13

Due to necessary track replacement and electrical catenary upgrades between Greenfield Station and Harbor Central, Red Line train services will be suspended throughout the upcoming weekend.

Temporary Service Alternatives:
- Express Bus Shuttles (Route 40-X): Depart every 10 minutes from Greenfield Station directly to Harbor Central. Travel time is approximately 25 minutes. No fare required with a valid rail pass.
- Local Bus Shuttles (Route 40-L): Stop at all intermediate stations (Oak Park, Riverview, Civic Plaza). Departures every 15 minutes.
- Regular rail service will resume promptly with the first morning train on Monday, October 14, at 5:15 AM.

Customer service agents in bright yellow jackets will be stationed at all affected platforms to assist passengers.`,
    questionIds: ['toeic_p7_11', 'toeic_p7_12', 'toeic_p7_13'],
    vocabularyTags: ['suspended', 'shuttles', 'intermediate', 'catenary', 'passengers'],
    grammarTags: ['passive_voice', 'future_simple', 'prepositional_due_to'],
  },
  {
    id: 'toeic_grp_p7_6',
    part: 'part7_reading',
    skill: 'reading',
    type: 'reading_single',
    title: 'Online Retail Order Shipping & Damaged Item Refund Ticket',
    contextType: 'email',
    topic: 'E-Commerce Customer Service',
    difficulty: 'medium',
    estimatedDifficulty: 590,
    passageText: `SUPPORT TICKET #49021
Customer Name: Rebecca Sterling
Order Number: #ORD-98214 (Placed on: September 4)
Subject: Replacement request for damaged porcelain dinnerware set

Dear Customer Care Team,
I received package #ORD-98214 yesterday afternoon containing the 16-piece Artisanal Porcelain Dinnerware Set that I purchased as an anniversary gift. While the outer cardboard parcel was intact, three ceramic dinner plates inside the presentation box were shattered upon opening, likely due to insufficient bubble padding.

As the anniversary celebration takes place this coming Saturday, September 14, I would prefer an expedited replacement rather than a store credit. I have uploaded high-resolution photographs of the damaged items and the shipping barcode via your customer portal. Could you please confirm if a replacement parcel can be dispatched via overnight courier?

Thank you,
Rebecca Sterling`,
    questionIds: ['toeic_p7_14', 'toeic_p7_15', 'toeic_p7_16'],
    vocabularyTags: ['shattered', 'expedited', 'padding', 'replacement', 'dispatched'],
    grammarTags: ['past_passive', 'polite_modal', 'conditional_if'],
  },
  {
    id: 'toeic_grp_p7_7',
    part: 'part7_reading',
    skill: 'reading',
    type: 'reading_single',
    title: 'Business Journal Press Release on Solar Microgrid Expansion',
    contextType: 'article',
    topic: 'Clean Energy & Regional Economic Growth',
    difficulty: 'medium',
    estimatedDifficulty: 640,
    passageText: `AUSTIN BUSINESS CHRONICLE
SOLARIS ENERGY BREAKS GROUND ON REGIONAL MICROGRID IN CENTRAL TEXAS
By Marcus Vance | July 19

AUSTIN — Solaris Energy announced yesterday that it has commenced construction on a $45-million utility-scale solar microgrid in Williamson County. Designed to supply clean electricity to over 18,000 households, the facility integrates 60,000 photovoltaic solar modules with a high-capacity lithium-iron phosphate battery storage system.

According to Chief Technology Officer Dr. Elena Navarro, the microgrid is engineered to insulate critical local infrastructure, including regional hospitals and water treatment plants, from power grid disruptions during severe weather events. The initiative received a $12-million infrastructure subsidy from the federal Department of Energy and is projected to create 140 construction jobs over the next fourteen months. Solaris expects commercial commissioning of the facility to conclude by November of next year.`,
    questionIds: ['toeic_p7_17', 'toeic_p7_18', 'toeic_p7_19'],
    vocabularyTags: ['microgrid', 'photovoltaic', 'subsidy', 'infrastructure', 'disruptions'],
    grammarTags: ['passive_engineered', 'participial_designed', 'present_simple'],
  },
  {
    id: 'toeic_grp_p7_8',
    part: 'part7_reading',
    skill: 'reading',
    type: 'reading_double',
    title: 'Executive Leadership Workshop Flier + Attendee Evaluation Email',
    contextType: 'email',
    topic: 'Professional Development & Training Feedback',
    difficulty: 'hard',
    estimatedDifficulty: 730,
    passageText: `[DOCUMENT 1: WORKSHOP BROCHURE]
EXCEL EXECUTIVE INSTITUTE: FALL PROFESSIONAL SEMINAR SERIES
Location: Grand Hyatt Regency, Chicago, IL
Date: Thursday, October 24

Session Tracks:
- Track A (9:00 AM – 11:30 AM): "Cross-Functional Agile Leadership" — Facilitated by Dr. Warren Hayes, author of Team Dynamics 3.0. Focuses on resolving interdepartmental bottlenecks.
- Track B (1:00 PM – 3:30 PM): "Financial Analytics for Non-Financial Managers" — Facilitated by Ms. Cynthia Morales, former CFO of Zenith Global. Emphasizes variance analysis and cash-flow forecasting.
- Track C (4:00 PM – 5:30 PM): "Executive Negotiation & Strategic Influence" — Interactive workshop with case studies.

Enrollment Fees: $350 per single session, or $850 for an all-day comprehensive pass (includes networking luncheon). Early registration discount of 10% applies to bookings finalized before October 1.

---
[DOCUMENT 2: FOLLOW-UP EMAIL]
From: Derek Lawson <d.lawson@nexustech.com>
To: Training Director <inquiries@excelexec.org>
Date: October 28
Subject: Feedback on October 24 Seminar Attendance

Dear Excel Executive Institute,
I attended the full-day seminar in Chicago last Thursday under my firm’s professional development sponsorship. I found Ms. Cynthia Morales’ afternoon session on financial cash-flow modeling exceptionally valuable and immediately applicable to our quarterly budget reviews. 

However, I wanted to inquire regarding the continuing professional education (CPE) credits promised in the seminar syllabus. Our accounting department requires the formal digital certificate of completion before they can authorize reimbursement for my $850 registration fee. Could you please email this document to my attention at your earliest convenience?

Sincerely,
Derek Lawson
Senior Operations Lead, Nexus Technologies`,
    questionIds: ['toeic_p7_20', 'toeic_p7_21', 'toeic_p7_22'],
    vocabularyTags: ['cross-functional', 'bottlenecks', 'reimbursement', 'syllabus', 'applicable'],
    grammarTags: ['participial_facilitated', 'past_simple', 'infinitive_purpose'],
  },
  {
    id: 'toeic_grp_p7_9',
    part: 'part7_reading',
    skill: 'reading',
    type: 'reading_double',
    title: 'Architectural Building Proposal + City Zoning Board Approval Letter',
    contextType: 'internal_memo',
    topic: 'Urban Planning & Commercial Architecture',
    difficulty: 'hard',
    estimatedDifficulty: 780,
    passageText: `[DOCUMENT 1: ARCHITECTURAL DESIGN SUMMARY]
Project: The Meridian Commercial Plaza
Architectural Firm: Foster & Sterling Architects
Client: Vanguard Real Estate Holdings
Submission Date: March 15

Design Specifications:
- Structure: 18-story mixed-use commercial tower containing 280,000 square feet of Class-A office space and ground-level retail boutiques.
- Sustainability: Targeting LEED Platinum certification featuring high-efficiency triple-glazed glass facade, rooftop photovoltaic solar arrays, and rainwater harvesting cisterns.
- Parking: Two-level underground garage accommodating 320 electric-vehicle charging bays.
- Height Variance Request: Project height is 245 feet, exceeding the standard downtown commercial zone ceiling of 220 feet by 25 feet.

---
[DOCUMENT 2: REGULATORY RESPONSE LETTER]
CITY OF METROPOLIS ZONING & PLANNING COMMISSION
Date: April 10
To: Julian Foster, Foster & Sterling Architects
Subject: Conditional Approval for The Meridian Plaza (Application #ZP-2027-88)

Dear Mr. Foster,
The Metropolis Zoning Commission convened on April 8 to review your design proposal for The Meridian Plaza. We are pleased to inform you that your request for a 25-foot height variance has been conditionally approved, subject to the following statutory stipulations:

1. Pedestrian Access: The developer must dedicate a 30-foot public setback along the western perimeter to create a landscaped pedestrian promenade connecting to the riverfront park.
2. Construction Timeline: Heavy foundation drilling must be restricted to the hours of 8:00 AM through 5:00 PM on weekdays to mitigate noise disturbance for nearby residential condominiums.
3. Final Environmental Review: The Department of Water Management must inspect and certify the stormwater cistern blueprints prior to building permit issuance.

Respectfully submitted,
Margaret Thornton
Chairperson, Metropolis Zoning Board`,
    questionIds: ['toeic_p7_23', 'toeic_p7_24', 'toeic_p7_25'],
    vocabularyTags: ['variance', 'stipulations', 'promenade', 'mitigate', 'cisterns', 'facade'],
    grammarTags: ['passive_voice', 'modal_must', 'participial_clauses'],
  },
];

/**
 * =============================================================================
 * TOEIC QUESTION BANK (93 QUESTIONS ACROSS ALL PARTS 1–7, SPEAKING & WRITING)
 * =============================================================================
 */
export const TOEIC_QUESTION_BANK: ToeicQuestion[] = [
  // ===========================================================================
  // PART 1: PHOTOGRAPHS (LISTENING - 8 QUESTIONS)
  // ===========================================================================
  {
    id: 'toeic_p1_1',
    part: 'part1_photos',
    skill: 'listening',
    difficulty: 'easy',
    topic: 'Office & Workplace',
    subSkill: 'action_identification',
    questionType: 'photo_action',
    vocabularyTags: ['typing', 'laptop', 'office'],
    grammarTags: ['present_continuous'],
    estimatedDifficulty: 300,
    imageUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1000&q=80',
    audioScript: 'Look at the picture marked number 1. (A) The man is typing on a laptop. (B) The man is repairing a printer. (C) The man is drinking from a mug. (D) The man is presenting a chart.',
    questionText: 'Part 1: Nghe 4 nhận định (A, B, C, D) và chọn phương án mô tả chính xác nhất bức ảnh bên dưới.',
    options: [
      'A. The man is typing on a laptop.',
      'B. The man is repairing a printer.',
      'C. The man is drinking from a mug.',
      'D. The man is presenting a chart.'
    ],
    correctAnswer: 'A',
    explanation: 'Đáp án (A) mô tả chính xác hành động người đàn ông đang gõ bàn phím laptop trong phòng làm việc. Các phương án (B), (C), (D) không khớp với hành động trong ảnh.',
    vietnameseTranslation: 'Nhìn vào bức ảnh. (A) Người đàn ông đang gõ máy tính xách tay. (B) Người đàn ông đang sửa máy in. (C) Người đàn ông đang uống nước từ chiếc cốc. (D) Người đàn ông đang trình bày biểu đồ.',
    keyVocabulary: [
      { word: 'Typing', ipa: '/ˈtaɪ.pɪŋ/', meaning: 'Đang gõ bàn phím' },
      { word: 'Laptop', ipa: '/ˈlæp.tɒp/', meaning: 'Máy tính xách tay' }
    ]
  },
  {
    id: 'toeic_p1_2',
    part: 'part1_photos',
    skill: 'listening',
    difficulty: 'easy',
    topic: 'Retail & Supermarket',
    subSkill: 'object_placement',
    questionType: 'photo_object_placement',
    vocabularyTags: ['merchandise', 'shelves', 'retail'],
    grammarTags: ['passive_voice'],
    estimatedDifficulty: 350,
    imageUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=1000&q=80',
    audioScript: 'Look at the picture marked number 2. (A) Some boxes are being loaded into a truck. (B) Some merchandise is displayed on the shelves. (C) The cashier is counting cash. (D) Customers are waiting in line at the entrance.',
    questionText: 'Part 1: Nghe 4 nhận định (A, B, C, D) và chọn phương án mô tả chính xác nhất bức ảnh bên dưới.',
    options: [
      'A. Some boxes are being loaded into a truck.',
      'B. Some merchandise is displayed on the shelves.',
      'C. The cashier is counting cash.',
      'D. Customers are waiting in line at the entrance.'
    ],
    correctAnswer: 'B',
    explanation: 'Đáp án (B) mô tả chính xác trạng thái hàng hóa (merchandise) được xếp ngay ngắn trên các kệ (shelves).',
    vietnameseTranslation: '(A) Một số thùng hàng đang được bốc lên xe tải. (B) Một số hàng hóa được trưng bày trên các kệ. (C) Thu ngân đang đếm tiền mặt. (D) Khách hàng đang xếp hàng tại lối vào.',
    keyVocabulary: [
      { word: 'Merchandise', ipa: '/ˈmɜː.tʃən.daɪs/', meaning: 'Hàng hóa, sản phẩm bày bán' },
      { word: 'Shelves', ipa: '/ʃelvz/', meaning: 'Các kệ, giá đỡ' }
    ]
  },
  {
    id: 'toeic_p1_3',
    part: 'part1_photos',
    skill: 'listening',
    difficulty: 'medium',
    topic: 'Corporate Meeting',
    subSkill: 'group_activity',
    questionType: 'photo_scene_general',
    vocabularyTags: ['colleagues', 'conference_table', 'meeting'],
    grammarTags: ['passive_state'],
    estimatedDifficulty: 450,
    imageUrl: 'https://images.unsplash.com/photo-1531497865144-0464ef8fb9a9?auto=format&fit=crop&w=1000&q=80',
    audioScript: 'Look at the picture marked number 3. (A) The colleagues are seated around a conference table. (B) The workers are painting the office wall. (C) The manager is locking the door. (D) The team is packing moving cartons.',
    questionText: 'Part 1: Nghe 4 nhận định (A, B, C, D) và chọn phương án mô tả chính xác nhất bức ảnh bên dưới.',
    options: [
      'A. The colleagues are seated around a conference table.',
      'B. The workers are painting the office wall.',
      'C. The manager is locking the door.',
      'D. The team is packing moving cartons.'
    ],
    correctAnswer: 'A',
    explanation: 'Đáp án (A) mô tả chính xác cảnh các đồng nghiệp đang ngồi thảo luận quanh bàn hội nghị.',
    vietnameseTranslation: '(A) Các đồng nghiệp đang ngồi quanh bàn họp. (B) Công nhân đang sơn tường văn phòng. (C) Người quản lý đang khóa cửa. (D) Đội ngũ đang đóng gói các thùng chuyển đồ.',
    keyVocabulary: [
      { word: 'Colleagues', ipa: '/ˈkɒl.iːɡz/', meaning: 'Đồng nghiệp' },
      { word: 'Conference table', ipa: '/ˈkɒn.fər.əns ˈteɪ.bəl/', meaning: 'Bàn họp, bàn hội nghị' }
    ]
  },
  {
    id: 'toeic_p1_4',
    part: 'part1_photos',
    skill: 'listening',
    difficulty: 'medium',
    topic: 'Construction & Engineering',
    subSkill: 'detail_action',
    questionType: 'photo_action',
    vocabularyTags: ['blueprints', 'construction', 'engineering'],
    grammarTags: ['present_continuous'],
    estimatedDifficulty: 500,
    imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1000&q=80',
    audioScript: 'Look at the picture marked number 4. (A) An engineer is examining construction blueprints. (B) Heavy vehicles are paving the highway. (C) Scaffolding is being disassembled by workers. (D) Materials are being delivered to the warehouse.',
    questionText: 'Part 1: Nghe 4 nhận định (A, B, C, D) và chọn phương án mô tả chính xác nhất bức ảnh bên dưới.',
    options: [
      'A. An engineer is examining construction blueprints.',
      'B. Heavy vehicles are paving the highway.',
      'C. Scaffolding is being disassembled by workers.',
      'D. Materials are being delivered to the warehouse.'
    ],
    correctAnswer: 'A',
    explanation: 'Đáp án (A) mô tả chính xác cảnh kỹ sư đang xem xét bản vẽ kỹ thuật (blueprints) tại công trường xây dựng.',
    vietnameseTranslation: '(A) Kỹ sư đang xem bản thiết kế xây dựng. (B) Các phương tiện hạng nặng đang trải nhựa đường cao tốc. (C) Giàn giáo đang được công nhân tháo dỡ. (D) Vật liệu đang được giao đến nhà kho.',
    keyVocabulary: [
      { word: 'Blueprints', ipa: '/ˈbluː.prɪnts/', meaning: 'Bản vẽ kỹ thuật, bản thiết kế' },
      { word: 'Construction', ipa: '/kənˈstrʌk.ʃən/', meaning: 'Xây dựng, công trình' }
    ]
  },
  {
    id: 'toeic_p1_5',
    part: 'part1_photos',
    skill: 'listening',
    difficulty: 'easy',
    topic: 'Culinary & Restaurant',
    subSkill: 'action_identification',
    questionType: 'photo_action',
    vocabularyTags: ['chef', 'commercial_kitchen', 'preparing'],
    grammarTags: ['present_continuous'],
    estimatedDifficulty: 320,
    imageUrl: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1000&q=80',
    audioScript: 'Look at the picture marked number 5. (A) A chef is preparing dishes in a commercial kitchen. (B) Customers are paying the bill at the register. (C) The dining room tables are being cleared. (D) The restaurant menu is posted outside.',
    questionText: 'Part 1: Nghe 4 nhận định (A, B, C, D) và chọn phương án mô tả chính xác nhất bức ảnh bên dưới.',
    options: [
      'A. A chef is preparing dishes in a commercial kitchen.',
      'B. Customers are paying the bill at the register.',
      'C. The dining room tables are being cleared.',
      'D. The restaurant menu is posted outside.'
    ],
    correctAnswer: 'A',
    explanation: 'Đáp án (A) mô tả chính xác đầu bếp đang chuẩn bị món ăn trong không gian bếp chuyên nghiệp.',
    vietnameseTranslation: '(A) Đầu bếp đang chuẩn bị các món ăn trong bếp thương mại. (B) Khách hàng đang thanh toán tại quầy. (C) Bàn ăn đang được dọn dẹp. (D) Thực đơn được dán bên ngoài.',
    keyVocabulary: [
      { word: 'Commercial kitchen', ipa: '/kəˈmɜː.ʃəl ˈkɪtʃ.ɪn/', meaning: 'Bếp thương mại / bếp nhà hàng' },
      { word: 'Preparing', ipa: '/prɪˈpeə.rɪŋ/', meaning: 'Đang chuẩn bị, sơ chế' }
    ]
  },
  {
    id: 'toeic_p1_6',
    part: 'part1_photos',
    skill: 'listening',
    difficulty: 'medium',
    topic: 'Public Transportation',
    subSkill: 'group_activity',
    questionType: 'photo_scene_general',
    vocabularyTags: ['commuters', 'platform', 'boarding'],
    grammarTags: ['present_continuous'],
    estimatedDifficulty: 470,
    imageUrl: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=1000&q=80',
    audioScript: 'Look at the picture marked number 6. (A) Commuters are waiting along the train platform. (B) Bicycles are parked in an underground garage. (C) An airplane is taxiing on the runway. (D) Passengers are retrieving luggage from the carousel.',
    questionText: 'Part 1: Nghe 4 nhận định (A, B, C, D) và chọn phương án mô tả chính xác nhất bức ảnh bên dưới.',
    options: [
      'A. Commuters are waiting along the train platform.',
      'B. Bicycles are parked in an underground garage.',
      'C. An airplane is taxiing on the runway.',
      'D. Passengers are retrieving luggage from the carousel.'
    ],
    correctAnswer: 'A',
    explanation: 'Đáp án (A) thể hiện chính xác cảnh hành khách đi làm đang đứng chờ tàu dọc theo sân ga đường sắt.',
    vietnameseTranslation: '(A) Hành khách đi lại đang chờ dọc theo sân ga xe lửa. (B) Xe đạp đỗ trong hầm. (C) Máy bay đang di chuyển trên đường băng. (D) Hành khách đang lấy hành lý từ băng chuyền.',
    keyVocabulary: [
      { word: 'Commuters', ipa: '/kəˈmjuː.tərz/', meaning: 'Người đi làm hàng ngày bằng phương tiện công cộng' },
      { word: 'Platform', ipa: '/ˈplæt.fɔːm/', meaning: 'Sân ga xe lửa' }
    ]
  },
  {
    id: 'toeic_p1_7',
    part: 'part1_photos',
    skill: 'listening',
    difficulty: 'medium',
    topic: 'Warehouse & Logistics',
    subSkill: 'equipment_action',
    questionType: 'photo_action',
    vocabularyTags: ['forklift', 'pallets', 'cargo'],
    grammarTags: ['present_continuous', 'passive_voice'],
    estimatedDifficulty: 520,
    imageUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1000&q=80',
    audioScript: 'Look at the picture marked number 7. (A) A forklift is transporting stacked wooden pallets. (B) Workers are inspecting a delivery van engine. (C) Boxes are falling off a conveyor belt. (D) The shipping dock door is completely sealed.',
    questionText: 'Part 1: Nghe 4 nhận định (A, B, C, D) và chọn phương án mô tả chính xác nhất bức ảnh bên dưới.',
    options: [
      'A. A forklift is transporting stacked wooden pallets.',
      'B. Workers are inspecting a delivery van engine.',
      'C. Boxes are falling off a conveyor belt.',
      'D. The shipping dock door is completely sealed.'
    ],
    correctAnswer: 'A',
    explanation: 'Đáp án (A) mô tả chính xác chiếc xe nâng (forklift) đang di chuyển các pallet gỗ xếp chồng lên nhau trong kho.',
    vietnameseTranslation: '(A) Xe nâng đang vận chuyển các pallet gỗ xếp chồng. (B) Công nhân đang kiểm tra động cơ xe tải. (C) Hộp rơi khỏi băng chuyền. (D) Cửa bốc dỡ hàng bị đóng kín.',
    keyVocabulary: [
      { word: 'Forklift', ipa: '/ˈfɔːk.lɪft/', meaning: 'Xe nâng hàng' },
      { word: 'Pallets', ipa: '/ˈpæl.ɪts/', meaning: 'Kệ gỗ đỡ hàng' }
    ]
  },
  {
    id: 'toeic_p1_8',
    part: 'part1_photos',
    skill: 'listening',
    difficulty: 'hard',
    topic: 'Healthcare & Technology',
    subSkill: 'detail_action',
    questionType: 'photo_action',
    vocabularyTags: ['physician', 'digital_tablet', 'medical_chart'],
    grammarTags: ['present_continuous'],
    estimatedDifficulty: 650,
    imageUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1000&q=80',
    audioScript: 'Look at the picture marked number 8. (A) A physician is reviewing records on a digital tablet. (B) Pharmacists are bottling liquid medication. (C) A hospital patient is walking down the corridor. (D) Emergency sirens are flashing on an ambulance.',
    questionText: 'Part 1: Nghe 4 nhận định (A, B, C, D) và chọn phương án mô tả chính xác nhất bức ảnh bên dưới.',
    options: [
      'A. A physician is reviewing records on a digital tablet.',
      'B. Pharmacists are bottling liquid medication.',
      'C. A hospital patient is walking down the corridor.',
      'D. Emergency sirens are flashing on an ambulance.'
    ],
    correctAnswer: 'A',
    explanation: 'Đáp án (A) mô tả bác sĩ y khoa đang xem hồ sơ bệnh án trên máy tính bảng điện tử trong phòng khám.',
    vietnameseTranslation: '(A) Bác sĩ đang xem xét hồ sơ trên máy tính bảng kỹ thuật số. (B) Dược sĩ đang đóng chai thuốc. (C) Bệnh nhân đang đi bộ dọc hành lang. (D) Còi báo động khẩn cấp đang nhấp nháy.',
    keyVocabulary: [
      { word: 'Physician', ipa: '/fɪˈzɪʃ.ən/', meaning: 'Bác sĩ điều trị' },
      { word: 'Digital tablet', ipa: '/ˈdɪdʒ.ɪ.təl ˈtæb.lət/', meaning: 'Máy tính bảng điện tử' }
    ]
  },
  {
    id: 'toeic_p1_9',
    part: 'part1_photos',
    skill: 'listening',
    difficulty: 'easy',
    estimatedDifficulty: 320,
    topic: 'Restaurant & Dining',
    subSkill: 'action_identification',
    questionType: 'photo_action',
    vocabularyTags: ['patio', 'serving', 'beverages'],
    grammarTags: ['present_continuous'],
    imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1000&q=80',
    audioScript: 'Look at the picture marked number 9. (A) A server is pouring water at an outdoor table. (B) Diners are paying their bill at a counter. (C) A chef is chopping vegetables in the kitchen. (D) Chairs are stacked against the restaurant wall.',
    questionText: 'Part 1: Nghe 4 nhận định (A, B, C, D) và chọn phương án mô tả chính xác nhất bức ảnh bên dưới.',
    options: [
      'A. A server is pouring water at an outdoor table.',
      'B. Diners are paying their bill at a counter.',
      'C. A chef is chopping vegetables in the kitchen.',
      'D. Chairs are stacked against the restaurant wall.'
    ],
    correctAnswer: 'A',
    explanation: 'Đáp án (A) mô tả đúng người phục vụ (server) đang rót nước cho khách tại bàn ăn ngoài trời.',
    vietnameseTranslation: '(A) Người phục vụ đang rót nước tại một bàn ngoài trời. (B) Thực khách đang thanh toán hóa đơn tại quầy. (C) Đầu bếp đang thái rau trong bếp. (D) Ghế được xếp chồng vào tường nhà hàng.',
    keyVocabulary: [
      { word: 'Server', ipa: '/ˈsɜː.vər/', meaning: 'Người phục vụ bàn' },
      { word: 'Pouring', ipa: '/ˈpɔː.rɪŋ/', meaning: 'Đang rót nước' }
    ]
  },
  {
    id: 'toeic_p1_10',
    part: 'part1_photos',
    skill: 'listening',
    difficulty: 'easy',
    estimatedDifficulty: 350,
    topic: 'Library & Education',
    subSkill: 'human_activity',
    questionType: 'photo_action',
    vocabularyTags: ['bookshelves', 'browsing', 'library'],
    grammarTags: ['present_continuous'],
    imageUrl: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1000&q=80',
    audioScript: 'Look at the picture marked number 10. (A) A woman is selecting a book from a wooden shelf. (B) A librarian is stamping due dates on cards. (C) Books are scattered across the floor. (D) Workers are painting the library ceiling.',
    questionText: 'Part 1: Nghe 4 nhận định (A, B, C, D) và chọn phương án mô tả chính xác nhất bức ảnh bên dưới.',
    options: [
      'A. A woman is selecting a book from a wooden shelf.',
      'B. A librarian is stamping due dates on cards.',
      'C. Books are scattered across the floor.',
      'D. Workers are painting the library ceiling.'
    ],
    correctAnswer: 'A',
    explanation: 'Đáp án (A) mô tả chính xác người phụ nữ đang chọn sách trên giá sách bằng gỗ.',
    vietnameseTranslation: '(A) Một người phụ nữ đang chọn sách từ kệ gỗ. (B) Thủ thư đang đóng dấu ngày trả trên thẻ. (C) Sách vương vãi trên sàn nhà. (D) Công nhân đang sơn trần thư viện.',
    keyVocabulary: [
      { word: 'Selecting', ipa: '/sɪˈlek.tɪŋ/', meaning: 'Đang lựa chọn' },
      { word: 'Shelf', ipa: '/ʃelf/', meaning: 'Kệ, giá sách' }
    ]
  },
  {
    id: 'toeic_p1_11',
    part: 'part1_photos',
    skill: 'listening',
    difficulty: 'easy',
    estimatedDifficulty: 380,
    topic: 'Airport & Travel',
    subSkill: 'walking_motion',
    questionType: 'photo_action',
    vocabularyTags: ['luggage', 'terminal', 'travelers'],
    grammarTags: ['present_continuous'],
    imageUrl: 'https://images.unsplash.com/photo-1530521954074-e64f6810b32d?auto=format&fit=crop&w=1000&q=80',
    audioScript: 'Look at the picture marked number 11. (A) Travelers are pulling suitcases through an airport concourse. (B) Flight attendants are boarding an aircraft. (C) Passengers are passing through a security metal detector. (D) Suitcases are rotating on a baggage carousel.',
    questionText: 'Part 1: Nghe 4 nhận định (A, B, C, D) và chọn phương án mô tả chính xác nhất bức ảnh bên dưới.',
    options: [
      'A. Travelers are pulling suitcases through an airport concourse.',
      'B. Flight attendants are boarding an aircraft.',
      'C. Passengers are passing through a security metal detector.',
      'D. Suitcases are rotating on a baggage carousel.'
    ],
    correctAnswer: 'A',
    explanation: 'Đáp án (A) mô tả đúng hành khách đang kéo vali dọc sảnh sân bay.',
    vietnameseTranslation: '(A) Khách du lịch đang kéo vali qua sảnh nhà ga sân bay. (B) Tiếp viên hàng không đang lên máy bay. (C) Hành khách đang đi qua cổng an ninh kim loại. (D) Vali đang quay trên băng chuyền hành lý.',
    keyVocabulary: [
      { word: 'Suitcase', ipa: '/ˈsuːt.keɪs/', meaning: 'Va li hành lý' },
      { word: 'Concourse', ipa: '/ˈkɒŋ.kɔːs/', meaning: 'Sảnh chờ lớn' }
    ]
  },
  {
    id: 'toeic_p1_12',
    part: 'part1_photos',
    skill: 'listening',
    difficulty: 'easy',
    estimatedDifficulty: 390,
    topic: 'Automotive & Maintenance',
    subSkill: 'equipment_use',
    questionType: 'photo_action',
    vocabularyTags: ['mechanic', 'vehicle', 'inspection'],
    grammarTags: ['present_continuous'],
    imageUrl: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=1000&q=80',
    audioScript: 'Look at the picture marked number 12. (A) A mechanic is examining the underside of a raised automobile. (B) A driver is wiping the windshield of a car. (C) Tires are being loaded into the trunk of a sedan. (D) A customer is filling a gas tank at a pump.',
    questionText: 'Part 1: Nghe 4 nhận định (A, B, C, D) và chọn phương án mô tả chính xác nhất bức ảnh bên dưới.',
    options: [
      'A. A mechanic is examining the underside of a raised automobile.',
      'B. A driver is wiping the windshield of a car.',
      'C. Tires are being loaded into the trunk of a sedan.',
      'D. A customer is filling a gas tank at a pump.'
    ],
    correctAnswer: 'A',
    explanation: 'Đáp án (A) mô tả đúng thợ máy đang kiểm tra gầm chiếc ô tô được nâng lên.',
    vietnameseTranslation: '(A) Thợ máy đang kiểm tra phần dưới của một chiếc ô tô được nâng lên. (B) Tài xế đang lau kính chắn gió xe. (C) Lốp xe đang được chất vào cốp xe. (D) Khách hàng đang đổ xăng tại cây xăng.',
    keyVocabulary: [
      { word: 'Mechanic', ipa: '/məˈkæn.ɪk/', meaning: 'Thợ cơ khí, thợ sửa xe' },
      { word: 'Underside', ipa: '/ˈʌn.də.saɪd/', meaning: 'Mặt dưới, gầm xe' }
    ]
  },
  {
    id: 'toeic_p1_13',
    part: 'part1_photos',
    skill: 'listening',
    difficulty: 'medium',
    estimatedDifficulty: 480,
    topic: 'Hospitality & Hotels',
    subSkill: 'customer_interaction',
    questionType: 'photo_action',
    vocabularyTags: ['receptionist', 'front_desk', 'guest'],
    grammarTags: ['present_continuous'],
    imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=80',
    audioScript: 'Look at the picture marked number 13. (A) A receptionist is handing room keys to a hotel guest. (B) Housekeepers are vacuuming the lobby rug. (C) Suitcases are being wheeled onto an elevator. (D) A guest is signing a restaurant receipt.',
    questionText: 'Part 1: Nghe 4 nhận định (A, B, C, D) và chọn phương án mô tả chính xác nhất bức ảnh bên dưới.',
    options: [
      'A. A receptionist is handing room keys to a hotel guest.',
      'B. Housekeepers are vacuuming the lobby rug.',
      'C. Suitcases are being wheeled onto an elevator.',
      'D. A guest is signing a restaurant receipt.'
    ],
    correctAnswer: 'A',
    explanation: 'Đáp án (A) mô tả đúng nhân viên lễ tân trao chìa khóa phòng cho khách tại quầy.',
    vietnameseTranslation: '(A) Nhân viên lễ tân đang trao chìa khóa phòng cho khách lưu trú. (B) Nhân viên buồng phòng đang hút bụi thảm sảnh. (C) Vali đang được đẩy vào thang máy. (D) Khách đang ký hóa đơn nhà hàng.',
    keyVocabulary: [
      { word: 'Receptionist', ipa: '/rɪˈsep.ʃən.ɪst/', meaning: 'Nhân viên lễ tân' },
      { word: 'Handing', ipa: '/ˈhæn.dɪŋ/', meaning: 'Đang đưa, trao tay' }
    ]
  },
  {
    id: 'toeic_p1_14',
    part: 'part1_photos',
    skill: 'listening',
    difficulty: 'medium',
    estimatedDifficulty: 510,
    topic: 'Manufacturing & Industry',
    subSkill: 'machinery_operation',
    questionType: 'photo_action',
    vocabularyTags: ['machinery', 'assembly_line', 'protective_gear'],
    grammarTags: ['present_continuous'],
    imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1000&q=80',
    audioScript: 'Look at the picture marked number 14. (A) A technician wearing safety glasses is adjusting an industrial machine. (B) Raw materials are stacked by the loading dock. (C) Factory workers are sweeping metal shavings from the floor. (D) Delivery trucks are parked outside the plant.',
    questionText: 'Part 1: Nghe 4 nhận định (A, B, C, D) và chọn phương án mô tả chính xác nhất bức ảnh bên dưới.',
    options: [
      'A. A technician wearing safety glasses is adjusting an industrial machine.',
      'B. Raw materials are stacked by the loading dock.',
      'C. Factory workers are sweeping metal shavings from the floor.',
      'D. Delivery trucks are parked outside the plant.'
    ],
    correctAnswer: 'A',
    explanation: 'Đáp án (A) mô tả đúng kỹ thuật viên đeo kính bảo hộ đang tinh chỉnh máy công nghiệp.',
    vietnameseTranslation: '(A) Kỹ thuật viên đeo kính an toàn đang điều chỉnh một máy công nghiệp. (B) Nguyên liệu thô được xếp chồng gần cầu cảng tải hàng. (C) Công nhân đang quét mạt kim loại. (D) Xe tải giao hàng đỗ ngoài nhà máy.',
    keyVocabulary: [
      { word: 'Technician', ipa: '/tekˈnɪʃ.ən/', meaning: 'Kỹ thuật viên' },
      { word: 'Adjusting', ipa: '/əˈdʒʌs.tɪŋ/', meaning: 'Đang điều chỉnh, căn chỉnh' }
    ]
  },
  {
    id: 'toeic_p1_15',
    part: 'part1_photos',
    skill: 'listening',
    difficulty: 'medium',
    estimatedDifficulty: 530,
    topic: 'Facilities & Landscaping',
    subSkill: 'outdoor_maintenance',
    questionType: 'photo_action',
    vocabularyTags: ['landscaping', 'hedges', 'gardener'],
    grammarTags: ['present_continuous'],
    imageUrl: 'https://images.unsplash.com/photo-1558904541-efa8c4a08931?auto=format&fit=crop&w=1000&q=80',
    audioScript: 'Look at the picture marked number 15. (A) A gardener is trimming bushes along a stone walkway. (B) Potted plants are being arranged on a wooden balcony. (C) Leaves are being gathered with a garden rake. (D) A lawnmower is parked inside a storage shed.',
    questionText: 'Part 1: Nghe 4 nhận định (A, B, C, D) và chọn phương án mô tả chính xác nhất bức ảnh bên dưới.',
    options: [
      'A. A gardener is trimming bushes along a stone walkway.',
      'B. Potted plants are being arranged on a wooden balcony.',
      'C. Leaves are being gathered with a garden rake.',
      'D. A lawnmower is parked inside a storage shed.'
    ],
    correctAnswer: 'A',
    explanation: 'Đáp án (A) mô tả người làm vườn đang cắt tỉa bụi cây dọc theo lối đi lát đá.',
    vietnameseTranslation: '(A) Người làm vườn đang cắt tỉa bụi cây dọc theo lối đi bằng đá. (B) Cây trồng trong chậu đang được sắp xếp trên ban công gỗ. (C) Lá cây đang được cào gom lại. (D) Máy cắt cỏ đỗ trong nhà kho.',
    keyVocabulary: [
      { word: 'Trimming', ipa: '/ˈtrɪm.ɪŋ/', meaning: 'Đang cắt tỉa' },
      { word: 'Walkway', ipa: '/ˈwɔːk.weɪ/', meaning: 'Lối đi dạo, đường đi bộ' }
    ]
  },
  {
    id: 'toeic_p1_16',
    part: 'part1_photos',
    skill: 'listening',
    difficulty: 'medium',
    estimatedDifficulty: 560,
    topic: 'Architecture & Design',
    subSkill: 'workspace_inspection',
    questionType: 'photo_action',
    vocabularyTags: ['architect', 'scale_model', 'blueprints'],
    grammarTags: ['present_continuous'],
    imageUrl: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1000&q=80',
    audioScript: 'Look at the picture marked number 16. (A) An architect is reviewing an architectural scale model on a drafting table. (B) Construction workers are pouring concrete into foundation forms. (C) Framed photographs are being hung along an office wall. (D) Draftspeople are rolling up architectural blueprints.',
    questionText: 'Part 1: Nghe 4 nhận định (A, B, C, D) và chọn phương án mô tả chính xác nhất bức ảnh bên dưới.',
    options: [
      'A. An architect is reviewing an architectural scale model on a drafting table.',
      'B. Construction workers are pouring concrete into foundation forms.',
      'C. Framed photographs are being hung along an office wall.',
      'D. Draftspeople are rolling up architectural blueprints.'
    ],
    correctAnswer: 'A',
    explanation: 'Đáp án (A) mô tả kiến trúc sư đang quan sát mô hình kiến trúc thu nhỏ trên bàn vẽ đồ họa.',
    vietnameseTranslation: '(A) Kiến trúc sư đang xem xét mô hình kiến trúc tỷ lệ trên bàn vẽ. (B) Công nhân xây dựng đang đổ bê tông vào khuôn móng. (C) Ảnh đóng khung đang được treo trên tường. (D) Thợ vẽ đang cuộn bản vẽ lại.',
    keyVocabulary: [
      { word: 'Architect', ipa: '/ˈɑː.kɪ.tekt/', meaning: 'Kiến trúc sư' },
      { word: 'Scale model', ipa: '/skeɪl ˈmɒd.əl/', meaning: 'Mô hình tỷ lệ thu nhỏ' }
    ]
  },
  {
    id: 'toeic_p1_17',
    part: 'part1_photos',
    skill: 'listening',
    difficulty: 'medium',
    estimatedDifficulty: 580,
    topic: 'Shipping & Logistics',
    subSkill: 'scene_overview',
    questionType: 'photo_scene_general',
    vocabularyTags: ['cargo_containers', 'crane', 'harbor'],
    grammarTags: ['passive_state'],
    imageUrl: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=1000&q=80',
    audioScript: 'Look at the picture marked number 17. (A) Intermodal cargo containers are stacked near a harbor dock. (B) Dockworkers are unloading crates from a cargo vessel. (C) Tugboats are towing an oil tanker through the channel. (D) Shipping manifests are being checked by a customs inspector.',
    questionText: 'Part 1: Nghe 4 nhận định (A, B, C, D) và chọn phương án mô tả chính xác nhất bức ảnh bên dưới.',
    options: [
      'A. Intermodal cargo containers are stacked near a harbor dock.',
      'B. Dockworkers are unloading crates from a cargo vessel.',
      'C. Tugboats are towing an oil tanker through the channel.',
      'D. Shipping manifests are being checked by a customs inspector.'
    ],
    correctAnswer: 'A',
    explanation: 'Đáp án (A) mô tả chính xác trạng thái các container hàng hóa xếp tầng tại bến cảng.',
    vietnameseTranslation: '(A) Các thùng container chở hàng được xếp chồng gần bến cảng. (B) Công nhân bốc vác đang dỡ kiện hàng từ tàu. (C) Tàu kéo đang dắt tàu chở dầu qua luồng. (D) Bản kê khai vận chuyển đang được nhân viên hải quan kiểm tra.',
    keyVocabulary: [
      { word: 'Cargo containers', ipa: '/ˈkɑː.ɡəʊ kənˈteɪ.nərz/', meaning: 'Thùng container chở hàng' },
      { word: 'Stacked', ipa: '/stækt/', meaning: 'Được xếp chồng lên nhau' }
    ]
  },
  {
    id: 'toeic_p1_18',
    part: 'part1_photos',
    skill: 'listening',
    difficulty: 'hard',
    estimatedDifficulty: 660,
    topic: 'Science & Laboratory',
    subSkill: 'specialized_action',
    questionType: 'photo_action',
    vocabularyTags: ['microscope', 'researcher', 'laboratory'],
    grammarTags: ['present_continuous'],
    imageUrl: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=1000&q=80',
    audioScript: 'Look at the picture marked number 18. (A) A laboratory researcher is examining a specimen through a microscope. (B) Chemical solutions are being poured into glass test tubes. (C) A protective face shield is resting on the laboratory bench. (D) Glassware is being sanitized in an automated sterilizer.',
    questionText: 'Part 1: Nghe 4 nhận định (A, B, C, D) và chọn phương án mô tả chính xác nhất bức ảnh bên dưới.',
    options: [
      'A. A laboratory researcher is examining a specimen through a microscope.',
      'B. Chemical solutions are being poured into glass test tubes.',
      'C. A protective face shield is resting on the laboratory bench.',
      'D. Glassware is being sanitized in an automated sterilizer.'
    ],
    correctAnswer: 'A',
    explanation: 'Đáp án (A) mô tả nhà nghiên cứu đang quan sát mẫu vật qua kính hiển vi trong phòng thí nghiệm.',
    vietnameseTranslation: '(A) Nhà nghiên cứu phòng thí nghiệm đang kiểm tra mẫu vật qua kính hiển vi. (B) Dung dịch hóa học đang được rót vào ống nghiệm thủy tinh. (C) Mặt nạ bảo hộ đang đặt trên bàn làm việc. (D) Dụng cụ thủy tinh đang được khử trùng trong máy tiệt trùng.',
    keyVocabulary: [
      { word: 'Specimen', ipa: '/ˈspes.ə.mɪn/', meaning: 'Mẫu vật nghiên cứu' },
      { word: 'Microscope', ipa: '/ˈmaɪ.krə.skəʊp/', meaning: 'Kính hiển vi' }
    ]
  },
  {
    id: 'toeic_p1_19',
    part: 'part1_photos',
    skill: 'listening',
    difficulty: 'hard',
    estimatedDifficulty: 690,
    topic: 'Retail & Fashion Boutique',
    subSkill: 'merchandise_display',
    questionType: 'photo_object_placement',
    vocabularyTags: ['mannequins', 'display_window', 'apparel'],
    grammarTags: ['passive_state'],
    imageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1000&q=80',
    audioScript: 'Look at the picture marked number 19. (A) Mannequins dressed in seasonal outerwear are positioned in a storefront window. (B) A sales associate is steaming garments behind the register. (C) Price tags are being affixed to designer handbags. (D) Coat hangers are lying on the boutique floor.',
    questionText: 'Part 1: Nghe 4 nhận định (A, B, C, D) và chọn phương án mô tả chính xác nhất bức ảnh bên dưới.',
    options: [
      'A. Mannequins dressed in seasonal outerwear are positioned in a storefront window.',
      'B. A sales associate is steaming garments behind the register.',
      'C. Price tags are being affixed to designer handbags.',
      'D. Coat hangers are lying on the boutique floor.'
    ],
    correctAnswer: 'A',
    explanation: 'Đáp án (A) mô tả đúng các ma-nơ-canh mặc áo khoác theo mùa được trưng bày tại cửa kính cửa hàng.',
    vietnameseTranslation: '(A) Ma-nơ-canh mặc áo khoác theo mùa được bố trí ở cửa sổ trưng bày cửa hàng. (B) Nhân viên bán hàng đang là hơi quần áo. (C) Nhãn giá đang được gắn vào túi xách. (D) Móc áo đang nằm trên sàn cửa hàng.',
    keyVocabulary: [
      { word: 'Mannequins', ipa: '/ˈmæn.ə.kɪnz/', meaning: 'Tượng mẫu ma-nơ-canh' },
      { word: 'Storefront window', ipa: '/ˈstɔː.frʌnt ˈwɪn.dəʊ/', meaning: 'Cửa sổ kính trưng bày mặt tiền' }
    ]
  },
  {
    id: 'toeic_p1_20',
    part: 'part1_photos',
    skill: 'listening',
    difficulty: 'hard',
    estimatedDifficulty: 720,
    topic: 'Corporate Facilities',
    subSkill: 'scene_interior',
    questionType: 'photo_scene_general',
    vocabularyTags: ['boardroom', 'conference_chairs', 'natural_light'],
    grammarTags: ['passive_state'],
    imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1000&q=80',
    audioScript: 'Look at the picture marked number 20. (A) Sunlight illuminates an empty conference table surrounded by executive chairs. (B) Projection screens are being lowered from the boardroom ceiling. (C) Whiteboard markers are arranged inside a plastic tray. (D) Participants are gathering around a speaker podium.',
    questionText: 'Part 1: Nghe 4 nhận định (A, B, C, D) và chọn phương án mô tả chính xác nhất bức ảnh bên dưới.',
    options: [
      'A. Sunlight illuminates an empty conference table surrounded by executive chairs.',
      'B. Projection screens are being lowered from the boardroom ceiling.',
      'C. Whiteboard markers are arranged inside a plastic tray.',
      'D. Participants are gathering around a speaker podium.'
    ],
    correctAnswer: 'A',
    explanation: 'Đáp án (A) miêu tả tĩnh cảnh phòng họp vắng người với ánh nắng chiếu lên bàn hội nghị có dàn ghế bao quanh.',
    vietnameseTranslation: '(A) Ánh nắng chiếu sáng bàn hội nghị trống được bao quanh bởi các ghế lãnh đạo. (B) Màn chiếu đang được hạ xuống từ trần phòng họp. (C) Bút dạ bảng trắng được sắp trong khay nhựa. (D) Người tham dự đang tập trung quanh bục phát biểu.',
    keyVocabulary: [
      { word: 'Illuminates', ipa: '/ɪˈluː.mɪ.neɪts/', meaning: 'Chiếu sáng, rọi sáng' },
      { word: 'Executive chairs', ipa: '/ɪɡˈzek.jə.tɪv tʃeəz/', meaning: 'Ghế xoay văn phòng cao cấp' }
    ]
  },

  // ===========================================================================
  // PART 2: QUESTION & RESPONSE (LISTENING - 30 QUESTIONS, 3 OPTIONS A-C)
  // ===========================================================================
  {
    id: 'toeic_p2_1',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'easy',
    topic: 'Corporate Events',
    subSkill: 'location_query',
    questionType: 'wh_question',
    vocabularyTags: ['shareholders', 'conference', 'meeting'],
    grammarTags: ['wh_where'],
    estimatedDifficulty: 350,
    audioScript: 'Where is the annual shareholders meeting being held this year? (A) In Conference Room B on the second floor. (B) Yes, it was very productive. (C) At ten o’clock tomorrow morning.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. In Conference Room B on the second floor.',
      'B. Yes, it was very productive.',
      'C. At ten o’clock tomorrow morning.'
    ],
    correctAnswer: 'A',
    explanation: 'Câu hỏi bắt đầu bằng "Where" hỏi địa điểm. Đáp án (A) trả lời chính xác vị trí phòng họp.',
    vietnameseTranslation: 'Cuộc họp cổ đông thường niên năm nay tổ chức ở đâu? (A) Tại phòng họp B tầng 2. (B) Vâng, rất hiệu quả. (C) Lúc 10 giờ sáng mai.',
    keyVocabulary: [
      { word: 'Shareholders', ipa: '/ˈʃeəˌhəʊl.dərz/', meaning: 'Cổ đông' },
      { word: 'Conference', ipa: '/ˈkɒn.fər.əns/', meaning: 'Hội nghị' }
    ]
  },
  {
    id: 'toeic_p2_2',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'medium',
    topic: 'Management & Budget',
    subSkill: 'polite_request',
    questionType: 'offer_request',
    vocabularyTags: ['proposal', 'review', 'budget'],
    grammarTags: ['modal_verbs'],
    estimatedDifficulty: 450,
    audioScript: 'Could you review this budget proposal before the board meeting? (A) Yes, I’ll take a look right after lunch. (B) The board was made of wood. (C) About fifty dollars per ticket.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. Yes, I’ll take a look right after lunch.',
      'B. The board was made of wood.',
      'C. About fifty dollars per ticket.'
    ],
    correctAnswer: 'A',
    explanation: 'Câu yêu cầu lịch sự "Could you review...?", (A) thể hiện sự đồng ý kèm thời gian biểu hợp lý.',
    vietnameseTranslation: 'Bạn xem qua bản đề xuất ngân sách này trước cuộc họp hội đồng được không? (A) Được chứ, tôi sẽ xem ngay sau bữa trưa.',
    keyVocabulary: [
      { word: 'Proposal', ipa: '/prəˈpəʊ.zəl/', meaning: 'Đề xuất' },
      { word: 'Review', ipa: '/rɪˈvjuː/', meaning: 'Xem xét' }
    ]
  },
  {
    id: 'toeic_p2_3',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'easy',
    topic: 'Supply Chain & Logistics',
    subSkill: 'time_query',
    questionType: 'wh_question',
    vocabularyTags: ['inventory', 'warehouse', 'shipment'],
    grammarTags: ['wh_when'],
    estimatedDifficulty: 380,
    audioScript: 'When will the new inventory shipment arrive at our warehouse? (A) Early next Tuesday morning. (B) Yes, the invoice was paid. (C) By express courier service.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. Early next Tuesday morning.',
      'B. Yes, the invoice was paid.',
      'C. By express courier service.'
    ],
    correctAnswer: 'A',
    explanation: 'Câu hỏi "When" hỏi thời gian. Đáp án (A) chỉ mốc thời gian sáng sớm thứ Ba tuần tới.',
    vietnameseTranslation: 'Khi nào lô hàng tồn kho mới đến kho? (A) Sáng sớm thứ Ba tuần tới.',
    keyVocabulary: [
      { word: 'Inventory', ipa: '/ˈɪn.vən.tər.i/', meaning: 'Hàng tồn kho' },
      { word: 'Warehouse', ipa: '/ˈweə.haʊs/', meaning: 'Kho bãi' }
    ]
  },
  {
    id: 'toeic_p2_4',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'medium',
    topic: 'Human Resources',
    subSkill: 'personnel_identification',
    questionType: 'wh_question',
    vocabularyTags: ['responsible', 'regional', 'organization'],
    grammarTags: ['wh_who'],
    estimatedDifficulty: 480,
    audioScript: 'Who is responsible for organizing the regional sales conference? (A) Ms. Patterson from Human Resources. (B) In the grand auditorium downtown. (C) It starts at nine o’clock.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. Ms. Patterson from Human Resources.',
      'B. In the grand auditorium downtown.',
      'C. It starts at nine o’clock.'
    ],
    correctAnswer: 'A',
    explanation: 'Câu hỏi "Who is responsible" hỏi nhân sự chịu trách nhiệm. (A) chỉ đích danh cô Patterson phòng Nhân sự.',
    vietnameseTranslation: 'Ai chịu trách nhiệm tổ chức hội nghị bán hàng khu vực? (A) Cô Patterson phòng Nhân sự.',
    keyVocabulary: [
      { word: 'Responsible', ipa: '/rɪˈspɒn.sə.bəl/', meaning: 'Chịu trách nhiệm' },
      { word: 'Regional', ipa: '/ˈriː.dʒən.əl/', meaning: 'Khu vực' }
    ]
  },
  {
    id: 'toeic_p2_5',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'medium',
    topic: 'Corporate Meetings',
    subSkill: 'reason_query',
    questionType: 'wh_question',
    vocabularyTags: ['rescheduled', 'marketing', 'conflict'],
    grammarTags: ['wh_why', 'passive_voice'],
    estimatedDifficulty: 460,
    audioScript: 'Why was the quarterly marketing meeting rescheduled? (A) Several team leads had scheduling conflicts. (B) At three o’clock in the afternoon. (C) Yes, it was very informative.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. Several team leads had scheduling conflicts.',
      'B. At three o’clock in the afternoon.',
      'C. Yes, it was very informative.'
    ],
    correctAnswer: 'A',
    explanation: 'Câu hỏi bắt đầu bằng "Why" hỏi nguyên nhân dời lịch. Đáp án (A) đưa ra lý do một số trưởng nhóm bị trùng lịch.',
    vietnameseTranslation: 'Tại sao cuộc họp tiếp thị hàng quý lại bị đổi lịch? (A) Một số trưởng nhóm bị trùng lịch làm việc.',
    keyVocabulary: [
      { word: 'Rescheduled', ipa: '/ˌriːˈskedʒ.uːld/', meaning: 'Được dời lịch lại' },
      { word: 'Conflicts', ipa: '/ˈkɒn.flɪkts/', meaning: 'Sự xung đột / trùng lặp thời gian' }
    ]
  },
  {
    id: 'toeic_p2_6',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'easy',
    topic: 'Client Contracts',
    subSkill: 'status_confirmation',
    questionType: 'yes_no_question',
    vocabularyTags: ['signed', 'maintenance', 'contract'],
    grammarTags: ['present_perfect'],
    estimatedDifficulty: 370,
    audioScript: 'Has the client signed the software maintenance agreement yet? (A) Yes, their legal team sent it over this morning. (B) In the software development lab. (C) About forty dollars per user.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. Yes, their legal team sent it over this morning.',
      'B. In the software development lab.',
      'C. About forty dollars per user.'
    ],
    correctAnswer: 'A',
    explanation: 'Câu hỏi Yes/No với "Has the client signed...?", (A) khẳng định đã ký và gửi sang sáng nay.',
    vietnameseTranslation: 'Khách hàng đã ký hợp đồng bảo trì phần mềm chưa? (A) Rồi, bộ phận pháp lý của họ đã gửi sang sáng nay.',
    keyVocabulary: [
      { word: 'Agreement', ipa: '/əˈɡriː.mənt/', meaning: 'Hợp đồng, thỏa thuận' },
      { word: 'Legal team', ipa: '/ˈliː.ɡəl tiːm/', meaning: 'Bộ phận pháp chế' }
    ]
  },
  {
    id: 'toeic_p2_7',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'medium',
    topic: 'Facilities Management',
    subSkill: 'frequency_query',
    questionType: 'wh_question',
    vocabularyTags: ['inspect', 'emergency', 'generators'],
    grammarTags: ['wh_how_often'],
    estimatedDifficulty: 510,
    audioScript: 'How often do we inspect the emergency backup generators? (A) Once every six months. (B) To conserve building electricity. (C) The technician is from Dallas.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. Once every six months.',
      'B. To conserve building electricity.',
      'C. The technician is from Dallas.'
    ],
    correctAnswer: 'A',
    explanation: 'Câu hỏi "How often" hỏi tần suất. Đáp án (A) trả lời chuẩn xác tần suất định kỳ: "Once every six months" (6 tháng 1 lần).',
    vietnameseTranslation: 'Bao lâu thì chúng ta kiểm tra máy phát điện dự phòng khẩn cấp một lần? (A) Định kỳ sáu tháng một lần.',
    keyVocabulary: [
      { word: 'Inspect', ipa: '/ɪnˈspekt/', meaning: 'Thanh tra, kiểm tra kỹ thuật' },
      { word: 'Generators', ipa: '/ˈdʒen.ər.eɪ.tərz/', meaning: 'Máy phát điện' }
    ]
  },
  {
    id: 'toeic_p2_8',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'easy',
    topic: 'Business Travel',
    subSkill: 'preference_selection',
    questionType: 'offer_request',
    vocabularyTags: ['prefer', 'window_seat', 'aisle_seat'],
    grammarTags: ['would_prefer_or'],
    estimatedDifficulty: 360,
    audioScript: 'Would you prefer a window seat or an aisle seat for your flight? (A) An aisle seat, so I can stretch my legs. (B) Tomorrow afternoon at four. (C) Yes, the ticket was printed.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. An aisle seat, so I can stretch my legs.',
      'B. Tomorrow afternoon at four.',
      'C. Yes, the ticket was printed.'
    ],
    correctAnswer: 'A',
    explanation: 'Câu hỏi lựa chọn giữa 2 phương án A hoặc B ("window seat or aisle seat"), chọn (A) trả lời rõ ràng ghế lối đi.',
    vietnameseTranslation: 'Bạn thích ghế cạnh cửa sổ hay ghế cạnh lối đi cho chuyến bay? (A) Ghế cạnh lối đi, để tôi có thể duỗi chân.',
    keyVocabulary: [
      { word: 'Aisle seat', ipa: '/aɪl siːt/', meaning: 'Ghế ngồi cạnh lối đi' },
      { word: 'Prefer', ipa: '/prɪˈfɜːr/', meaning: 'Ưu tiên, thích hơn' }
    ]
  },
  {
    id: 'toeic_p2_9',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'medium',
    topic: 'HR & Payroll',
    subSkill: 'contact_direction',
    questionType: 'wh_question',
    vocabularyTags: ['payroll', 'discrepancies', 'finance'],
    grammarTags: ['modal_should', 'wh_who'],
    estimatedDifficulty: 490,
    audioScript: 'Who should I contact regarding the recent payroll discrepancies? (A) Talk to Carlos in the accounting division. (B) Over two hundred dollars extra. (C) Direct deposit is available.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. Talk to Carlos in the accounting division.',
      'B. Over two hundred dollars extra.',
      'C. Direct deposit is available.'
    ],
    correctAnswer: 'A',
    explanation: 'Câu hỏi "Who should I contact...?" hỏi đối tượng cần liên hệ. (A) hướng dẫn gặp Carlos phòng Kế toán.',
    vietnameseTranslation: 'Tôi nên liên hệ với ai về các sai lệch bảng lương gần đây? (A) Hãy trao đổi với Carlos ở phòng kế toán.',
    keyVocabulary: [
      { word: 'Payroll', ipa: '/ˈpeɪ.rəʊl/', meaning: 'Bảng lương, chi trả tiền lương' },
      { word: 'Discrepancies', ipa: '/dɪˈskrep.ən.siz/', meaning: 'Những điểm sai lệch, không khớp' }
    ]
  },
  {
    id: 'toeic_p2_10',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'medium',
    topic: 'Office Supplies',
    subSkill: 'suggestion_verification',
    questionType: 'statement_response',
    vocabularyTags: ['printer', 'cartridges', 'supplies'],
    grammarTags: ['negative_question'],
    estimatedDifficulty: 470,
    audioScript: 'Shouldn’t we order more printer paper before the weekend? (A) Good idea, our supply closet is nearly empty. (B) No, the printer is unplugged. (C) It prints forty pages per minute.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. Good idea, our supply closet is nearly empty.',
      'B. No, the printer is unplugged.',
      'C. It prints forty pages per minute.'
    ],
    correctAnswer: 'A',
    explanation: 'Câu hỏi phủ định dạng đề xuất "Shouldn’t we order...?", (A) đồng ý với đề xuất và giải thích tủ đựng đồ sắp hết giấy.',
    vietnameseTranslation: 'Chẳng phải chúng ta nên đặt thêm giấy in trước cuối tuần sao? (A) Ý kiến hay đấy, tủ vật tư gần như hết nhẵn rồi.',
    keyVocabulary: [
      { word: 'Supplies', ipa: '/səˈplaɪz/', meaning: 'Đồ dùng văn phòng phẩm, vật tư' },
      { word: 'Closet', ipa: '/ˈklɒz.ɪt/', meaning: 'Tủ chứa đồ' }
    ]
  },
  {
    id: 'toeic_p2_11',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'easy',
    topic: 'Professional Training',
    subSkill: 'event_attendance',
    questionType: 'yes_no_question',
    vocabularyTags: ['cybersecurity', 'workshop', 'mandatory'],
    grammarTags: ['past_simple'],
    estimatedDifficulty: 390,
    audioScript: 'Did you attend the cybersecurity seminar yesterday afternoon? (A) Unfortunately no, I was stuck on a client call. (B) The password must contain eight characters. (C) In the auditorium next Tuesday.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. Unfortunately no, I was stuck on a client call.',
      'B. The password must contain eight characters.',
      'C. In the auditorium next Tuesday.'
    ],
    correctAnswer: 'A',
    explanation: 'Câu hỏi "Did you attend...?", (A) trả lời chân thực lý do không tham dự được vì bận gọi điện với khách.',
    vietnameseTranslation: 'Hôm qua bạn có tham gia buổi hội thảo an ninh mạng không? (A) Rất tiếc là không, tôi bị vướng cuộc gọi với khách hàng.',
    keyVocabulary: [
      { word: 'Cybersecurity', ipa: '/ˌsaɪ.bə.sɪˈkjʊə.rə.ti/', meaning: 'An ninh mạng' },
      { word: 'Seminar', ipa: '/ˈsem.ɪ.nɑːr/', meaning: 'Hội thảo chuyên đề' }
    ]
  },
  {
    id: 'toeic_p2_12',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'hard',
    topic: 'Financial Auditing',
    subSkill: 'indirect_agreement',
    questionType: 'indirect_response',
    vocabularyTags: ['audit', 'deadline', 'extension'],
    grammarTags: ['indirect_inference', 'negative_statement'],
    estimatedDifficulty: 710,
    audioScript: 'I don’t think our audit team can complete the compliance report by five today. (A) Let’s ask Mr. Vance for an extension until tomorrow morning. (B) Yes, the numbers were verified. (C) He works in the compliance office.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. Let’s ask Mr. Vance for an extension until tomorrow morning.',
      'B. Yes, the numbers were verified.',
      'C. He works in the compliance office.'
    ],
    correctAnswer: 'A',
    explanation: 'Câu nhận định về việc không kịp hạn chót (deadline). Phản hồi gián tiếp hợp lý nhất là đề xuất xin gia hạn (extension) từ cấp quản lý.',
    vietnameseTranslation: 'Tôi không nghĩ đội kiểm toán có thể hoàn thành báo cáo tuân thủ trước 5 giờ chiều nay. (A) Hãy xin ông Vance gia hạn đến sáng mai.',
    keyVocabulary: [
      { word: 'Compliance', ipa: '/kəmˈplaɪ.əns/', meaning: 'Sự tuân thủ quy chuẩn pháp lý' },
      { word: 'Extension', ipa: '/ɪkˈsten.ʃən/', meaning: 'Sự gia hạn thời gian' }
    ]
  },
  {
    id: 'toeic_p2_13',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'easy',
    estimatedDifficulty: 340,
    topic: 'Software & Technology',
    subSkill: 'schedule_inquiry',
    questionType: 'wh_question',
    vocabularyTags: ['software', 'launch', 'schedule'],
    grammarTags: ['wh_when'],
    audioScript: 'When is the new software update scheduled to launch? (A) Next Monday morning at nine o’clock. (B) Yes, the download is very fast. (C) In the primary IT server room.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. Next Monday morning at nine o’clock.',
      'B. Yes, the download is very fast.',
      'C. In the primary IT server room.'
    ],
    correctAnswer: 'A',
    explanation: 'Câu hỏi "When" hỏi về thời gian. Phương án (A) trả lời chính xác thời điểm ra mắt.',
    vietnameseTranslation: 'Khi nào bản cập nhật phần mềm mới dự kiến ra mắt? (A) Sáng thứ Hai tới lúc 9 giờ. (B) Vâng, tải xuống rất nhanh. (C) Trong phòng máy chủ IT chính.',
    keyVocabulary: [
      { word: 'Launch', ipa: '/lɔːntʃ/', meaning: 'Ra mắt, phát hành' },
      { word: 'Scheduled', ipa: '/ˈʃedʒ.uːld/', meaning: 'Được lên lịch trình' }
    ]
  },
  {
    id: 'toeic_p2_14',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'easy',
    estimatedDifficulty: 360,
    topic: 'Finance & Reimbursement',
    subSkill: 'personnel_inquiry',
    questionType: 'wh_question',
    vocabularyTags: ['reimbursement', 'voucher', 'approved'],
    grammarTags: ['wh_who', 'past_simple'],
    audioScript: 'Who approved the travel reimbursement voucher? (A) Director Sanchez signed off on it. (B) To Chicago for the international sales expo. (C) By priority express courier.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. Director Sanchez signed off on it.',
      'B. To Chicago for the international sales expo.',
      'C. By priority express courier.'
    ],
    correctAnswer: 'A',
    explanation: 'Câu hỏi "Who" hỏi người phê duyệt. Phương án (A) chỉ đích danh Giám đốc Sanchez đã ký duyệt.',
    vietnameseTranslation: 'Ai đã duyệt phiếu bồi hoàn chi phí công tác? (A) Giám đốc Sanchez đã ký duyệt. (B) Đến Chicago dự hội chợ. (C) Bằng chuyển phát nhanh ưu tiên.',
    keyVocabulary: [
      { word: 'Voucher', ipa: '/ˈvaʊ.tʃər/', meaning: 'Chứng từ, phiếu thanh toán' },
      { word: 'Signed off', ipa: '/saɪnd ɒf/', meaning: 'Ký duyệt chính thức' }
    ]
  },
  {
    id: 'toeic_p2_15',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'easy',
    estimatedDifficulty: 380,
    topic: 'Recruitment & Staffing',
    subSkill: 'quantity_inquiry',
    questionType: 'wh_question',
    vocabularyTags: ['interns', 'marketing', 'undergraduate'],
    grammarTags: ['wh_how_many'],
    audioScript: 'How many interns will be joining our marketing department this summer? (A) We hired three undergraduate students. (B) Yes, our marketing division is expanding. (C) It costs about five hundred dollars.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. We hired three undergraduate students.',
      'B. Yes, our marketing division is expanding.',
      'C. It costs about five hundred dollars.'
    ],
    correctAnswer: 'A',
    explanation: 'Câu hỏi "How many" hỏi số lượng thực tập sinh. Phương án (A) trả lời đã tuyển 3 sinh viên.',
    vietnameseTranslation: 'Có bao nhiêu thực tập sinh sẽ gia nhập phòng marketing hè này? (A) Chúng tôi đã tuyển ba sinh viên đại học. (B) Vâng, bộ phận đang mở rộng. (C) Nó tốn khoảng 500 đô la.',
    keyVocabulary: [
      { word: 'Interns', ipa: '/ˈɪn.tɜːnz/', meaning: 'Thực tập sinh' },
      { word: 'Undergraduate', ipa: '/ˌʌn.dəˈɡrædʒ.u.ət/', meaning: 'Sinh viên chưa tốt nghiệp' }
    ]
  },
  {
    id: 'toeic_p2_16',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'easy',
    estimatedDifficulty: 390,
    topic: 'Client Correspondence',
    subSkill: 'confirmation_inquiry',
    questionType: 'yes_no_question',
    vocabularyTags: ['confirmation', 'contract', 'inbox'],
    grammarTags: ['auxiliary_did'],
    audioScript: 'Did you receive the client’s confirmation email regarding the contract? (A) Yes, it arrived in my inbox this morning. (B) The printer is out of paper. (C) The contract is forty pages long.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. Yes, it arrived in my inbox this morning.',
      'B. The printer is out of paper.',
      'C. The contract is forty pages long.'
    ],
    correctAnswer: 'A',
    explanation: 'Câu hỏi Yes/No "Did you receive...?", phương án (A) xác nhận đã nhận được email vào sáng nay.',
    vietnameseTranslation: 'Bạn đã nhận được email xác nhận của khách hàng về hợp đồng chưa? (A) Rồi, nó vừa vào hộp thư sáng nay. (B) Máy in hết giấy. (C) Hợp đồng dài 40 trang.',
    keyVocabulary: [
      { word: 'Confirmation', ipa: '/ˌkɒn.fəˈmeɪ.ʃən/', meaning: 'Sự xác nhận' },
      { word: 'Inbox', ipa: '/ˈɪn.bɒks/', meaning: 'Hộp thư đến' }
    ]
  },
  {
    id: 'toeic_p2_17',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'easy',
    estimatedDifficulty: 410,
    topic: 'Transportation & Travel',
    subSkill: 'alternative_choice',
    questionType: 'choice_question',
    vocabularyTags: ['shuttle', 'taxi', 'expo'],
    grammarTags: ['choice_or'],
    audioScript: 'Would you prefer to take the express shuttle or hail a taxi to the convention center? (A) The shuttle is much cheaper and more convenient. (B) Yes, I prefer both of them. (C) The convention begins tomorrow at noon.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. The shuttle is much cheaper and more convenient.',
      'B. Yes, I prefer both of them.',
      'C. The convention begins tomorrow at noon.'
    ],
    correctAnswer: 'A',
    explanation: 'Câu hỏi lựa chọn "A or B". (A) chọn đi xe đưa đón (shuttle) và nêu lý do tiết kiệm, thuận tiện.',
    vietnameseTranslation: 'Bạn muốn đi xe buýt nhanh hay bắt taxi đến trung tâm hội nghị? (A) Xe đưa đón rẻ hơn và tiện hơn nhiều. (B) Vâng, tôi thích cả hai. (C) Hội nghị bắt đầu trưa mai.',
    keyVocabulary: [
      { word: 'Shuttle', ipa: '/ˈʃʌt.əl/', meaning: 'Xe buýt đưa đón chặng ngắn' },
      { word: 'Hail a taxi', ipa: '/heɪl ə ˈtæk.si/', meaning: 'Vẫy xe taxi' }
    ]
  },
  {
    id: 'toeic_p2_18',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'medium',
    estimatedDifficulty: 480,
    topic: 'Company Celebrations',
    subSkill: 'suggestion_acceptance',
    questionType: 'suggestion_response',
    vocabularyTags: ['private_room', 'retirement', 'banquet'],
    grammarTags: ['suggestion_why_not'],
    audioScript: 'Why don’t we reserve a private dining room for the retirement celebration? (A) That sounds like a wonderful idea. (B) He retired fifteen years ago. (C) Room service is available on the third floor.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. That sounds like a wonderful idea.',
      'B. He retired fifteen years ago.',
      'C. Room service is available on the third floor.'
    ],
    correctAnswer: 'A',
    explanation: 'Đề xuất "Why don’t we...?". Phương án (A) đồng tình nhiệt tình với ý tưởng đặt phòng ăn riêng.',
    vietnameseTranslation: 'Tại sao chúng ta không đặt một phòng ăn riêng cho bữa tiệc nghỉ hưu nhỉ? (A) Nghe có vẻ là một ý tưởng tuyệt vời. (B) Ông ấy nghỉ hưu 15 năm trước. (C) Dịch vụ phòng ở tầng ba.',
    keyVocabulary: [
      { word: 'Retirement', ipa: '/rɪˈtaɪə.mənt/', meaning: 'Sự nghỉ hưu' },
      { word: 'Reserve', ipa: '/rɪˈzɜːv/', meaning: 'Đặt chỗ trước' }
    ]
  },
  {
    id: 'toeic_p2_19',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'medium',
    estimatedDifficulty: 510,
    topic: 'Corporate Hospitality',
    subSkill: 'polite_request_response',
    questionType: 'request_response',
    vocabularyTags: ['delegates', 'seminar_hall', 'guide'],
    grammarTags: ['modal_could', 'polite_request'],
    audioScript: 'Could you show the visiting delegates where the seminar hall is located? (A) Certainly, I can guide them right now. (B) The delegates visited Munich last autumn. (C) No, the package wasn’t heavy at all.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. Certainly, I can guide them right now.',
      'B. The delegates visited Munich last autumn.',
      'C. No, the package wasn’t heavy at all.'
    ],
    correctAnswer: 'A',
    explanation: 'Lời nhờ lịch sự "Could you show...?". (A) đồng ý dẫn đoàn đại biểu đi ngay.',
    vietnameseTranslation: 'Bạn có thể chỉ cho các đại biểu đang đến thăm phòng hội thảo ở đâu không? (A) Chắc chắn rồi, tôi có thể dẫn họ đi ngay. (B) Các đại biểu đã thăm Munich mùa thu trước. (C) Kiện hàng không nặng.',
    keyVocabulary: [
      { word: 'Delegates', ipa: '/ˈdel.ɪ.ɡəts/', meaning: 'Đại biểu' },
      { word: 'Seminar hall', ipa: '/ˈsem.ɪ.nɑːr hɔːl/', meaning: 'Hội trường hội thảo' }
    ]
  },
  {
    id: 'toeic_p2_20',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'medium',
    estimatedDifficulty: 530,
    topic: 'Accounting & Taxation',
    subSkill: 'verification_response',
    questionType: 'negative_question',
    vocabularyTags: ['quarterly', 'tax_returns', 'filed'],
    grammarTags: ['negative_question', 'present_perfect'],
    audioScript: 'Haven’t the quarterly tax returns been submitted already? (A) Our accounting firm filed them yesterday afternoon. (B) Please return the room key to the front desk. (C) Twenty percent corporate income tax.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. Our accounting firm filed them yesterday afternoon.',
      'B. Please return the room key to the front desk.',
      'C. Twenty percent corporate income tax.'
    ],
    correctAnswer: 'A',
    explanation: 'Câu hỏi phủ định "Haven’t... been submitted...?". (A) xác nhận công ty kế toán đã nộp vào chiều qua.',
    vietnameseTranslation: 'Chẳng phải tờ khai thuế hàng quý đã được nộp rồi sao? (A) Công ty kế toán đã nộp chiều qua rồi. (B) Xin trả chìa khóa tại quầy. (C) 20% thuế thu nhập doanh nghiệp.',
    keyVocabulary: [
      { word: 'Tax returns', ipa: '/tæks rɪˈtɜːnz/', meaning: 'Hồ sơ khai thuế' },
      { word: 'Filed', ipa: '/faɪld/', meaning: 'Đã nộp, đệ trình hồ sơ' }
    ]
  },
  {
    id: 'toeic_p2_21',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'medium',
    estimatedDifficulty: 550,
    topic: 'Office Facilities',
    subSkill: 'problem_resolution',
    questionType: 'statement_response',
    vocabularyTags: ['air_conditioning', 'maintenance', 'buzzing'],
    grammarTags: ['statement_action'],
    audioScript: 'The air conditioning unit in Meeting Room C is making a loud buzzing noise. (A) I will contact building maintenance right away. (B) Yes, the meeting was adjourned early. (C) Please turn left at the central corridor.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. I will contact building maintenance right away.',
      'B. Yes, the meeting was adjourned early.',
      'C. Please turn left at the central corridor.'
    ],
    correctAnswer: 'A',
    explanation: 'Câu trần thuật thông báo sự cố điều hòa. (A) đưa ra hành động khắc phục là gọi đội bảo trì toà nhà.',
    vietnameseTranslation: 'Máy điều hòa trong Phòng họp C đang phát ra tiếng kêu vo vo rất to. (A) Tôi sẽ liên hệ bộ phận bảo trì tòa nhà ngay. (B) Cuộc họp đã bế mạc sớm. (C) Rẽ trái ở hành lang trung tâm.',
    keyVocabulary: [
      { word: 'Buzzing', ipa: '/ˈbʌz.ɪŋ/', meaning: 'Tiếng kêu vo ve, rù rù' },
      { word: 'Maintenance', ipa: '/ˈmeɪn.tən.əns/', meaning: 'Bảo trì, sửa chữa' }
    ]
  },
  {
    id: 'toeic_p2_22',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'medium',
    estimatedDifficulty: 570,
    topic: 'Business Travel',
    subSkill: 'reason_inquiry',
    questionType: 'wh_question',
    vocabularyTags: ['reschedule', 'keynote', 'postponed'],
    grammarTags: ['wh_why', 'past_simple'],
    audioScript: 'Why did the regional sales director reschedule her flight to Frankfurt? (A) Her keynote session was postponed until Friday. (B) Flight number LH404 at Gate B12. (C) Economy class with priority boarding.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. Her keynote session was postponed until Friday.',
      'B. Flight number LH404 at Gate B12.',
      'C. Economy class with priority boarding.'
    ],
    correctAnswer: 'A',
    explanation: 'Câu hỏi "Why" hỏi nguyên nhân dời chuyến bay. (A) giải thích vì phiên thuyết trình bị hoãn đến thứ Sáu.',
    vietnameseTranslation: 'Tại sao giám đốc bán hàng khu vực lại đổi lịch chuyến bay đến Frankfurt? (A) Phiên thuyết trình chính của cô ấy bị hoãn đến thứ Sáu. (B) Chuyến bay LH404 tại Cổng B12. (C) Hạng phổ thông kèm ưu tiên.',
    keyVocabulary: [
      { word: 'Reschedule', ipa: '/ˌriːˈʃedʒ.uːl/', meaning: 'Dời lại lịch trình' },
      { word: 'Postponed', ipa: '/pəʊstˈpəʊnd/', meaning: 'Bị hoãn lại' }
    ]
  },
  {
    id: 'toeic_p2_23',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'medium',
    estimatedDifficulty: 590,
    topic: 'Research & Biotechnology',
    subSkill: 'duration_inquiry',
    questionType: 'wh_question',
    vocabularyTags: ['biotechnology', 'decade', 'research'],
    grammarTags: ['wh_how_long', 'present_perfect_continuous'],
    audioScript: 'How long has Dr. Patel been conducting research at the biotechnology institute? (A) For nearly a decade now. (B) The laboratory is situated on the fourth floor. (C) The report spans around two hundred pages.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. For nearly a decade now.',
      'B. The laboratory is situated on the fourth floor.',
      'C. The report spans around two hundred pages.'
    ],
    correctAnswer: 'A',
    explanation: 'Câu hỏi "How long" hỏi khoảng thời gian. (A) trả lời "For nearly a decade now" (gần một thập kỷ).',
    vietnameseTranslation: 'Bác sĩ Patel đã tiến hành nghiên cứu tại viện công nghệ sinh học được bao lâu rồi? (A) Được gần một thập kỷ rồi. (B) Phòng thí nghiệm ở tầng 4. (C) Báo cáo dài 200 trang.',
    keyVocabulary: [
      { word: 'Decade', ipa: '/ˈdek.eɪd/', meaning: 'Thập kỷ (10 năm)' },
      { word: 'Conducting', ipa: '/kənˈdʌk.tɪŋ/', meaning: 'Đang tiến hành, thực hiện' }
    ]
  },
  {
    id: 'toeic_p2_24',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'medium',
    estimatedDifficulty: 600,
    topic: 'Facilities Management',
    subSkill: 'tag_question_confirmation',
    questionType: 'statement_response',
    vocabularyTags: ['repaved', 'parking_lot', 'weather'],
    grammarTags: ['tag_question', 'present_perfect'],
    audioScript: 'The maintenance crew hasn’t repaved the visitor parking lot yet, have they? (A) No, they are waiting for dry weather conditions. (B) Yes, parking is complimentary for guests. (C) Three service vans are parked outside.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. No, they are waiting for dry weather conditions.',
      'B. Yes, parking is complimentary for guests.',
      'C. Three service vans are parked outside.'
    ],
    correctAnswer: 'A',
    explanation: 'Câu hỏi đuôi "hasn’t... have they?". (A) xác nhận chưa làm vì đang đợi thời tiết khô ráo.',
    vietnameseTranslation: 'Đội bảo trì vẫn chưa trải lại nhựa bãi đỗ xe của khách đúng không? (A) Chưa, họ đang chờ thời tiết khô ráo. (B) Vâng, đỗ xe miễn phí cho khách. (C) Ba chiếc xe đỗ bên ngoài.',
    keyVocabulary: [
      { word: 'Repaved', ipa: '/ˌriːˈpeɪvd/', meaning: 'Được trải lại mặt đường nhựa' },
      { word: 'Complimentary', ipa: '/ˌkɒm.plɪˈmen.tər.i/', meaning: 'Miễn phí kèm theo' }
    ]
  },
  {
    id: 'toeic_p2_25',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'hard',
    estimatedDifficulty: 670,
    topic: 'Office Security & Lost Items',
    subSkill: 'indirect_guidance',
    questionType: 'indirect_response',
    vocabularyTags: ['briefcase', 'lost_and_found', 'podium'],
    grammarTags: ['indirect_question'],
    audioScript: 'Do you know who left this leather briefcase on the conference podium? (A) Try checking with building security lost-and-found. (B) It is crafted from genuine Italian leather. (C) The keynote address concluded at four o’clock.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. Try checking with building security lost-and-found.',
      'B. It is crafted from genuine Italian leather.',
      'C. The keynote address concluded at four o’clock.'
    ],
    correctAnswer: 'A',
    explanation: 'Câu hỏi gián tiếp "Do you know who left...?". Thay vì trả lời có/không, (A) đưa ra hướng xử lý thực tế: kiểm tra phòng đồ thất lạc của bảo vệ.',
    vietnameseTranslation: 'Bạn có biết ai để quên chiếc cặp da trên bục hội nghị không? (A) Hãy thử hỏi phòng đồ thất lạc của ban bảo vệ. (B) Nó làm từ da thật của Ý. (C) Bài phát biểu kết thúc lúc 4 giờ.',
    keyVocabulary: [
      { word: 'Briefcase', ipa: '/ˈbriːf.keɪs/', meaning: 'Cặp đựng tài liệu' },
      { word: 'Lost-and-found', ipa: '/ˌlɒst.ənˈfaʊnd/', meaning: 'Bộ phận tiếp nhận đồ thất lạc' }
    ]
  },
  {
    id: 'toeic_p2_26',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'hard',
    estimatedDifficulty: 700,
    topic: 'International Negotiations',
    subSkill: 'clarification_update',
    questionType: 'indirect_response',
    vocabularyTags: ['negotiation', 'reassigned', 'acquisition'],
    grammarTags: ['indirect_inference', 'past_passive'],
    audioScript: 'I thought Ms. Watson was supposed to lead the negotiation team in Seoul. (A) She was reassigned to the European acquisition project last week. (B) Seoul is a vibrant and bustling capital city. (C) The negotiation team consists of five attorneys.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. She was reassigned to the European acquisition project last week.',
      'B. Seoul is a vibrant and bustling capital city.',
      'C. The negotiation team consists of five attorneys.'
    ],
    correctAnswer: 'A',
    explanation: 'Người nói nêu thắc mắc về phân công nhân sự. Phản hồi gián tiếp (A) giải thích cô Watson đã được điều chuyển sang dự án thâu tóm tại châu Âu.',
    vietnameseTranslation: 'Tôi cứ tưởng bà Watson sẽ dẫn đầu đoàn đàm phán ở Seoul chứ. (A) Bà ấy đã được điều chuyển sang dự án mua lại ở châu Âu tuần trước. (B) Seoul là thủ đô sôi động. (C) Đội ngũ gồm 5 luật sư.',
    keyVocabulary: [
      { word: 'Reassigned', ipa: '/ˌriː.əˈsaɪnd/', meaning: 'Được điều chuyển công tác' },
      { word: 'Acquisition', ipa: '/ˌæk.wɪˈzɪʃ.ən/', meaning: 'Thương vụ mua lại, thâu tóm công ty' }
    ]
  },
  {
    id: 'toeic_p2_27',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'hard',
    estimatedDifficulty: 720,
    topic: 'Catering Preferences',
    subSkill: 'dietary_constraint',
    questionType: 'indirect_response',
    vocabularyTags: ['catering', 'vegetarian', 'deli'],
    grammarTags: ['indirect_inference', 'modal_should'],
    audioScript: 'Should we order lunch catering from the Mediterranean deli or the sushi bistro? (A) Actually, the client expressed a strict preference for vegetarian food. (B) Lunch is served promptly at twelve thirty in the cafeteria. (C) We ordered fifty boxed meals for the workshop.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. Actually, the client expressed a strict preference for vegetarian food.',
      'B. Lunch is served promptly at twelve thirty in the cafeteria.',
      'C. We ordered fifty boxed meals for the workshop.'
    ],
    correctAnswer: 'A',
    explanation: 'Câu hỏi lựa chọn giữa hai nhà hàng. Phản hồi gián tiếp (A) không chọn trực tiếp mà đưa thông tin khách ăn chay để điều hướng quyết định.',
    vietnameseTranslation: 'Chúng ta nên đặt tiệc trưa từ tiệm Địa Trung Hải hay quán sushi? (A) Thật ra, khách hàng yêu cầu nghiêm ngặt món ăn chay. (B) Bữa trưa phục vụ lúc 12:30. (C) Chúng tôi đã đặt 50 suất ăn.',
    keyVocabulary: [
      { word: 'Catering', ipa: '/ˈkeɪ.tər.ɪŋ/', meaning: 'Dịch vụ cung cấp tiệc ăn uống' },
      { word: 'Vegetarian', ipa: '/ˌvedʒ.ɪˈteə.ri.ən/', meaning: 'Món ăn chay' }
    ]
  },
  {
    id: 'toeic_p2_28',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'hard',
    estimatedDifficulty: 740,
    topic: 'Vendor Governance & Scheduling',
    subSkill: 'schedule_conflict_response',
    questionType: 'indirect_response',
    vocabularyTags: ['contract_review', 'overlapping', 'auditor'],
    grammarTags: ['indirect_refusal'],
    audioScript: 'Are you going to attend the supplier contract review meeting this afternoon? (A) I have an overlapping appointment with our chief auditor. (B) The supplier dispatched sixty heavy wooden crates. (C) Contract law is an engaging field of study.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. I have an overlapping appointment with our chief auditor.',
      'B. The supplier dispatched sixty heavy wooden crates.',
      'C. Contract law is an engaging field of study.'
    ],
    correctAnswer: 'A',
    explanation: 'Câu hỏi Yes/No hỏi có tham gia họp không. (A) từ chối khéo bằng cách nêu lịch hẹn bị trùng (overlapping) với kiểm toán trưởng.',
    vietnameseTranslation: 'Bạn có định tham dự cuộc họp đánh giá hợp đồng nhà cung cấp chiều nay không? (A) Tôi bị trùng lịch hẹn với kiểm toán viên trưởng. (B) Nhà cung cấp đã gửi 60 thùng gỗ. (C) Luật hợp đồng rất thú vị.',
    keyVocabulary: [
      { word: 'Overlapping', ipa: '/ˌəʊ.vəˈlæp.ɪŋ/', meaning: 'Bị trùng lặp (thời gian)' },
      { word: 'Auditor', ipa: '/ˈɔː.dɪ.tər/', meaning: 'Kiểm toán viên' }
    ]
  },
  {
    id: 'toeic_p2_29',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'hard',
    estimatedDifficulty: 760,
    topic: 'Manufacturing & Supply Chain',
    subSkill: 'tracking_status',
    questionType: 'indirect_response',
    vocabularyTags: ['compressor', 'freight_tracking', 'assembly'],
    grammarTags: ['present_perfect', 'status_inference'],
    audioScript: 'Has the vendor delivered the replacement compressor parts for assembly line two? (A) The freight tracking notice indicates delivery is delayed until tomorrow morning. (B) Assembly line two produces ninety units per hour. (C) The invoice itemizes part numbers four hundred and four hundred one.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. The freight tracking notice indicates delivery is delayed until tomorrow morning.',
      'B. Assembly line two produces ninety units per hour.',
      'C. The invoice itemizes part numbers four hundred and four hundred one.'
    ],
    correctAnswer: 'A',
    explanation: 'Câu hỏi hàng đã giao chưa. Phản hồi gián tiếp (A) dẫn chiếu thông tin vận đơn cho biết hàng bị hoãn đến sáng mai.',
    vietnameseTranslation: 'Nhà cung cấp đã giao phụ tùng máy nén thay thế cho dây chuyền 2 chưa? (A) Thông báo theo dõi vận chuyển báo giao hàng bị hoãn đến sáng mai. (B) Dây chuyền 2 sản xuất 90 sản phẩm/giờ. (C) Hóa đơn liệt kê mã phụ tùng 400 và 401.',
    keyVocabulary: [
      { word: 'Compressor', ipa: '/kəmˈpres.ər/', meaning: 'Máy nén khí' },
      { word: 'Freight tracking', ipa: '/freɪt ˈtræk.ɪŋ/', meaning: 'Tra cứu hành trình vận chuyển hàng hóa' }
    ]
  },
  {
    id: 'toeic_p2_30',
    part: 'part2_qna',
    skill: 'listening',
    difficulty: 'hard',
    estimatedDifficulty: 780,
    topic: 'Legal & Corporate Compliance',
    subSkill: 'verification_confirmation',
    questionType: 'indirect_response',
    vocabularyTags: ['nondisclosure_agreement', 'vetted', 'clearance'],
    grammarTags: ['modal_should', 'indirect_status'],
    audioScript: 'We should verify whether our legal team vetted the updated nondisclosure agreement. (A) David forwarded their signed clearance email ten minutes ago. (B) Nondisclosure agreements must be renewed every three years. (C) The law firm is situated adjacent to city hall.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. David forwarded their signed clearance email ten minutes ago.',
      'B. Nondisclosure agreements must be renewed every three years.',
      'C. The law firm is situated adjacent to city hall.'
    ],
    correctAnswer: 'A',
    explanation: 'Đề xuất cần kiểm tra xem bộ phận pháp chế đã thẩm định thỏa thuận bảo mật chưa. Phản hồi gián tiếp (A) xác nhận đã xong bằng chứng email phê duyệt vừa gửi 10 phút trước.',
    vietnameseTranslation: 'Chúng ta nên kiểm tra xem đội pháp lý đã thẩm định thỏa thuận bảo mật cập nhật chưa. (A) David vừa chuyển tiếp email phê duyệt đã ký cách đây 10 phút. (B) Thỏa thuận phải gia hạn mỗi 3 năm. (C) Công ty luật nằm cạnh tòa thị chính.',
    keyVocabulary: [
      { word: 'Nondisclosure agreement', ipa: '/ˌnɒn.dɪˈskləʊ.ʒər əˈɡriː.mənt/', meaning: 'Thỏa thuận bảo mật thông tin (NDA)' },
      { word: 'Vetted', ipa: '/ˈvet.ɪd/', meaning: 'Đã được thẩm định, kiểm tra kỹ lưỡng' }
    ]
  },

  // ===========================================================================
  // PART 3: SHORT CONVERSATIONS (LISTENING - 15 QUESTIONS ACROSS 5 GROUPS)
  // ===========================================================================
  // --- GROUP P3_1 (3 questions) ---
  {
    id: 'toeic_p3_1',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'medium',
    topic: 'Sales Presentation',
    subSkill: 'information_retrieval',
    questionType: 'detail',
    groupId: 'toeic_grp_p3_1',
    audioGroupId: 'toeic_grp_p3_1',
    vocabularyTags: ['quarterly', 'revenue', 'presentation'],
    grammarTags: ['present_continuous'],
    estimatedDifficulty: 550,
    audioScript: 'Man: Hello Sarah, have you finished the quarterly sales presentation for tomorrow? Woman: Almost, Mark. I am just waiting for the final revenue figures from the accounting department. Man: Great. Let me know if you need help polishing the PowerPoint slides.',
    questionText: 'Part 3: What is the woman waiting for before completing her presentation?',
    options: [
      'A. The marketing budget approval',
      'B. Revenue data from accounting',
      'C. A new laptop charger',
      'D. A meeting room reservation'
    ],
    correctAnswer: 'B',
    explanation: 'Người phụ nữ nói rõ: "I am just waiting for the final revenue figures from the accounting department".',
    vietnameseTranslation: 'Người phụ nữ đang chờ đợi điều gì trước khi hoàn thành bài thuyết trình? (B) Số liệu doanh thu từ phòng kế toán.',
    keyVocabulary: [
      { word: 'Quarterly', ipa: '/ˈkwɔː.təl.i/', meaning: 'Hàng quý' },
      { word: 'Revenue', ipa: '/ˈrev.ən.juː/', meaning: 'Doanh thu' }
    ]
  },
  {
    id: 'toeic_p3_1_b',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'medium',
    topic: 'Sales Presentation',
    subSkill: 'offer_identification',
    questionType: 'detail',
    groupId: 'toeic_grp_p3_1',
    audioGroupId: 'toeic_grp_p3_1',
    vocabularyTags: ['polishing', 'slides', 'assistance'],
    grammarTags: ['conditional_if'],
    estimatedDifficulty: 540,
    audioScript: 'Man: Hello Sarah, have you finished the quarterly sales presentation for tomorrow? Woman: Almost, Mark. I am just waiting for the final revenue figures from the accounting department. Man: Great. Let me know if you need help polishing the PowerPoint slides.',
    questionText: 'Part 3: What does the man offer to do for Sarah?',
    options: [
      'A. Assist with refining the presentation slides',
      'B. Contact the accounting department directly',
      'C. Deliver the keynote address tomorrow',
      'D. Reserve a larger conference auditorium'
    ],
    correctAnswer: 'A',
    explanation: 'Người đàn ông nói: "Let me know if you need help polishing the PowerPoint slides" (Hãy báo cho tôi nếu bạn cần giúp trau chuốt các slide).',
    vietnameseTranslation: 'Người đàn ông đề nghị giúp Sarah việc gì? (A) Hỗ trợ trau chuốt các trang slide thuyết trình.',
    keyVocabulary: [
      { word: 'Polishing', ipa: '/ˈpɒl.ɪ.ʃɪŋ/', meaning: 'Trau chuốt, hoàn thiện' },
      { word: 'Assist', ipa: '/əˈsɪst/', meaning: 'Hỗ trợ' }
    ]
  },
  {
    id: 'toeic_p3_1_c',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'easy',
    topic: 'Sales Presentation',
    subSkill: 'time_inference',
    questionType: 'detail',
    groupId: 'toeic_grp_p3_1',
    audioGroupId: 'toeic_grp_p3_1',
    vocabularyTags: ['presentation', 'schedule'],
    grammarTags: ['future_time'],
    estimatedDifficulty: 420,
    audioScript: 'Man: Hello Sarah, have you finished the quarterly sales presentation for tomorrow? Woman: Almost, Mark. I am just waiting for the final revenue figures from the accounting department. Man: Great. Let me know if you need help polishing the PowerPoint slides.',
    questionText: 'Part 3: When is the presentation scheduled to take place?',
    options: [
      'A. Next Friday morning',
      'B. At the end of next month',
      'C. Tomorrow',
      'D. Later this afternoon'
    ],
    correctAnswer: 'C',
    explanation: 'Người đàn ông hỏi ngay đầu câu: "...finished the quarterly sales presentation for tomorrow?".',
    vietnameseTranslation: 'Bài thuyết trình dự kiến diễn ra khi nào? (C) Vào ngày mai.',
    keyVocabulary: [
      { word: 'Quarterly', ipa: '/ˈkwɔː.təl.i/', meaning: 'Hàng quý' }
    ]
  },

  // --- GROUP P3_2 (3 questions) ---
  {
    id: 'toeic_p3_2',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'medium',
    topic: 'Software Demonstration',
    subSkill: 'reasoning',
    questionType: 'detail',
    groupId: 'toeic_grp_p3_2',
    audioGroupId: 'toeic_grp_p3_2',
    vocabularyTags: ['maintenance', 'reschedule', 'software'],
    grammarTags: ['cause_effect'],
    estimatedDifficulty: 600,
    audioScript: 'Woman: David, did you hear that our software client wants to reschedule their on-site demonstration to Friday? Man: Yes, but Friday our primary demonstration server will undergo scheduled maintenance. Woman: We should contact their technical director immediately to propose Thursday afternoon instead.',
    questionText: 'Part 3: Why is Friday unsuitable for the on-site demonstration?',
    options: [
      'A. The primary client contact is on vacation',
      'B. The demonstration server will be undergoing maintenance',
      'C. The office building will be closed for a holiday',
      'D. The technical team will attend an off-site conference'
    ],
    correctAnswer: 'B',
    explanation: 'Người đàn ông nêu rõ lý do: "Friday our primary demonstration server will undergo scheduled maintenance".',
    vietnameseTranslation: 'Tại sao ngày thứ Sáu không phù hợp cho buổi demo trực tiếp? (B) Máy chủ demo sẽ bảo trì định kỳ.',
    keyVocabulary: [
      { word: 'Maintenance', ipa: '/ˈmeɪn.tən.əns/', meaning: 'Bảo trì' },
      { word: 'Reschedule', ipa: '/ˌriːˈskedʒ.uːl/', meaning: 'Đổi lịch' }
    ]
  },
  {
    id: 'toeic_p3_2_b',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'medium',
    topic: 'Software Demonstration',
    subSkill: 'solution_identification',
    questionType: 'detail',
    groupId: 'toeic_grp_p3_2',
    audioGroupId: 'toeic_grp_p3_2',
    vocabularyTags: ['propose', 'alternative', 'schedule'],
    grammarTags: ['modal_should'],
    estimatedDifficulty: 580,
    audioScript: 'Woman: David, did you hear that our software client wants to reschedule their on-site demonstration to Friday? Man: Yes, but Friday our primary demonstration server will undergo scheduled maintenance. Woman: We should contact their technical director immediately to propose Thursday afternoon instead.',
    questionText: 'Part 3: What alternative time does the woman recommend proposing?',
    options: [
      'A. Monday morning',
      'B. Wednesday evening',
      'C. Thursday morning',
      'D. Thursday afternoon'
    ],
    correctAnswer: 'D',
    explanation: 'Người phụ nữ đề xuất: "...to propose Thursday afternoon instead".',
    vietnameseTranslation: 'Người phụ nữ đề xuất thời gian thay thế nào? (D) Chiều thứ Năm.',
    keyVocabulary: [
      { word: 'Propose', ipa: '/prəˈpəʊz/', meaning: 'Đề xuất' }
    ]
  },
  {
    id: 'toeic_p3_2_c',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'easy',
    topic: 'Software Demonstration',
    subSkill: 'contact_identification',
    questionType: 'detail',
    groupId: 'toeic_grp_p3_2',
    audioGroupId: 'toeic_grp_p3_2',
    vocabularyTags: ['technical_director', 'contact'],
    grammarTags: ['modal_verbs'],
    estimatedDifficulty: 440,
    audioScript: 'Woman: David, did you hear that our software client wants to reschedule their on-site demonstration to Friday? Man: Yes, but Friday our primary demonstration server will undergo scheduled maintenance. Woman: We should contact their technical director immediately to propose Thursday afternoon instead.',
    questionText: 'Part 3: Whom will the speakers contact right away?',
    options: [
      'A. The client’s technical director',
      'B. The marketing supervisor',
      'C. The server manufacturer',
      'D. The building facility manager'
    ],
    correctAnswer: 'A',
    explanation: 'Người phụ nữ nói: "We should contact their technical director immediately".',
    vietnameseTranslation: 'Người nói sẽ liên hệ với ai ngay lập tức? (A) Giám đốc kỹ thuật của khách hàng.',
    keyVocabulary: [
      { word: 'Technical director', ipa: '/ˈtek.nɪ.kəl daɪˈrek.tər/', meaning: 'Giám đốc kỹ thuật' }
    ]
  },

  // --- GROUP P3_3 (3 questions) ---
  {
    id: 'toeic_p3_3',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'medium',
    topic: 'Procurement & Delivery',
    subSkill: 'problem_explanation',
    questionType: 'detail',
    groupId: 'toeic_grp_p3_3',
    audioGroupId: 'toeic_grp_p3_3',
    vocabularyTags: ['backordered', 'purchase_order', 'manufacturer'],
    grammarTags: ['passive_voice'],
    estimatedDifficulty: 550,
    audioScript: 'Man: Good afternoon. I ordered thirty office chairs two weeks ago, but only twenty arrived this morning. Woman: Let me check your purchase order right now, sir. Ah, it appears the remaining ten units were backordered from the manufacturer and are scheduled to ship tomorrow.',
    questionText: 'Part 3: What does the woman explain about the remaining chairs?',
    options: [
      'A. They were damaged during transportation',
      'B. The order was canceled by the customer',
      'C. They were backordered and will ship tomorrow',
      'D. The warehouse sent them to the wrong address'
    ],
    correctAnswer: 'C',
    explanation: 'Người phụ nữ kiểm tra đơn và giải thích: "...the remaining ten units were backordered from the manufacturer and are scheduled to ship tomorrow".',
    vietnameseTranslation: 'Người phụ nữ giải thích điều gì về số ghế còn lại? (C) Hàng bị tạm hết và sẽ xuất xưởng vào ngày mai.',
    keyVocabulary: [
      { word: 'Backordered', ipa: '/ˈbækˌɔː.dəd/', meaning: 'Tạm hết hàng chờ nhà sản xuất giao bổ sung' }
    ]
  },
  {
    id: 'toeic_p3_3_b',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'easy',
    topic: 'Procurement & Delivery',
    subSkill: 'quantity_extraction',
    questionType: 'detail',
    groupId: 'toeic_grp_p3_3',
    audioGroupId: 'toeic_grp_p3_3',
    vocabularyTags: ['units', 'delivered', 'arrival'],
    grammarTags: ['past_simple'],
    estimatedDifficulty: 380,
    audioScript: 'Man: Good afternoon. I ordered thirty office chairs two weeks ago, but only twenty arrived this morning. Woman: Let me check your purchase order right now, sir. Ah, it appears the remaining ten units were backordered from the manufacturer and are scheduled to ship tomorrow.',
    questionText: 'Part 3: How many chairs were delivered to the customer this morning?',
    options: [
      'A. Ten units',
      'B. Twenty units',
      'C. Thirty units',
      'D. Fifty units'
    ],
    correctAnswer: 'B',
    explanation: 'Người đàn ông nói rõ: "...ordered thirty office chairs two weeks ago, but only twenty arrived this morning".',
    vietnameseTranslation: 'Có bao nhiêu chiếc ghế được giao tới sáng nay? (B) 20 chiếc.',
    keyVocabulary: [
      { word: 'Arrived', ipa: '/əˈraɪvd/', meaning: 'Đã đến nơi' }
    ]
  },
  {
    id: 'toeic_p3_3_c',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'easy',
    topic: 'Procurement & Delivery',
    subSkill: 'document_identification',
    questionType: 'detail',
    groupId: 'toeic_grp_p3_3',
    audioGroupId: 'toeic_grp_p3_3',
    vocabularyTags: ['purchase_order', 'check'],
    grammarTags: ['imperative_let'],
    estimatedDifficulty: 400,
    audioScript: 'Man: Good afternoon. I ordered thirty office chairs two weeks ago, but only twenty arrived this morning. Woman: Let me check your purchase order right now, sir. Ah, it appears the remaining ten units were backordered from the manufacturer and are scheduled to ship tomorrow.',
    questionText: 'Part 3: What record does the woman inspect on her computer?',
    options: [
      'A. A customer purchase order',
      'B. An employment contract',
      'C. A tax deduction form',
      'D. An advertising receipt'
    ],
    correctAnswer: 'A',
    explanation: 'Người phụ nữ nói: "Let me check your purchase order right now, sir".',
    vietnameseTranslation: 'Người phụ nữ kiểm tra tài liệu gì? (A) Đơn đặt hàng của khách.',
    keyVocabulary: [
      { word: 'Purchase order', ipa: '/ˈpɜː.tʃəs ˌɔː.dər/', meaning: 'Đơn đặt hàng mua' }
    ]
  },

  // --- GROUP P3_4 (3 questions) ---
  {
    id: 'toeic_p3_4_a',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'easy',
    topic: 'Event Planning & Hospitality',
    subSkill: 'purpose_identification',
    questionType: 'main_idea',
    groupId: 'toeic_grp_p3_4',
    audioGroupId: 'toeic_grp_p3_4',
    vocabularyTags: ['banquet', 'reserving', 'venue'],
    grammarTags: ['infinitive_purpose'],
    estimatedDifficulty: 440,
    audioScript: 'Man: Hello, I am calling from Summit Technologies to inquire about reserving your Grand Ballroom for our annual banquet on November fifteenth. Woman: I would be happy to check availability for you, sir. Unfortunately, the Grand Ballroom is already booked for that date, but our newly renovated Crystal Pavilion has identical capacity and modern audiovisual equipment. Man: That sounds promising. Could you send me the rental rates and catering menu by email?',
    questionText: 'Part 3: What is the caller attempting to do?',
    options: [
      'A. Reserve a venue for an annual corporate banquet',
      'B. Cancel a hotel room reservation for a colleague',
      'C. Apply for a managerial position at the hotel',
      'D. Inquire about public transportation to the summit'
    ],
    correctAnswer: 'A',
    explanation: 'Người gọi nêu rõ mục đích: "...calling from Summit Technologies to inquire about reserving your Grand Ballroom for our annual banquet".',
    vietnameseTranslation: 'Người gọi đang muốn thực hiện việc gì? (A) Đặt hội trường cho tiệc thường niên của công ty.',
    keyVocabulary: [
      { word: 'Banquet', ipa: '/ˈbæŋ.kwɪt/', meaning: 'Tiệc lớn, yến tiệc' },
      { word: 'Reserve', ipa: '/rɪˈzɜːv/', meaning: 'Đặt chỗ trước' }
    ]
  },
  {
    id: 'toeic_p3_4_b',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'easy',
    topic: 'Event Planning & Hospitality',
    subSkill: 'problem_extraction',
    questionType: 'detail',
    groupId: 'toeic_grp_p3_4',
    audioGroupId: 'toeic_grp_p3_4',
    vocabularyTags: ['booked', 'availability'],
    grammarTags: ['passive_voice'],
    estimatedDifficulty: 450,
    audioScript: 'Man: Hello, I am calling from Summit Technologies to inquire about reserving your Grand Ballroom for our annual banquet on November fifteenth. Woman: I would be happy to check availability for you, sir. Unfortunately, the Grand Ballroom is already booked for that date, but our newly renovated Crystal Pavilion has identical capacity and modern audiovisual equipment. Man: That sounds promising. Could you send me the rental rates and catering menu by email?',
    questionText: 'Part 3: What obstacle does the woman point out?',
    options: [
      'A. The catering staff is on strike',
      'B. The hotel is closed for reconstruction',
      'C. The Grand Ballroom is unavailable on the chosen date',
      'D. The rental deposit must be paid in foreign currency'
    ],
    correctAnswer: 'C',
    explanation: 'Người phụ nữ thông báo: "Unfortunately, the Grand Ballroom is already booked for that date".',
    vietnameseTranslation: 'Người phụ nữ chỉ ra khó khăn gì? (C) Hội trường lớn đã kín lịch vào ngày đã chọn.',
    keyVocabulary: [
      { word: 'Booked', ipa: '/bʊkt/', meaning: 'Đã được đặt trước' }
    ]
  },
  {
    id: 'toeic_p3_4_c',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'medium',
    topic: 'Event Planning & Hospitality',
    subSkill: 'next_action',
    questionType: 'next_action',
    groupId: 'toeic_grp_p3_4',
    audioGroupId: 'toeic_grp_p3_4',
    vocabularyTags: ['catering', 'rates', 'email'],
    grammarTags: ['polite_request'],
    estimatedDifficulty: 490,
    audioScript: 'Man: Hello, I am calling from Summit Technologies to inquire about reserving your Grand Ballroom for our annual banquet on November fifteenth. Woman: I would be happy to check availability for you, sir. Unfortunately, the Grand Ballroom is already booked for that date, but our newly renovated Crystal Pavilion has identical capacity and modern audiovisual equipment. Man: That sounds promising. Could you send me the rental rates and catering menu by email?',
    questionText: 'Part 3: What does the man ask the woman to email him?',
    options: [
      'A. Directions from the international airport',
      'B. Rental rates and catering menu options',
      'C. A list of guest speaker biographies',
      'D. Photos of the outdoor parking facility'
    ],
    correctAnswer: 'B',
    explanation: 'Người đàn ông đề nghị: "Could you send me the rental rates and catering menu by email?".',
    vietnameseTranslation: 'Người đàn ông yêu cầu gửi thông tin gì qua email? (B) Bảng giá thuê phòng và thực đơn ăn uống.',
    keyVocabulary: [
      { word: 'Catering menu', ipa: '/ˈkeɪ.tər.ɪŋ ˈmen.juː/', meaning: 'Thực đơn dịch vụ ăn uống tiệc' }
    ]
  },

  // --- GROUP P3_5 (2 questions) ---
  {
    id: 'toeic_p3_5_a',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'hard',
    topic: 'Finance & Advertising',
    subSkill: 'main_idea_inference',
    questionType: 'main_idea',
    groupId: 'toeic_grp_p3_5',
    audioGroupId: 'toeic_grp_p3_5',
    vocabularyTags: ['budget', 'campaign', 'advertising'],
    grammarTags: ['present_perfect'],
    estimatedDifficulty: 700,
    audioScript: 'Woman: Marcus, has the finance committee approved our proposed budget for the upcoming social media advertising campaign? Man: Not quite yet, Linda. They requested more granular projections regarding our estimated return on investment across different demographics. Woman: I can extract those predictive metrics from our analytics dashboard before our executive briefing at two o’clock.',
    questionText: 'Part 3: What is the main subject of the discussion?',
    options: [
      'A. Designing brand-new product packaging',
      'B. Approval for a digital advertising budget',
      'C. Hiring additional customer service representatives',
      'D. Migrating user data to a cloud database'
    ],
    correctAnswer: 'B',
    explanation: 'Người phụ nữ hỏi về việc: "has the finance committee approved our proposed budget for the upcoming social media advertising campaign?".',
    vietnameseTranslation: 'Chủ đề chính của cuộc thảo luận là gì? (B) Phê duyệt ngân sách cho chiến dịch quảng cáo số.',
    keyVocabulary: [
      { word: 'Granular', ipa: '/ˈɡræn.jə.lər/', meaning: 'Chi tiết, phân rã sâu' },
      { word: 'Projections', ipa: '/prəˈdʒek.ʃənz/', meaning: 'Dự báo tài chính' }
    ]
  },
  {
    id: 'toeic_p3_5_b',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'hard',
    topic: 'Finance & Advertising',
    subSkill: 'next_action',
    questionType: 'next_action',
    groupId: 'toeic_grp_p3_5',
    audioGroupId: 'toeic_grp_p3_5',
    vocabularyTags: ['metrics', 'analytics', 'dashboard'],
    grammarTags: ['future_modal_can'],
    estimatedDifficulty: 740,
    audioScript: 'Woman: Marcus, has the finance committee approved our proposed budget for the upcoming social media advertising campaign? Man: Not quite yet, Linda. They requested more granular projections regarding our estimated return on investment across different demographics. Woman: I can extract those predictive metrics from our analytics dashboard before our executive briefing at two o’clock.',
    questionText: 'Part 3: What will Linda do before the two o’clock meeting?',
    options: [
      'A. Interview potential advertising agencies',
      'B. Cancel the scheduled executive briefing',
      'C. Sign a formal sponsorship contract',
      'D. Pull performance metrics from an analytics tool'
    ],
    correctAnswer: 'D',
    explanation: 'Linda khẳng định: "I can extract those predictive metrics from our analytics dashboard before our executive briefing at two o’clock".',
    vietnameseTranslation: 'Linda sẽ làm gì trước cuộc họp lúc 2 giờ? (D) Trích xuất các chỉ số từ công cụ phân tích.',
    keyVocabulary: [
      { word: 'Predictive metrics', ipa: '/prɪˈdɪk.tɪv ˈmet.rɪks/', meaning: 'Các chỉ số đo lường dự báo' }
    ]
  },
  {
    id: 'toeic_p3_5_c',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'hard',
    topic: 'Finance & Advertising',
    subSkill: 'detail',
    questionType: 'detail',
    groupId: 'toeic_grp_p3_5',
    audioGroupId: 'toeic_grp_p3_5',
    vocabularyTags: ['projections', 'demographics', 'committee'],
    grammarTags: ['past_simple_request'],
    estimatedDifficulty: 730,
    audioScript: 'Woman: Marcus, has the finance committee approved our proposed budget for the upcoming social media advertising campaign? Man: Not quite yet, Linda. They requested more granular projections regarding our estimated return on investment across different demographics. Woman: I can extract those predictive metrics from our analytics dashboard before our executive briefing at two o’clock.',
    questionText: 'Part 3: What did the finance committee request before giving approval?',
    options: [
      'A. A reduction in overall staffing costs',
      'B. Detailed projections on return on investment',
      'C. A revised schedule for the campaign launch',
      'D. Written feedback from corporate clients'
    ],
    correctAnswer: 'B',
    explanation: 'Người đàn ông giải thích: "They requested more granular projections regarding our estimated return on investment across different demographics".',
    vietnameseTranslation: 'Ủy ban tài chính đã yêu cầu điều gì trước khi phê duyệt? (B) Dự báo chi tiết về tỷ suất hoàn vốn đầu tư (ROI).',
    keyVocabulary: [
      { word: 'Return on investment', ipa: '/rɪˈtɜːn ɒn ɪnˈvest.mənt/', meaning: 'Tỷ suất hoàn vốn đầu tư (ROI)' },
      { word: 'Demographics', ipa: '/ˌdem.əˈɡræf.ɪks/', meaning: 'Số liệu nhân khẩu học' }
    ]
  },

  // --- GROUP P3_6 (3 questions - Inventory Logistics) ---
  {
    id: 'toeic_p3_6_a',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'easy',
    estimatedDifficulty: 450,
    topic: 'Warehouse & Inventory Logistics',
    subSkill: 'detail',
    questionType: 'detail',
    groupId: 'toeic_grp_p3_6',
    audioGroupId: 'toeic_grp_p3_6',
    vocabularyTags: ['inventory', 'pallet', 'warehouse'],
    grammarTags: ['present_perfect'],
    audioScript:
      'Man: Rachel, have you completed the physical inventory count in Warehouse Section B? Woman: Yes, Mark. We finished verifying the pallet counts an hour ago, but there is a shortage of thirty heavy-duty shipping cartons. Man: I will notify the procurement team right now so they can expedite a replacement order before the afternoon shift starts.',
    questionText: 'Part 3: What task has Rachel recently completed?',
    options: [
      'A. Loading delivery vans for the morning shift',
      'B. Verifying pallet counts in a warehouse section',
      'C. Repairing an automated forklift motor',
      'D. Auditing international freight invoices'
    ],
    correctAnswer: 'B',
    explanation: 'Rachel xác nhận: "We finished verifying the pallet counts an hour ago".',
    vietnameseTranslation: 'Rachel vừa hoàn thành công việc gì? (B) Xác minh số lượng pallet trong một khu vực kho.',
    keyVocabulary: [
      { word: 'Pallet', ipa: '/ˈpæl.ət/', meaning: 'Kệ kê hàng hóa' }
    ]
  },
  {
    id: 'toeic_p3_6_b',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'easy',
    estimatedDifficulty: 460,
    topic: 'Warehouse & Inventory Logistics',
    subSkill: 'problem_identification',
    questionType: 'detail',
    groupId: 'toeic_grp_p3_6',
    audioGroupId: 'toeic_grp_p3_6',
    vocabularyTags: ['shortage', 'cartons', 'shipping'],
    grammarTags: ['there_is_shortage'],
    audioScript:
      'Man: Rachel, have you completed the physical inventory count in Warehouse Section B? Woman: Yes, Mark. We finished verifying the pallet counts an hour ago, but there is a shortage of thirty heavy-duty shipping cartons. Man: I will notify the procurement team right now so they can expedite a replacement order before the afternoon shift starts.',
    questionText: 'Part 3: What problem does the woman mention?',
    options: [
      'A. A forklift is obstructing the loading bay',
      'B. Several delivery drivers arrived late',
      'C. A shortage of thirty shipping cartons',
      'D. The warehouse air conditioning failed'
    ],
    correctAnswer: 'C',
    explanation: 'Người phụ nữ nói: "...there is a shortage of thirty heavy-duty shipping cartons".',
    vietnameseTranslation: 'Người phụ nữ đề cập đến vấn đề gì? (C) Thiếu 30 thùng các-tông vận chuyển.',
    keyVocabulary: [
      { word: 'Shortage', ipa: '/ˈʃɔː.tɪdʒ/', meaning: 'Sự thiếu hụt' }
    ]
  },
  {
    id: 'toeic_p3_6_c',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'easy',
    estimatedDifficulty: 470,
    topic: 'Warehouse & Inventory Logistics',
    subSkill: 'next_action',
    questionType: 'next_action',
    groupId: 'toeic_grp_p3_6',
    audioGroupId: 'toeic_grp_p3_6',
    vocabularyTags: ['procurement', 'expedite', 'replacement'],
    grammarTags: ['future_simple'],
    audioScript:
      'Man: Rachel, have you completed the physical inventory count in Warehouse Section B? Woman: Yes, Mark. We finished verifying the pallet counts an hour ago, but there is a shortage of thirty heavy-duty shipping cartons. Man: I will notify the procurement team right now so they can expedite a replacement order before the afternoon shift starts.',
    questionText: 'Part 3: What will Mark do next?',
    options: [
      'A. Contact procurement to expedite an order',
      'B. Inspect Warehouse Section C personally',
      'C. Reschedule the afternoon delivery shift',
      'D. Issue a refund to a corporate client'
    ],
    correctAnswer: 'A',
    explanation: 'Người đàn ông nói: "I will notify the procurement team right now so they can expedite a replacement order...".',
    vietnameseTranslation: 'Mark sẽ làm gì tiếp theo? (A) Liên hệ bộ phận mua sắm để đẩy nhanh đơn đặt hàng.',
    keyVocabulary: [
      { word: 'Expedite', ipa: '/ˈek.spə.daɪt/', meaning: 'Xúc tiến, đẩy nhanh tiến độ' }
    ]
  },

  // --- GROUP P3_7 (3 questions - IT Authentication) ---
  {
    id: 'toeic_p3_7_a',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'medium',
    estimatedDifficulty: 570,
    topic: 'IT & Information Security',
    subSkill: 'problem_identification',
    questionType: 'detail',
    groupId: 'toeic_grp_p3_7',
    audioGroupId: 'toeic_grp_p3_7',
    vocabularyTags: ['authentication', 'mobile', 'configuration'],
    grammarTags: ['present_continuous'],
    audioScript:
      'Woman: Brian, several staff members in human resources are having trouble setting up the mandatory two-factor authentication on their mobile phones. Man: Ah, they might be using the outdated version of our authenticator application. I uploaded a step-by-step troubleshooting guide to the company intranet this morning. Woman: Thanks. I will send an email blast with the direct link to all department heads immediately.',
    questionText: 'Part 3: What issue are human resources staff experiencing?',
    options: [
      'A. Lost employee identification badges',
      'B. Difficulty configuring an authentication tool',
      'C. Broken mobile phone hardware screens',
      'D. Slow wireless internet in the cafeteria'
    ],
    correctAnswer: 'B',
    explanation: 'Người phụ nữ nói nhân viên HR gặp sự cố: "setting up the mandatory two-factor authentication on their mobile phones".',
    vietnameseTranslation: 'Nhân viên nhân sự đang gặp vấn đề gì? (B) Khó khăn khi cài đặt công cụ xác thực.',
    keyVocabulary: [
      { word: 'Authentication', ipa: '/ɔːˌθen.tɪˈkeɪ.ʃən/', meaning: 'Xác thực bảo mật' }
    ]
  },
  {
    id: 'toeic_p3_7_b',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'medium',
    estimatedDifficulty: 580,
    topic: 'IT & Information Security',
    subSkill: 'detail',
    questionType: 'detail',
    groupId: 'toeic_grp_p3_7',
    audioGroupId: 'toeic_grp_p3_7',
    vocabularyTags: ['troubleshooting', 'intranet', 'guide'],
    grammarTags: ['past_simple'],
    audioScript:
      'Woman: Brian, several staff members in human resources are having trouble setting up the mandatory two-factor authentication on their mobile phones. Man: Ah, they might be using the outdated version of our authenticator application. I uploaded a step-by-step troubleshooting guide to the company intranet this morning. Woman: Thanks. I will send an email blast with the direct link to all department heads immediately.',
    questionText: 'Part 3: What did Brian do earlier this morning?',
    options: [
      'A. Replaced outdated office router cables',
      'B. Reset passwords for all department staff',
      'C. Conducted an in-person training session',
      'D. Published a troubleshooting guide on the intranet'
    ],
    correctAnswer: 'D',
    explanation: 'Brian nói: "I uploaded a step-by-step troubleshooting guide to the company intranet this morning".',
    vietnameseTranslation: 'Brian đã làm gì sáng nay? (D) Đăng tài liệu hướng dẫn khắc phục sự cố lên mạng nội bộ.',
    keyVocabulary: [
      { word: 'Troubleshooting', ipa: '/ˈtrʌb.əlˌʃuː.tɪŋ/', meaning: 'Khắc phục sự cố' }
    ]
  },
  {
    id: 'toeic_p3_7_c',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'medium',
    estimatedDifficulty: 590,
    topic: 'IT & Information Security',
    subSkill: 'next_action',
    questionType: 'next_action',
    groupId: 'toeic_grp_p3_7',
    audioGroupId: 'toeic_grp_p3_7',
    vocabularyTags: ['email', 'department_heads', 'link'],
    grammarTags: ['future_simple'],
    audioScript:
      'Woman: Brian, several staff members in human resources are having trouble setting up the mandatory two-factor authentication on their mobile phones. Man: Ah, they might be using the outdated version of our authenticator application. I uploaded a step-by-step troubleshooting guide to the company intranet this morning. Woman: Thanks. I will send an email blast with the direct link to all department heads immediately.',
    questionText: 'Part 3: What will the woman do next?',
    options: [
      'A. Email department heads a link to the guide',
      'B. Purchase new smartphones for the team',
      'C. Postpone the security policy implementation',
      'D. Schedule an emergency staff meeting'
    ],
    correctAnswer: 'A',
    explanation: 'Người phụ nữ nói: "I will send an email blast with the direct link to all department heads immediately".',
    vietnameseTranslation: 'Người phụ nữ sẽ làm gì tiếp theo? (A) Gửi email hàng loạt kèm liên kết tới các trưởng bộ phận.',
    keyVocabulary: [
      { word: 'Email blast', ipa: '/ˈiː.meɪl blɑːst/', meaning: 'Gửi email hàng loạt' }
    ]
  },

  // --- GROUP P3_8 (3 questions - Office Lease) ---
  {
    id: 'toeic_p3_8_a',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'medium',
    estimatedDifficulty: 610,
    topic: 'Real Estate & Lease Negotiations',
    subSkill: 'purpose',
    questionType: 'main_idea',
    groupId: 'toeic_grp_p3_8',
    audioGroupId: 'toeic_grp_p3_8',
    vocabularyTags: ['lease', 'renewing', 'inquiry'],
    grammarTags: ['past_simple'],
    audioScript:
      'Man: Good morning, Ms. Vance. Our property management office received your inquiry regarding renewing the lease for your architectural firm on the ninth floor. Woman: Yes, Mr. Sterling. We would love to extend our contract for another three years, but we need additional space for our expanding graphic design department. Man: Conveniently, Suite 904 adjacent to your current office is becoming vacant at the end of next month. I can arrange a walk-through tour this Thursday afternoon.',
    questionText: 'Part 3: Why did Ms. Vance contact the property management office?',
    options: [
      'A. To dispute a water bill surcharge',
      'B. To report a malfunctioning freight elevator',
      'C. To discuss extending their office lease and acquiring more space',
      'D. To request permission to install exterior signage'
    ],
    correctAnswer: 'C',
    explanation: 'Họ trao đổi về: "...renewing the lease for your architectural firm... extend our contract for another three years, but we need additional space".',
    vietnameseTranslation: 'Tại sao bà Vance liên hệ ban quản lý tòa nhà? (C) Để thảo luận gia hạn hợp đồng thuê và mở rộng diện tích văn phòng.',
    keyVocabulary: [
      { word: 'Inquiry', ipa: '/ɪnˈkwaɪə.ri/', meaning: 'Yêu cầu hỏi thông tin' }
    ]
  },
  {
    id: 'toeic_p3_8_b',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'medium',
    estimatedDifficulty: 620,
    topic: 'Real Estate & Lease Negotiations',
    subSkill: 'detail',
    questionType: 'detail',
    groupId: 'toeic_grp_p3_8',
    audioGroupId: 'toeic_grp_p3_8',
    vocabularyTags: ['graphic_design', 'expanding', 'department'],
    grammarTags: ['present_participle'],
    audioScript:
      'Man: Good morning, Ms. Vance. Our property management office received your inquiry regarding renewing the lease for your architectural firm on the ninth floor. Woman: Yes, Mr. Sterling. We would love to extend our contract for another three years, but we need additional space for our expanding graphic design department. Man: Conveniently, Suite 904 adjacent to your current office is becoming vacant at the end of next month. I can arrange a walk-through tour this Thursday afternoon.',
    questionText: 'Part 3: What department in the woman’s firm requires more space?',
    options: [
      'A. Corporate accounting',
      'B. Graphic design',
      'C. Human resources',
      'D. Legal compliance'
    ],
    correctAnswer: 'B',
    explanation: 'Người phụ nữ nói: "...we need additional space for our expanding graphic design department".',
    vietnameseTranslation: 'Bộ phận nào trong công ty của người phụ nữ cần thêm không gian? (B) Thiết kế đồ họa.',
    keyVocabulary: [
      { word: 'Expanding', ipa: '/ɪkˈspæn.dɪŋ/', meaning: 'Đang mở rộng quy mô' }
    ]
  },
  {
    id: 'toeic_p3_8_c',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'medium',
    estimatedDifficulty: 630,
    topic: 'Real Estate & Lease Negotiations',
    subSkill: 'offer_identification',
    questionType: 'detail',
    groupId: 'toeic_grp_p3_8',
    audioGroupId: 'toeic_grp_p3_8',
    vocabularyTags: ['adjacent', 'vacant', 'walk-through'],
    grammarTags: ['future_modal_can'],
    audioScript:
      'Man: Good morning, Ms. Vance. Our property management office received your inquiry regarding renewing the lease for your architectural firm on the ninth floor. Woman: Yes, Mr. Sterling. We would love to extend our contract for another three years, but we need additional space for our expanding graphic design department. Man: Conveniently, Suite 904 adjacent to your current office is becoming vacant at the end of next month. I can arrange a walk-through tour this Thursday afternoon.',
    questionText: 'Part 3: What does Mr. Sterling offer to arrange on Thursday?',
    options: [
      'A. A meeting with an interior decorator',
      'B. A signing session with company attorneys',
      'C. A maintenance check on electrical wiring',
      'D. A walk-through tour of an adjacent vacant suite'
    ],
    correctAnswer: 'D',
    explanation: 'Người đàn ông nói: "Suite 904 adjacent to your current office is becoming vacant... I can arrange a walk-through tour this Thursday afternoon".',
    vietnameseTranslation: 'Ông Sterling đề nghị sắp xếp việc gì vào thứ Năm? (D) Chuyến tham quan văn phòng trống liền kề.',
    keyVocabulary: [
      { word: 'Adjacent', ipa: '/əˈdʒeɪ.sənt/', meaning: 'Liền kề, sát cạnh' }
    ]
  },

  // --- GROUP P3_9 (3 questions - Hospital Medical Procurement) ---
  {
    id: 'toeic_p3_9_a',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'hard',
    estimatedDifficulty: 700,
    topic: 'Healthcare Technology & Procurement',
    subSkill: 'inference_location',
    questionType: 'inference',
    groupId: 'toeic_grp_p3_9',
    audioGroupId: 'toeic_grp_p3_9',
    vocabularyTags: ['diagnostic', 'imaging', 'clinical'],
    grammarTags: ['prepositional_location'],
    audioScript:
      'Woman: Dr. Al-Mansoor, has the logistics courier confirmed delivery of the digital ultrasound scanners for our diagnostic imaging wing? Man: They arrived at the receiving dock twenty minutes ago, but the biomedical engineering team noted that the calibration certificates were missing from the shipping crate. Woman: That is concerning because hospital regulations prohibit us from operating uncertified clinical apparatus. Let me call the European vendor’s compliance liaison immediately to obtain digital copies.',
    questionText: 'Part 3: Where do the speakers most likely work?',
    options: [
      'A. At a retail electronics supermarket',
      'B. At a software publishing start-up',
      'C. At a hospital medical facility',
      'D. At a fitness wellness gymnasium'
    ],
    correctAnswer: 'C',
    explanation: 'Các manh mối: "diagnostic imaging wing", "biomedical engineering team", "hospital regulations", "clinical apparatus".',
    vietnameseTranslation: 'Những người nói chuyện rất có thể làm việc ở đâu? (C) Tại một bệnh viện / cơ sở y tế.',
    keyVocabulary: [
      { word: 'Apparatus', ipa: '/ˌæp.əˈreɪ.təs/', meaning: 'Thiết bị, máy móc chuyên dụng' }
    ]
  },
  {
    id: 'toeic_p3_9_b',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'hard',
    estimatedDifficulty: 710,
    topic: 'Healthcare Technology & Procurement',
    subSkill: 'detail',
    questionType: 'detail',
    groupId: 'toeic_grp_p3_9',
    audioGroupId: 'toeic_grp_p3_9',
    vocabularyTags: ['calibration', 'certificates', 'crate'],
    grammarTags: ['past_continuous_passive'],
    audioScript:
      'Woman: Dr. Al-Mansoor, has the logistics courier confirmed delivery of the digital ultrasound scanners for our diagnostic imaging wing? Man: They arrived at the receiving dock twenty minutes ago, but the biomedical engineering team noted that the calibration certificates were missing from the shipping crate. Woman: That is concerning because hospital regulations prohibit us from operating uncertified clinical apparatus. Let me call the European vendor’s compliance liaison immediately to obtain digital copies.',
    questionText: 'Part 3: What problem does the man report regarding the newly delivered equipment?',
    options: [
      'A. Calibration certificates were missing from the shipment',
      'B. The electronic displays were physically cracked',
      'C. The crate was delivered to the wrong building entrance',
      'D. The courier demanded cash payment on delivery'
    ],
    correctAnswer: 'A',
    explanation: 'Người đàn ông nói: "...the calibration certificates were missing from the shipping crate".',
    vietnameseTranslation: 'Người đàn ông báo cáo vấn đề gì về thiết bị mới giao? (A) Giấy chứng nhận hiệu chuẩn bị thiếu trong kiện hàng.',
    keyVocabulary: [
      { word: 'Calibration', ipa: '/ˌkæl.ɪˈbreɪ.ʃən/', meaning: 'Hiệu chuẩn (đo lường)' }
    ]
  },
  {
    id: 'toeic_p3_9_c',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'hard',
    estimatedDifficulty: 720,
    topic: 'Healthcare Technology & Procurement',
    subSkill: 'next_action',
    questionType: 'next_action',
    groupId: 'toeic_grp_p3_9',
    audioGroupId: 'toeic_grp_p3_9',
    vocabularyTags: ['compliance', 'liaison', 'digital_copies'],
    grammarTags: ['infinitive_purpose'],
    audioScript:
      'Woman: Dr. Al-Mansoor, has the logistics courier confirmed delivery of the digital ultrasound scanners for our diagnostic imaging wing? Man: They arrived at the receiving dock twenty minutes ago, but the biomedical engineering team noted that the calibration certificates were missing from the shipping crate. Woman: That is concerning because hospital regulations prohibit us from operating uncertified clinical apparatus. Let me call the European vendor’s compliance liaison immediately to obtain digital copies.',
    questionText: 'Part 3: What will the woman do to resolve the issue?',
    options: [
      'A. Return the ultrasound machines to the courier',
      'B. Phone the vendor’s compliance representative for digital files',
      'C. Recalibrate the scanners using hospital software',
      'D. File an insurance claim with the transport carrier'
    ],
    correctAnswer: 'B',
    explanation: 'Người phụ nữ nói: "Let me call the European vendor’s compliance liaison immediately to obtain digital copies".',
    vietnameseTranslation: 'Người phụ nữ sẽ làm gì để giải quyết sự việc? (B) Gọi đại diện pháp chế của nhà cung cấp để xin bản mềm kỹ thuật số.',
    keyVocabulary: [
      { word: 'Liaison', ipa: '/liˈeɪ.zɒn/', meaning: 'Đầu mối liên lạc' }
    ]
  },

  // --- GROUP P3_10 (3 questions - Semiconductor Merger) ---
  {
    id: 'toeic_p3_10_a',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'hard',
    estimatedDifficulty: 740,
    topic: 'Corporate Finance & Legal Advisory',
    subSkill: 'main_idea',
    questionType: 'main_idea',
    groupId: 'toeic_grp_p3_10',
    audioGroupId: 'toeic_grp_p3_10',
    vocabularyTags: ['merger', 'acquisition', 'semiconductor'],
    grammarTags: ['present_perfect'],
    audioScript:
      'Man: Eleanor, our Tokyo branch just sent over the finalized audit balance sheets for the semiconductor merger. Are the cross-border tax withholding liabilities in line with our legal assessment? Woman: Generally yes, Kenji, but our senior tax partner expressed hesitation regarding transfer pricing compliance in European subsidiary jurisdictions. Man: In that case, we should schedule an extraordinary briefing with our Zurich legal counsel before presenting the acquisition term sheet to the board of directors tomorrow.',
    questionText: 'Part 3: What corporate transaction are the speakers analyzing?',
    options: [
      'A. An initial public offering on the stock exchange',
      'B. A real estate divestiture in North America',
      'C. A cross-border corporate semiconductor merger',
      'D. A bankruptcy restructuring for an airline'
    ],
    correctAnswer: 'C',
    explanation: 'Người đàn ông nhắc tới: "...semiconductor merger... presenting the acquisition term sheet to the board of directors".',
    vietnameseTranslation: 'Hai người đang phân tích giao dịch doanh nghiệp nào? (C) Thương vụ sáp nhập công ty bán dẫn xuyên biên giới.',
    keyVocabulary: [
      { word: 'Merger', ipa: '/ˈmɜː.dʒər/', meaning: 'Sáp nhập doanh nghiệp' }
    ]
  },
  {
    id: 'toeic_p3_10_b',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'hard',
    estimatedDifficulty: 750,
    topic: 'Corporate Finance & Legal Advisory',
    subSkill: 'detail',
    questionType: 'detail',
    groupId: 'toeic_grp_p3_10',
    audioGroupId: 'toeic_grp_p3_10',
    vocabularyTags: ['transfer_pricing', 'compliance', 'subsidiary'],
    grammarTags: ['prepositional_phrase'],
    audioScript:
      'Man: Eleanor, our Tokyo branch just sent over the finalized audit balance sheets for the semiconductor merger. Are the cross-border tax withholding liabilities in line with our legal assessment? Woman: Generally yes, Kenji, but our senior tax partner expressed hesitation regarding transfer pricing compliance in European subsidiary jurisdictions. Man: In that case, we should schedule an extraordinary briefing with our Zurich legal counsel before presenting the acquisition term sheet to the board of directors tomorrow.',
    questionText: 'Part 3: What specific reservation was expressed by the senior tax partner?',
    options: [
      'A. Inaccurate currency exchange calculations in Tokyo',
      'B. Outstanding severance payouts for factory technicians',
      'C. Excessive executive bonuses requested by directors',
      'D. Transfer pricing compliance in European subsidiary jurisdictions'
    ],
    correctAnswer: 'D',
    explanation: 'Người phụ nữ nói: "...our senior tax partner expressed hesitation regarding transfer pricing compliance in European subsidiary jurisdictions".',
    vietnameseTranslation: 'Thành viên hợp danh phụ trách thuế bày tỏ sự băn khoăn về vấn đề gì? (D) Việc tuân thủ giá chuyển nhượng (transfer pricing) tại các chi nhánh châu Âu.',
    keyVocabulary: [
      { word: 'Transfer pricing', ipa: '/ˈtræns.fɜː ˈpraɪ.sɪŋ/', meaning: 'Định giá chuyển nhượng nội bộ' }
    ]
  },
  {
    id: 'toeic_p3_10_c',
    part: 'part3_conv',
    skill: 'listening',
    difficulty: 'hard',
    estimatedDifficulty: 760,
    topic: 'Corporate Finance & Legal Advisory',
    subSkill: 'next_action',
    questionType: 'next_action',
    groupId: 'toeic_grp_p3_10',
    audioGroupId: 'toeic_grp_p3_10',
    vocabularyTags: ['briefing', 'counsel', 'board_of_directors'],
    grammarTags: ['modal_should'],
    audioScript:
      'Man: Eleanor, our Tokyo branch just sent over the finalized audit balance sheets for the semiconductor merger. Are the cross-border tax withholding liabilities in line with our legal assessment? Woman: Generally yes, Kenji, but our senior tax partner expressed hesitation regarding transfer pricing compliance in European subsidiary jurisdictions. Man: In that case, we should schedule an extraordinary briefing with our Zurich legal counsel before presenting the acquisition term sheet to the board of directors tomorrow.',
    questionText: 'Part 3: What action do the speakers decide to take before tomorrow’s board meeting?',
    options: [
      'A. Delay the semiconductor merger by six months',
      'B. Convene a briefing with Zurich legal counsel',
      'C. Hire a new accounting auditor in Tokyo',
      'D. Publish the acquisition term sheet online'
    ],
    correctAnswer: 'B',
    explanation: 'Người đàn ông đề xuất: "In that case, we should schedule an extraordinary briefing with our Zurich legal counsel...".',
    vietnameseTranslation: 'Hai người quyết định thực hiện hành động gì trước cuộc họp hội đồng quản trị ngày mai? (B) Tổ chức phiên thảo luận với cố vấn pháp lý tại Zurich.',
    keyVocabulary: [
      { word: 'Counsel', ipa: '/ˈkaʊn.səl/', meaning: 'Cố vấn pháp lý, luật sư' }
    ]
  },

  // ===========================================================================
  // PART 4: SHORT TALKS / ANNOUNCEMENTS (LISTENING - 12 QUESTIONS ACROSS 4 GROUPS)
  // ===========================================================================
  // --- GROUP P4_1 (3 questions) ---
  {
    id: 'toeic_p4_1',
    part: 'part4_talks',
    skill: 'listening',
    difficulty: 'easy',
    topic: 'Airport Announcement',
    subSkill: 'cause_identification',
    questionType: 'detail',
    groupId: 'toeic_grp_p4_1',
    audioGroupId: 'toeic_grp_p4_1',
    vocabularyTags: ['adverse', 'departure', 'delay'],
    grammarTags: ['prepositional_due_to'],
    estimatedDifficulty: 450,
    audioScript: 'Attention passengers on Flight VN-204 to Tokyo. Due to adverse weather conditions at the destination airport, our departure has been delayed by approximately forty-five minutes. Please remain seated near Gate 12 for further updates.',
    questionText: 'Part 4: Why has the flight departure been delayed?',
    options: [
      'A. Mechanical maintenance issues',
      'B. Severe weather at the destination',
      'C. Air traffic controller strike',
      'D. Late arrival of flight crew'
    ],
    correctAnswer: 'B',
    explanation: 'Người thông báo nêu nguyên nhân: "Due to adverse weather conditions at the destination airport".',
    vietnameseTranslation: 'Tại sao chuyến bay bị hoãn khởi hành? (B) Thời tiết xấu tại sân bay đến.',
    keyVocabulary: [
      { word: 'Adverse', ipa: '/ˈæd.vɜːs/', meaning: 'Bất lợi' },
      { word: 'Departure', ipa: '/dɪˈpɑː.tʃər/', meaning: 'Khởi hành' }
    ]
  },
  {
    id: 'toeic_p4_1_b',
    part: 'part4_talks',
    skill: 'listening',
    difficulty: 'easy',
    topic: 'Airport Announcement',
    subSkill: 'duration_extraction',
    questionType: 'detail',
    groupId: 'toeic_grp_p4_1',
    audioGroupId: 'toeic_grp_p4_1',
    vocabularyTags: ['delayed', 'minutes'],
    grammarTags: ['passive_voice'],
    estimatedDifficulty: 420,
    audioScript: 'Attention passengers on Flight VN-204 to Tokyo. Due to adverse weather conditions at the destination airport, our departure has been delayed by approximately forty-five minutes. Please remain seated near Gate 12 for further updates.',
    questionText: 'Part 4: How long is the anticipated flight delay?',
    options: [
      'A. Fifteen minutes',
      'B. Thirty minutes',
      'C. Forty-five minutes',
      'D. Two hours'
    ],
    correctAnswer: 'C',
    explanation: 'Thông báo nêu rõ: "...delayed by approximately forty-five minutes".',
    vietnameseTranslation: 'Chuyến bay dự kiến bị hoãn bao lâu? (C) Khoảng 45 phút.',
    keyVocabulary: [
      { word: 'Approximately', ipa: '/əˈprɒk.sɪ.mət.li/', meaning: 'Xấp xỉ, khoảng chừng' }
    ]
  },
  {
    id: 'toeic_p4_1_c',
    part: 'part4_talks',
    skill: 'listening',
    difficulty: 'easy',
    topic: 'Airport Announcement',
    subSkill: 'instruction_identification',
    questionType: 'detail',
    groupId: 'toeic_grp_p4_1',
    audioGroupId: 'toeic_grp_p4_1',
    vocabularyTags: ['remain', 'gate', 'seated'],
    grammarTags: ['imperative_polite'],
    estimatedDifficulty: 430,
    audioScript: 'Attention passengers on Flight VN-204 to Tokyo. Due to adverse weather conditions at the destination airport, our departure has been delayed by approximately forty-five minutes. Please remain seated near Gate 12 for further updates.',
    questionText: 'Part 4: Where should passengers wait for additional announcements?',
    options: [
      'A. Near Gate 12',
      'B. Inside the departure lounge cafeteria',
      'C. Outside the baggage claim area',
      'D. At the customer ticketing counter'
    ],
    correctAnswer: 'A',
    explanation: 'Thông báo yêu cầu: "Please remain seated near Gate 12 for further updates".',
    vietnameseTranslation: 'Hành khách nên đợi ở đâu để nhận thông báo tiếp theo? (A) Gần Cổng số 12.',
    keyVocabulary: [
      { word: 'Remain seated', ipa: '/rɪˈmeɪn ˈsiː.tɪd/', meaning: 'Tiếp tục ngồi tại chỗ' }
    ]
  },

  // --- GROUP P4_2 (3 questions) ---
  {
    id: 'toeic_p4_2',
    part: 'part4_talks',
    skill: 'listening',
    difficulty: 'medium',
    topic: 'Corporate Operations',
    subSkill: 'benefit_extraction',
    questionType: 'detail',
    groupId: 'toeic_grp_p4_2',
    audioGroupId: 'toeic_grp_p4_2',
    vocabularyTags: ['turnaround', 'distribution_center', 'facility'],
    grammarTags: ['comparative'],
    estimatedDifficulty: 620,
    audioScript: 'Good morning everyone. As Director of Operations, I am thrilled to announce that our new regional distribution center in Da Nang will officially open next month. This state-of-the-art facility will cut our average delivery turnaround from seventy-two hours down to less than twenty-four hours across the central provinces.',
    questionText: 'Part 4: What is the main benefit of the new distribution facility?',
    options: [
      'A. Reducing product manufacturing costs by half',
      'B. Lowering average delivery turnaround to under 24 hours',
      'C. Eliminating the need for third-party courier services',
      'D. Increasing warehouse employee count by fifty percent'
    ],
    correctAnswer: 'B',
    explanation: 'Người nói nhấn mạnh lợi ích: "cut our average delivery turnaround from seventy-two hours down to less than twenty-four hours".',
    vietnameseTranslation: 'Lợi ích chính của trung tâm phân phối mới là gì? (B) Giảm thời gian giao hàng xuống dưới 24 giờ.',
    keyVocabulary: [
      { word: 'Turnaround', ipa: '/ˈtɜːn.ə.raʊnd/', meaning: 'Thời gian hoàn tất một quy trình' }
    ]
  },
  {
    id: 'toeic_p4_2_b',
    part: 'part4_talks',
    skill: 'listening',
    difficulty: 'easy',
    topic: 'Corporate Operations',
    subSkill: 'speaker_identity',
    questionType: 'detail',
    groupId: 'toeic_grp_p4_2',
    audioGroupId: 'toeic_grp_p4_2',
    vocabularyTags: ['director', 'operations'],
    grammarTags: ['prepositional_as'],
    estimatedDifficulty: 410,
    audioScript: 'Good morning everyone. As Director of Operations, I am thrilled to announce that our new regional distribution center in Da Nang will officially open next month. This state-of-the-art facility will cut our average delivery turnaround from seventy-two hours down to less than twenty-four hours across the central provinces.',
    questionText: 'Part 4: Who is giving this talk?',
    options: [
      'A. The Director of Operations',
      'B. A regional sales representative',
      'C. An external logistics auditor',
      'D. A commercial delivery driver'
    ],
    correctAnswer: 'A',
    explanation: 'Người nói tự giới thiệu: "As Director of Operations, I am thrilled to announce...".',
    vietnameseTranslation: 'Ai là người đang phát biểu? (A) Giám đốc Vận hành.',
    keyVocabulary: [
      { word: 'Director of Operations', ipa: '/daɪˈrek.tər əv ˌɒp.ərˈeɪ.ʃənz/', meaning: 'Giám đốc Vận hành' }
    ]
  },
  {
    id: 'toeic_p4_2_c',
    part: 'part4_talks',
    skill: 'listening',
    difficulty: 'easy',
    topic: 'Corporate Operations',
    subSkill: 'timeline_extraction',
    questionType: 'detail',
    groupId: 'toeic_grp_p4_2',
    audioGroupId: 'toeic_grp_p4_2',
    vocabularyTags: ['officially', 'open', 'timeline'],
    grammarTags: ['future_simple'],
    estimatedDifficulty: 420,
    audioScript: 'Good morning everyone. As Director of Operations, I am thrilled to announce that our new regional distribution center in Da Nang will officially open next month. This state-of-the-art facility will cut our average delivery turnaround from seventy-two hours down to less than twenty-four hours across the central provinces.',
    questionText: 'Part 4: When will the Da Nang distribution center open?',
    options: [
      'A. Later this week',
      'B. In two weeks',
      'C. Next month',
      'D. Next year'
    ],
    correctAnswer: 'C',
    explanation: 'Người nói nêu rõ mốc thời gian: "...will officially open next month".',
    vietnameseTranslation: 'Khi nào trung tâm phân phối Đà Nẵng mở cửa? (C) Vào tháng tới.',
    keyVocabulary: [
      { word: 'Officially', ipa: '/əˈfɪʃ.əl.i/', meaning: 'Một cách chính thức' }
    ]
  },

  // --- GROUP P4_3 (3 questions) ---
  {
    id: 'toeic_p4_3',
    part: 'part4_talks',
    skill: 'listening',
    difficulty: 'easy',
    topic: 'Energy Conference',
    subSkill: 'location_extraction',
    questionType: 'detail',
    groupId: 'toeic_grp_p4_3',
    audioGroupId: 'toeic_grp_p4_3',
    vocabularyTags: ['summit', 'networking', 'keynotes'],
    grammarTags: ['future_time'],
    estimatedDifficulty: 480,
    audioScript: 'Welcome to this year’s International Green Energy Summit. Please be advised that keynotes by Dr. Tanaka and Minister Evans will take place in Hall A. All attendees are invited to join the networking buffet on the rooftop terrace starting at six o’clock this evening.',
    questionText: 'Part 4: Where will the networking buffet be held this evening?',
    options: [
      'A. In Conference Hall A',
      'B. On the rooftop terrace',
      'C. At the downtown convention dining room',
      'D. In the main exhibition lobby'
    ],
    correctAnswer: 'B',
    explanation: 'Người thông báo nêu địa điểm: "All attendees are invited to join the networking buffet on the rooftop terrace".',
    vietnameseTranslation: 'Tiệc buffet kết nối tối nay tổ chức ở đâu? (B) Trên sân thượng tầng mái.',
    keyVocabulary: [
      { word: 'Rooftop terrace', ipa: '/ˈruːf.tɒp ˈter.əs/', meaning: 'Sân thượng tầng mái' }
    ]
  },
  {
    id: 'toeic_p4_3_b',
    part: 'part4_talks',
    skill: 'listening',
    difficulty: 'easy',
    topic: 'Energy Conference',
    subSkill: 'location_extraction',
    questionType: 'detail',
    groupId: 'toeic_grp_p4_3',
    audioGroupId: 'toeic_grp_p4_3',
    vocabularyTags: ['keynotes', 'auditorium'],
    grammarTags: ['passive_voice'],
    estimatedDifficulty: 430,
    audioScript: 'Welcome to this year’s International Green Energy Summit. Please be advised that keynotes by Dr. Tanaka and Minister Evans will take place in Hall A. All attendees are invited to join the networking buffet on the rooftop terrace starting at six o’clock this evening.',
    questionText: 'Part 4: In which location will the keynote addresses be held?',
    options: [
      'A. In Hall A',
      'B. In Room 204',
      'C. On the rooftop',
      'D. In the outdoor garden'
    ],
    correctAnswer: 'A',
    explanation: 'Thông báo ghi rõ: "...keynotes by Dr. Tanaka and Minister Evans will take place in Hall A".',
    vietnameseTranslation: 'Các bài phát biểu chính sẽ diễn ra ở đâu? (A) Tại Hội trường A.',
    keyVocabulary: [
      { word: 'Keynotes', ipa: '/ˈkiː.nəʊts/', meaning: 'Các bài diễn thuyết quan trọng mở đầu' }
    ]
  },
  {
    id: 'toeic_p4_3_c',
    part: 'part4_talks',
    skill: 'listening',
    difficulty: 'easy',
    topic: 'Energy Conference',
    subSkill: 'main_theme',
    questionType: 'main_idea',
    groupId: 'toeic_grp_p4_3',
    audioGroupId: 'toeic_grp_p4_3',
    vocabularyTags: ['green_energy', 'summit'],
    grammarTags: ['present_simple'],
    estimatedDifficulty: 410,
    audioScript: 'Welcome to this year’s International Green Energy Summit. Please be advised that keynotes by Dr. Tanaka and Minister Evans will take place in Hall A. All attendees are invited to join the networking buffet on the rooftop terrace starting at six o’clock this evening.',
    questionText: 'Part 4: What is the main industry focus of this conference?',
    options: [
      'A. Commercial aircraft navigation',
      'B. Renewable and green energy',
      'C. Residential interior architecture',
      'D. Smartphone software development'
    ],
    correctAnswer: 'B',
    explanation: 'Ngay câu mở đầu: "Welcome to this year’s International Green Energy Summit".',
    vietnameseTranslation: 'Trọng tâm ngành của hội nghị này là gì? (B) Năng lượng xanh và tái tạo.',
    keyVocabulary: [
      { word: 'Green Energy', ipa: '/ɡriːn ˈen.ə.dʒi/', meaning: 'Năng lượng xanh' }
    ]
  },

  // --- GROUP P4_4 (3 questions) ---
  {
    id: 'toeic_p4_4_a',
    part: 'part4_talks',
    skill: 'listening',
    difficulty: 'hard',
    topic: 'Safety & Industrial Operations',
    subSkill: 'purpose_identification',
    questionType: 'main_idea',
    groupId: 'toeic_grp_p4_4',
    audioGroupId: 'toeic_grp_p4_4',
    vocabularyTags: ['maintenance', 'welding', 'assembly'],
    grammarTags: ['future_simple'],
    estimatedDifficulty: 730,
    audioScript: 'Attention all manufacturing personnel on the assembly floor. As part of our annual safety audit, routine maintenance on the robotic welding arms will begin at three o’clock today. All operators must wear certified protective goggles and high-visibility vests while entering Zone C. Please report any equipment anomalies directly to the shift supervisor.',
    questionText: 'Part 4: What is the primary purpose of this announcement?',
    options: [
      'A. Announcing an unexpected corporate merger',
      'B. Notifying workers of equipment maintenance and safety gear rules',
      'C. Warning staff about a severe thunderstorm approaching the area',
      'D. Promoting a weekend company retreat for factory managers'
    ],
    correctAnswer: 'B',
    explanation: 'Thông báo nêu lịch bảo trì máy móc lúc 3 giờ và yêu cầu đồ bảo hộ khi vào Zone C.',
    vietnameseTranslation: 'Mục đích chính của thông báo là gì? (B) Thông báo bảo trì máy móc và quy định đồ bảo hộ.',
    keyVocabulary: [
      { word: 'Safety audit', ipa: '/ˈseɪf.ti ˈɔː.dɪt/', meaning: 'Kiểm toán / thanh tra an toàn' }
    ]
  },
  {
    id: 'toeic_p4_4_b',
    part: 'part4_talks',
    skill: 'listening',
    difficulty: 'medium',
    topic: 'Safety & Industrial Operations',
    subSkill: 'detail_equipment',
    questionType: 'detail',
    groupId: 'toeic_grp_p4_4',
    audioGroupId: 'toeic_grp_p4_4',
    vocabularyTags: ['goggles', 'vests', 'protective'],
    grammarTags: ['modal_must'],
    estimatedDifficulty: 620,
    audioScript: 'Attention all manufacturing personnel on the assembly floor. As part of our annual safety audit, routine maintenance on the robotic welding arms will begin at three o’clock today. All operators must wear certified protective goggles and high-visibility vests while entering Zone C. Please report any equipment anomalies directly to the shift supervisor.',
    questionText: 'Part 4: What are workers required to wear when entering Zone C?',
    options: [
      'A. Protective goggles and high-visibility vests',
      'B. Rubber boots and cotton work gloves',
      'C. Heavy soundproof earphones and helmets',
      'D. Insulated jackets and thermal pants'
    ],
    correctAnswer: 'A',
    explanation: 'Người thông báo nêu: "All operators must wear certified protective goggles and high-visibility vests while entering Zone C".',
    vietnameseTranslation: 'Công nhân phải mặc đồ gì khi vào Khu vực C? (A) Kính bảo hộ và áo phản quang.',
    keyVocabulary: [
      { word: 'High-visibility vests', ipa: '/ˌhaɪ.vɪz.əˈbɪl.ə.ti vests/', meaning: 'Áo ghi-lê phản quang an toàn' }
    ]
  },
  {
    id: 'toeic_p4_4_c',
    part: 'part4_talks',
    skill: 'listening',
    difficulty: 'medium',
    topic: 'Safety & Industrial Operations',
    subSkill: 'instruction_identification',
    questionType: 'next_action',
    groupId: 'toeic_grp_p4_4',
    audioGroupId: 'toeic_grp_p4_4',
    vocabularyTags: ['anomalies', 'supervisor', 'report'],
    grammarTags: ['imperative_polite'],
    estimatedDifficulty: 650,
    audioScript: 'Attention all manufacturing personnel on the assembly floor. As part of our annual safety audit, routine maintenance on the robotic welding arms will begin at three o’clock today. All operators must wear certified protective goggles and high-visibility vests while entering Zone C. Please report any equipment anomalies directly to the shift supervisor.',
    questionText: 'Part 4: What should workers do if they observe equipment malfunctions?',
    options: [
      'A. Turn off the factory power grid completely',
      'B. Attempt to rewire the welding apparatus themselves',
      'C. Order replacement parts from an online supplier',
      'D. Report the anomalies directly to the shift supervisor'
    ],
    correctAnswer: 'D',
    explanation: 'Câu kết thông báo: "Please report any equipment anomalies directly to the shift supervisor".',
    vietnameseTranslation: 'Công nhân nên làm gì nếu phát hiện thiết bị bất thường? (D) Báo cáo trực tiếp cho người giám sát ca.',
    keyVocabulary: [
      { word: 'Shift supervisor', ipa: '/ʃɪft ˈsuː.pə.vaɪ.zər/', meaning: 'Người giám sát ca làm việc' }
    ]
  },

  // --- GROUP P4_5 (3 questions - Fire Drill Announcement) ---
  {
    id: 'toeic_p4_5_a',
    part: 'part4_talks',
    skill: 'listening',
    difficulty: 'easy',
    estimatedDifficulty: 440,
    topic: 'Workplace Safety & Facility Operations',
    subSkill: 'purpose',
    questionType: 'main_idea',
    groupId: 'toeic_grp_p4_5',
    audioGroupId: 'toeic_grp_p4_5',
    vocabularyTags: ['evacuation', 'drill', 'stairwell'],
    grammarTags: ['imperative_polite'],
    audioScript:
      'Attention all employees in the North Tower. At ten thirty this morning, building management will conduct an unannounced fire evacuation drill. When the alarm sounds, please cease all work, secure confidential documents, and proceed calmly to the nearest marked emergency stairwell. Do not use the elevators under any circumstances. Once outside, assemble at designated Assembly Point 3 in the courtyard behind the main lobby.',
    questionText: 'Part 4: What is the main objective of this fire safety announcement?',
    options: [
      'A. Announcing a temporary power outage',
      'B. Notifying workers about an upcoming fire evacuation drill',
      'C. Introducing new security personnel in the North Tower',
      'D. Rescheduling an executive board meeting'
    ],
    correctAnswer: 'B',
    explanation: 'Người thông báo nêu: "...building management will conduct an unannounced fire evacuation drill".',
    vietnameseTranslation: 'Mục đích chính của thông báo là gì? (B) Thông báo cho nhân viên về cuộc diễn tập sơ tán hỏa hoạn.',
    keyVocabulary: [
      { word: 'Evacuation', ipa: '/ɪˌvæk.juˈeɪ.ʃən/', meaning: 'Sự sơ tán' }
    ]
  },
  {
    id: 'toeic_p4_5_b',
    part: 'part4_talks',
    skill: 'listening',
    difficulty: 'easy',
    estimatedDifficulty: 450,
    topic: 'Workplace Safety & Facility Operations',
    subSkill: 'negative_fact',
    questionType: 'negative_fact',
    groupId: 'toeic_grp_p4_5',
    audioGroupId: 'toeic_grp_p4_5',
    vocabularyTags: ['elevators', 'emergency', 'prohibited'],
    grammarTags: ['negative_imperative'],
    audioScript:
      'Attention all employees in the North Tower. At ten thirty this morning, building management will conduct an unannounced fire evacuation drill. When the alarm sounds, please cease all work, secure confidential documents, and proceed calmly to the nearest marked emergency stairwell. Do not use the elevators under any circumstances. Once outside, assemble at designated Assembly Point 3 in the courtyard behind the main lobby.',
    questionText: 'Part 4: What are employees instructed NOT to do during the drill?',
    options: [
      'A. Lock their office doors',
      'B. Gather in the courtyard',
      'C. Use the elevators under any circumstances',
      'D. Carry confidential documents'
    ],
    correctAnswer: 'C',
    explanation: 'Thông báo nêu rõ: "Do not use the elevators under any circumstances".',
    vietnameseTranslation: 'Nhân viên được hướng dẫn KHÔNG được làm gì trong lúc diễn tập? (C) Không được sử dụng thang máy trong bất kỳ trường hợp nào.',
    keyVocabulary: [
      { word: 'Circumstances', ipa: '/ˈsɜː.kəm.stɑːn.sɪz/', meaning: 'Hoàn cảnh, trường hợp' }
    ]
  },
  {
    id: 'toeic_p4_5_c',
    part: 'part4_talks',
    skill: 'listening',
    difficulty: 'easy',
    estimatedDifficulty: 460,
    topic: 'Workplace Safety & Facility Operations',
    subSkill: 'location_identification',
    questionType: 'detail',
    groupId: 'toeic_grp_p4_5',
    audioGroupId: 'toeic_grp_p4_5',
    vocabularyTags: ['assembly_point', 'courtyard', 'lobby'],
    grammarTags: ['prepositional_location'],
    audioScript:
      'Attention all employees in the North Tower. At ten thirty this morning, building management will conduct an unannounced fire evacuation drill. When the alarm sounds, please cease all work, secure confidential documents, and proceed calmly to the nearest marked emergency stairwell. Do not use the elevators under any circumstances. Once outside, assemble at designated Assembly Point 3 in the courtyard behind the main lobby.',
    questionText: 'Part 4: Where should employees assemble once they exit the building?',
    options: [
      'A. At designated Assembly Point 3 in the courtyard',
      'B. Across the street at the metro station',
      'C. Inside the cafeteria on the ground floor',
      'D. In the underground visitor parking garage'
    ],
    correctAnswer: 'A',
    explanation: 'Thông báo kết luận: "assemble at designated Assembly Point 3 in the courtyard behind the main lobby".',
    vietnameseTranslation: 'Nhân viên nên tập hợp ở đâu sau khi ra khỏi tòa nhà? (A) Tại Điểm tập kết số 3 được chỉ định ở sân trong.',
    keyVocabulary: [
      { word: 'Courtyard', ipa: '/ˈkɔːt.jɑːd/', meaning: 'Sân trong tòa nhà' }
    ]
  },

  // --- GROUP P4_6 (3 questions - Client Delay Voicemail) ---
  {
    id: 'toeic_p4_6_a',
    part: 'part4_talks',
    skill: 'listening',
    difficulty: 'medium',
    estimatedDifficulty: 560,
    topic: 'Client Services & Web Development',
    subSkill: 'purpose',
    questionType: 'main_idea',
    groupId: 'toeic_grp_p4_6',
    audioGroupId: 'toeic_grp_p4_6',
    vocabularyTags: ['voicemail', 'status_update', 'redesign'],
    grammarTags: ['present_continuous'],
    audioScript:
      'Hello, Mr. Delgado. This is Fiona Gallagher calling from Apex Digital Media. I am calling to provide a status update on your company’s website redesign project. Our front-end team has encountered unexpected compatibility delays with your existing inventory database API. Consequently, our beta launch date will need to shift from November twelfth to November nineteenth. I have attached an updated development milestone timetable to your email, and I am available for a phone conference tomorrow morning at nine to review any questions.',
    questionText: 'Part 4: Why is Fiona Gallagher calling Mr. Delgado?',
    options: [
      'A. To request payment for an overdue design invoice',
      'B. To report an unexpected project delay and revised launch schedule',
      'C. To cancel the website redesign contract entirely',
      'D. To propose hiring additional external freelancers'
    ],
    correctAnswer: 'B',
    explanation: 'Fiona nói: "I am calling to provide a status update on your company’s website redesign project... beta launch date will need to shift...".',
    vietnameseTranslation: 'Tại sao Fiona Gallagher gọi cho ông Delgado? (B) Để thông báo sự chậm trễ dự án và lịch trình ra mắt đã sửa đổi.',
    keyVocabulary: [
      { word: 'Milestone', ipa: '/ˈmaɪl.stəʊn/', meaning: 'Cột mốc tiến độ dự án' }
    ]
  },
  {
    id: 'toeic_p4_6_b',
    part: 'part4_talks',
    skill: 'listening',
    difficulty: 'medium',
    estimatedDifficulty: 570,
    topic: 'Client Services & Web Development',
    subSkill: 'cause_identification',
    questionType: 'detail',
    groupId: 'toeic_grp_p4_6',
    audioGroupId: 'toeic_grp_p4_6',
    vocabularyTags: ['compatibility', 'database', 'api'],
    grammarTags: ['present_perfect'],
    audioScript:
      'Hello, Mr. Delgado. This is Fiona Gallagher calling from Apex Digital Media. I am calling to provide a status update on your company’s website redesign project. Our front-end team has encountered unexpected compatibility delays with your existing inventory database API. Consequently, our beta launch date will need to shift from November twelfth to November nineteenth. I have attached an updated development milestone timetable to your email, and I am available for a phone conference tomorrow morning at nine to review any questions.',
    questionText: 'Part 4: What is the cause of the project postponement?',
    options: [
      'A. Severe server downtime at the hosting facility',
      'B. Compatibility delays with an existing inventory database API',
      'C. Resignations among senior graphic designers',
      'D. Disagreements regarding corporate logo color schemes'
    ],
    correctAnswer: 'B',
    explanation: 'Người nói giải thích: "Our front-end team has encountered unexpected compatibility delays with your existing inventory database API".',
    vietnameseTranslation: 'Nguyên nhân dẫn đến việc hoãn dự án là gì? (B) Sự chậm trễ do vấn đề tương thích với API cơ sở dữ liệu hàng tồn kho.',
    keyVocabulary: [
      { word: 'Compatibility', ipa: '/kəmˌpæt.əˈbɪl.ə.ti/', meaning: 'Tính tương thích kỹ thuật' }
    ]
  },
  {
    id: 'toeic_p4_6_c',
    part: 'part4_talks',
    skill: 'listening',
    difficulty: 'medium',
    estimatedDifficulty: 580,
    topic: 'Client Services & Web Development',
    subSkill: 'detail',
    questionType: 'detail',
    groupId: 'toeic_grp_p4_6',
    audioGroupId: 'toeic_grp_p4_6',
    vocabularyTags: ['timetable', 'milestone', 'attached'],
    grammarTags: ['present_perfect_attached'],
    audioScript:
      'Hello, Mr. Delgado. This is Fiona Gallagher calling from Apex Digital Media. I am calling to provide a status update on your company’s website redesign project. Our front-end team has encountered unexpected compatibility delays with your existing inventory database API. Consequently, our beta launch date will need to shift from November twelfth to November nineteenth. I have attached an updated development milestone timetable to your email, and I am available for a phone conference tomorrow morning at nine to review any questions.',
    questionText: 'Part 4: What has the speaker sent by email?',
    options: [
      'A. A contract termination agreement',
      'B. Photographs of the redesign team',
      'C. An updated development milestone timetable',
      'D. A revised billing statement with discounts'
    ],
    correctAnswer: 'C',
    explanation: 'Người nói khẳng định: "I have attached an updated development milestone timetable to your email...".',
    vietnameseTranslation: 'Người nói đã gửi tài liệu gì qua email? (C) Bảng tiến độ các mốc phát triển cập nhật.',
    keyVocabulary: [
      { word: 'Timetable', ipa: '/ˈtaɪmˌteɪ.bəl/', meaning: 'Thời gian biểu, tiến độ' }
    ]
  },

  // --- GROUP P4_7 (3 questions - Expo Keynote Introduction) ---
  {
    id: 'toeic_p4_7_a',
    part: 'part4_talks',
    skill: 'listening',
    difficulty: 'medium',
    estimatedDifficulty: 600,
    topic: 'Conferences & Keynote Presentation',
    subSkill: 'intended_audience',
    questionType: 'inference',
    groupId: 'toeic_grp_p4_7',
    audioGroupId: 'toeic_grp_p4_7',
    vocabularyTags: ['delegates', 'expo', 'logistics'],
    grammarTags: ['vocative_greeting'],
    audioScript:
      'Good afternoon, distinguished guests and industry delegates. Welcome to Session B of the Global Logistics Expo. It is my sincere honor to introduce our keynote speaker, Ms. Hiroko Sato, Vice President of Sustainable Supply Chains at Orion Freight. Over the past decade, Ms. Sato has pioneered automated port handling solutions that reduce greenhouse gas emissions by up to forty percent. Following her forty-minute presentation, we will open the floor for audience questions. Please ensure your mobile devices are set to silent mode.',
    questionText: 'Part 4: Who is the intended audience for this introductory speech?',
    options: [
      'A. High school students visiting an art museum',
      'B. Construction laborers at a building site',
      'C. Attendees and delegates at a logistics conference',
      'D. Passengers waiting at an international train station'
    ],
    correctAnswer: 'C',
    explanation: 'Người nói mở đầu: "Good afternoon, distinguished guests and industry delegates. Welcome to Session B of the Global Logistics Expo".',
    vietnameseTranslation: 'Đối tượng người nghe dự kiến của bài phát biểu khai mạc này là ai? (C) Khách tham dự và đại biểu tại một hội nghị logistics.',
    keyVocabulary: [
      { word: 'Delegates', ipa: '/ˈdel.ɪ.ɡəts/', meaning: 'Các đại biểu' }
    ]
  },
  {
    id: 'toeic_p4_7_b',
    part: 'part4_talks',
    skill: 'listening',
    difficulty: 'medium',
    estimatedDifficulty: 610,
    topic: 'Conferences & Keynote Presentation',
    subSkill: 'detail',
    questionType: 'detail',
    groupId: 'toeic_grp_p4_7',
    audioGroupId: 'toeic_grp_p4_7',
    vocabularyTags: ['pioneered', 'emissions', 'automated'],
    grammarTags: ['present_perfect'],
    audioScript:
      'Good afternoon, distinguished guests and industry delegates. Welcome to Session B of the Global Logistics Expo. It is my sincere honor to introduce our keynote speaker, Ms. Hiroko Sato, Vice President of Sustainable Supply Chains at Orion Freight. Over the past decade, Ms. Sato has pioneered automated port handling solutions that reduce greenhouse gas emissions by up to forty percent. Following her forty-minute presentation, we will open the floor for audience questions. Please ensure your mobile devices are set to silent mode.',
    questionText: 'Part 4: What notable achievement of Ms. Sato is highlighted?',
    options: [
      'A. Developing automated port solutions reducing emissions by 40%',
      'B. Publishing a best-selling novel about international trade',
      'C. Founding the largest air courier carrier in Asia',
      'D. Negotiating tariff reductions between five countries'
    ],
    correctAnswer: 'A',
    explanation: 'Người nói nêu: "...Ms. Sato has pioneered automated port handling solutions that reduce greenhouse gas emissions by up to forty percent".',
    vietnameseTranslation: 'Thành tựu đáng chú ý nào của bà Sato được nhấn mạnh? (A) Phát triển các giải pháp cảng tự động giúp giảm 40% phát thải.',
    keyVocabulary: [
      { word: 'Pioneered', ipa: '/ˌpaɪəˈnɪəd/', meaning: 'Tiên phong phát triển' }
    ]
  },
  {
    id: 'toeic_p4_7_c',
    part: 'part4_talks',
    skill: 'listening',
    difficulty: 'medium',
    estimatedDifficulty: 620,
    topic: 'Conferences & Keynote Presentation',
    subSkill: 'next_action',
    questionType: 'detail',
    groupId: 'toeic_grp_p4_7',
    audioGroupId: 'toeic_grp_p4_7',
    vocabularyTags: ['presentation', 'questions', 'floor'],
    grammarTags: ['future_simple'],
    audioScript:
      'Good afternoon, distinguished guests and industry delegates. Welcome to Session B of the Global Logistics Expo. It is my sincere honor to introduce our keynote speaker, Ms. Hiroko Sato, Vice President of Sustainable Supply Chains at Orion Freight. Over the past decade, Ms. Sato has pioneered automated port handling solutions that reduce greenhouse gas emissions by up to forty percent. Following her forty-minute presentation, we will open the floor for audience questions. Please ensure your mobile devices are set to silent mode.',
    questionText: 'Part 4: What will happen immediately following Ms. Sato’s speech?',
    options: [
      'A. A formal banquet lunch in the ballroom',
      'B. An interactive audience question-and-answer session',
      'C. A demonstration of robotic loading equipment',
      'D. An award presentation ceremony for sponsors'
    ],
    correctAnswer: 'B',
    explanation: 'Người nói thông báo: "Following her forty-minute presentation, we will open the floor for audience questions".',
    vietnameseTranslation: 'Điều gì sẽ diễn ra ngay sau bài phát biểu của bà Sato? (B) Phiên hỏi đáp tương tác với khán giả.',
    keyVocabulary: [
      { word: 'Open the floor', ipa: '/ˈəʊ.pən ðə flɔːr/', meaning: 'Mở diễn đàn cho khán giả đặt câu hỏi' }
    ]
  },

  // --- GROUP P4_8 (3 questions - Highway Traffic Advisory) ---
  {
    id: 'toeic_p4_8_a',
    part: 'part4_talks',
    skill: 'listening',
    difficulty: 'hard',
    estimatedDifficulty: 710,
    topic: 'Transportation & Public Broadcast',
    subSkill: 'cause_identification',
    questionType: 'detail',
    groupId: 'toeic_grp_p4_8',
    audioGroupId: 'toeic_grp_p4_8',
    vocabularyTags: ['flooding', 'downpour', 'bridge'],
    grammarTags: ['participial_resulting'],
    audioScript:
      'This is Metro Transit 24 with your peak-hour regional travel bulletin. Severe flash flooding resulting from an unseasonal coastal downpour has forced the Department of Transportation to close two northbound lanes on the Interstate 80 bridge. Motorists traveling toward the downtown business district should expect bumper-to-bumper delays exceeding fifty minutes. Commuters are strongly urged to divert onto Route 4 express lanes or utilize the commuter rail system, which is currently running on full schedule with additional express coaches.',
    questionText: 'Part 4: What is causing the severe traffic congestion on Interstate 80?',
    options: [
      'A. A multi-vehicle collision near the toll plaza',
      'B. Ongoing scheduled repaving of highway asphalt',
      'C. A protest march obstructing downtown intersections',
      'D. Flash flooding caused by heavy coastal rain'
    ],
    correctAnswer: 'D',
    explanation: 'Bản tin cho biết: "Severe flash flooding resulting from an unseasonal coastal downpour has forced... to close two northbound lanes...".',
    vietnameseTranslation: 'Nguyên nhân gây tắc nghẽn giao thông nghiêm trọng trên Quốc lộ 80 là gì? (D) Ngập lụt cục bộ do mưa lớn ven biển.',
    keyVocabulary: [
      { word: 'Downpour', ipa: '/ˈdaʊn.pɔːr/', meaning: 'Cơn mưa rào như trút nước' }
    ]
  },
  {
    id: 'toeic_p4_8_b',
    part: 'part4_talks',
    skill: 'listening',
    difficulty: 'hard',
    estimatedDifficulty: 720,
    topic: 'Transportation & Public Broadcast',
    subSkill: 'detail_number',
    questionType: 'detail',
    groupId: 'toeic_grp_p4_8',
    audioGroupId: 'toeic_grp_p4_8',
    vocabularyTags: ['delays', 'motorists', 'bumper-to-bumper'],
    grammarTags: ['prepositional_exceeding'],
    audioScript:
      'This is Metro Transit 24 with your peak-hour regional travel bulletin. Severe flash flooding resulting from an unseasonal coastal downpour has forced the Department of Transportation to close two northbound lanes on the Interstate 80 bridge. Motorists traveling toward the downtown business district should expect bumper-to-bumper delays exceeding fifty minutes. Commuters are strongly urged to divert onto Route 4 express lanes or utilize the commuter rail system, which is currently running on full schedule with additional express coaches.',
    questionText: 'Part 4: How long are downtown-bound motorists expected to be delayed?',
    options: [
      'A. Over fifty minutes',
      'B. Approximately fifteen minutes',
      'C. Nearly two hours',
      'D. Less than half an hour'
    ],
    correctAnswer: 'A',
    explanation: 'Bản tin nêu: "Motorists traveling toward the downtown business district should expect bumper-to-bumper delays exceeding fifty minutes".',
    vietnameseTranslation: 'Người lái xe hướng về trung tâm dự kiến bị trễ bao lâu? (A) Hơn năm mươi phút.',
    keyVocabulary: [
      { word: 'Bumper-to-bumper', ipa: '/ˌbʌm.pə.təˈbʌm.pər/', meaning: 'Nối đuôi nhau sát nút (ùn tắc)' }
    ]
  },
  {
    id: 'toeic_p4_8_c',
    part: 'part4_talks',
    skill: 'listening',
    difficulty: 'hard',
    estimatedDifficulty: 730,
    topic: 'Transportation & Public Broadcast',
    subSkill: 'recommendation_identification',
    questionType: 'detail',
    groupId: 'toeic_grp_p4_8',
    audioGroupId: 'toeic_grp_p4_8',
    vocabularyTags: ['divert', 'commuter_rail', 'express'],
    grammarTags: ['passive_urged'],
    audioScript:
      'This is Metro Transit 24 with your peak-hour regional travel bulletin. Severe flash flooding resulting from an unseasonal coastal downpour has forced the Department of Transportation to close two northbound lanes on the Interstate 80 bridge. Motorists traveling toward the downtown business district should expect bumper-to-bumper delays exceeding fifty minutes. Commuters are strongly urged to divert onto Route 4 express lanes or utilize the commuter rail system, which is currently running on full schedule with additional express coaches.',
    questionText: 'Part 4: What alternative does the broadcaster suggest for commuters?',
    options: [
      'A. Walking across the pedestrian suspension footbridge',
      'B. Delaying departures until after eight o’clock tonight',
      'C. Diverting onto Route 4 or taking commuter rail trains',
      'D. Working from home for the remainder of the week'
    ],
    correctAnswer: 'C',
    explanation: 'Người phát thanh khuyên: "Commuters are strongly urged to divert onto Route 4 express lanes or utilize the commuter rail system...".',
    vietnameseTranslation: 'Người phát thanh đề xuất giải pháp thay thế nào cho người đi làm? (C) Chuyển sang Tuyến đường 4 hoặc đi tàu hỏa nội đô.',
    keyVocabulary: [
      { word: 'Divert', ipa: '/daɪˈvɜːt/', meaning: 'Chuyển hướng di chuyển' }
    ]
  },

  // --- GROUP P4_9 (3 questions - Robotics Calibration Instructions) ---
  {
    id: 'toeic_p4_9_a',
    part: 'part4_talks',
    skill: 'listening',
    difficulty: 'hard',
    estimatedDifficulty: 750,
    topic: 'Industrial Engineering & Manufacturing',
    subSkill: 'detail',
    questionType: 'detail',
    groupId: 'toeic_grp_p4_9',
    audioGroupId: 'toeic_grp_p4_9',
    vocabularyTags: ['precision_drift', 'robotics', 'calibration'],
    grammarTags: ['prepositional_following'],
    audioScript:
      'Good morning, shift technicians. Before we initiate production run forty-seven on the microchip assembly line, I need your complete attention regarding sensor recalibration protocols. Following yesterday’s precision drift on robotic pick-and-place units three and four, all line operators must execute manual optical alignments every ninety minutes rather than once per shift. Record all laser refraction tolerances in the digital maintenance log. If optical deviation exceeds zero point zero two millimeters, halt the conveyer belt immediately and alert quality assurance.',
    questionText: 'Part 4: What problem occurred during the previous shift?',
    options: [
      'A. Complete electrical power blackout in the plant',
      'B. Precision drift on robotic pick-and-place assembly units',
      'C. Defective silicon wafers delivered by a supplier',
      'D. An unexpected strike by packaging line operators'
    ],
    correctAnswer: 'B',
    explanation: 'Người nói giải thích: "Following yesterday’s precision drift on robotic pick-and-place units three and four...".',
    vietnameseTranslation: 'Sự cố nào đã xảy ra trong ca làm việc hôm trước? (B) Sai lệch độ chính xác ở các tay robot gắp đặt linh kiện.',
    keyVocabulary: [
      { word: 'Precision drift', ipa: '/prɪˈsɪʒ.ən drɪft/', meaning: 'Sự trôi / sai lệch độ chuẩn xác' }
    ]
  },
  {
    id: 'toeic_p4_9_b',
    part: 'part4_talks',
    skill: 'listening',
    difficulty: 'hard',
    estimatedDifficulty: 760,
    topic: 'Industrial Engineering & Manufacturing',
    subSkill: 'detail_frequency',
    questionType: 'detail',
    groupId: 'toeic_grp_p4_9',
    audioGroupId: 'toeic_grp_p4_9',
    vocabularyTags: ['alignments', 'optical', 'frequency'],
    grammarTags: ['adverbial_frequency'],
    audioScript:
      'Good morning, shift technicians. Before we initiate production run forty-seven on the microchip assembly line, I need your complete attention regarding sensor recalibration protocols. Following yesterday’s precision drift on robotic pick-and-place units three and four, all line operators must execute manual optical alignments every ninety minutes rather than once per shift. Record all laser refraction tolerances in the digital maintenance log. If optical deviation exceeds zero point zero two millimeters, halt the conveyer belt immediately and alert quality assurance.',
    questionText: 'Part 4: How frequently must line operators now conduct optical alignments?',
    options: [
      'A. Once per eight-hour shift',
      'B. Every forty-five minutes',
      'C. Every ninety minutes',
      'D. At the beginning of each week'
    ],
    correctAnswer: 'C',
    explanation: 'Người giám sát chỉ đạo: "...all line operators must execute manual optical alignments every ninety minutes rather than once per shift".',
    vietnameseTranslation: 'Người vận hành dây chuyền hiện phải căn chỉnh quang học với tần suất bao lâu một lần? (C) Mỗi 90 phút một lần.',
    keyVocabulary: [
      { word: 'Alignments', ipa: '/əˈlaɪn.mənts/', meaning: 'Các bước căn chỉnh độ thẳng/chính xác' }
    ]
  },
  {
    id: 'toeic_p4_9_c',
    part: 'part4_talks',
    skill: 'listening',
    difficulty: 'hard',
    estimatedDifficulty: 770,
    topic: 'Industrial Engineering & Manufacturing',
    subSkill: 'condition_action',
    questionType: 'inference',
    groupId: 'toeic_grp_p4_9',
    audioGroupId: 'toeic_grp_p4_9',
    vocabularyTags: ['deviation', 'halt', 'quality_assurance'],
    grammarTags: ['conditional_if'],
    audioScript:
      'Good morning, shift technicians. Before we initiate production run forty-seven on the microchip assembly line, I need your complete attention regarding sensor recalibration protocols. Following yesterday’s precision drift on robotic pick-and-place units three and four, all line operators must execute manual optical alignments every ninety minutes rather than once per shift. Record all laser refraction tolerances in the digital maintenance log. If optical deviation exceeds zero point zero two millimeters, halt the conveyer belt immediately and alert quality assurance.',
    questionText: 'Part 4: When are technicians instructed to stop the conveyer belt?',
    options: [
      'A. If optical deviation exceeds 0.02 millimeters',
      'B. When the digital maintenance tablet runs out of battery',
      'C. As soon as the afternoon shift supervisor arrives',
      'D. Whenever robotic unit four completes 500 microchips'
    ],
    correctAnswer: 'A',
    explanation: 'Người nói chỉ đạo: "If optical deviation exceeds zero point zero two millimeters, halt the conveyer belt immediately and alert quality assurance".',
    vietnameseTranslation: 'Kỹ thuật viên được hướng dẫn dừng băng chuyền khi nào? (A) Nếu độ lệch quang học vượt quá 0,02 mm.',
    keyVocabulary: [
      { word: 'Deviation', ipa: '/ˌdiː.viˈeɪ.ʃən/', meaning: 'Độ sai lệch' }
    ]
  },

  // ===========================================================================
  // PART 5: INCOMPLETE SENTENCES (READING - 18 QUESTIONS ACROSS GRAMMAR & VOCAB)
  // ===========================================================================
  {
    id: 'toeic_p5_1',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'easy',
    topic: 'HR Compensation',
    subSkill: 'adverb_usage',
    questionType: 'grammar_pos',
    vocabularyTags: ['distribute', 'eligible', 'bonus'],
    grammarTags: ['adverb_modification'],
    estimatedDifficulty: 400,
    questionText: 'The CEO announced that the quarterly bonus will be distributed _______ to all eligible full-time employees.',
    options: [
      'A. equal',
      'B. equally',
      'C. equality',
      'D. equalize'
    ],
    correctAnswer: 'B',
    explanation: 'Chỗ trống đứng sau động từ bị động "will be distributed", cần trạng từ "equally" để bổ nghĩa cho động từ.',
    vietnameseTranslation: 'Tổng giám đốc thông báo tiền thưởng quý sẽ được phân phối đồng đều cho nhân viên đủ điều kiện.',
    keyVocabulary: [
      { word: 'Distribute', ipa: '/dɪˈstrɪb.juːt/', meaning: 'Phân phối' },
      { word: 'Eligible', ipa: '/ˈel.ɪ.dʒə.bəl/', meaning: 'Đủ tư cách' }
    ]
  },
  {
    id: 'toeic_p5_2',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'easy',
    topic: 'Marketing & Asset',
    subSkill: 'adjective_usage',
    questionType: 'grammar_pos',
    vocabularyTags: ['valuable', 'asset', 'campaign'],
    grammarTags: ['adjective_modification'],
    estimatedDifficulty: 420,
    questionText: 'Ms. Henderson has proven to be a _______ asset to our international marketing campaign.',
    options: [
      'A. value',
      'B. valuable',
      'C. valuation',
      'D. valuably'
    ],
    correctAnswer: 'B',
    explanation: 'Chỗ trống đứng trước danh từ "asset", cần tính từ "valuable" để bổ nghĩa.',
    vietnameseTranslation: 'Cô Henderson đã chứng tỏ mình là một tài sản quý giá cho chiến dịch tiếp thị.',
    keyVocabulary: [
      { word: 'Valuable', ipa: '/ˈvæl.jə.bəl/', meaning: 'Quý giá' },
      { word: 'Asset', ipa: '/ˈæs.et/', meaning: 'Tài sản' }
    ]
  },
  {
    id: 'toeic_p5_3',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'medium',
    topic: 'Finance & Expense',
    subSkill: 'preposition_deadline',
    questionType: 'grammar_preposition',
    vocabularyTags: ['reimbursement', 'expense', 'submission'],
    grammarTags: ['preposition_by_vs_until'],
    estimatedDifficulty: 520,
    questionText: 'All travel expense reports must be submitted _______ Friday at 5:00 PM to receive reimbursement this month.',
    options: [
      'A. prior',
      'B. by',
      'C. until',
      'D. since'
    ],
    correctAnswer: 'B',
    explanation: 'Giới từ "by" diễn tả một mốc thời hạn phải hoàn tất muộn nhất vào thời điểm đó ("by Friday at 5:00 PM").',
    vietnameseTranslation: 'Tất cả báo cáo chi phí công tác phải được nộp trước 5 giờ chiều thứ Sáu.',
    keyVocabulary: [
      { word: 'Reimbursement', ipa: '/ˌriː.ɪmˈbɜːs.mənt/', meaning: 'Khoản thanh toán bồi hoàn' }
    ]
  },
  {
    id: 'toeic_p5_4',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'medium',
    topic: 'Business & Economy',
    subSkill: 'adjective_modifier',
    questionType: 'grammar_pos',
    vocabularyTags: ['trajectory', 'downturn', 'consistent'],
    grammarTags: ['noun_phrase'],
    estimatedDifficulty: 580,
    questionText: 'Despite the severe market downturn, our software division maintained its _______ growth trajectory.',
    options: [
      'A. consistent',
      'B. consistently',
      'C. consistency',
      'D. consist'
    ],
    correctAnswer: 'A',
    explanation: 'Đứng trước cụm danh từ "growth trajectory", cần tính từ "consistent" để bổ nghĩa.',
    vietnameseTranslation: 'Bất chấp sự suy thoái nghiêm trọng, mảng phần mềm vẫn duy trì quỹ đạo tăng trưởng ổn định.',
    keyVocabulary: [
      { word: 'Trajectory', ipa: '/trəˈdʒek.tər.i/', meaning: 'Quỹ đạo' }
    ]
  },
  {
    id: 'toeic_p5_5',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'medium',
    topic: 'International Trade',
    subSkill: 'clause_linking',
    questionType: 'grammar_conjunction',
    vocabularyTags: ['negotiations', 'bilateral', 'agreements'],
    grammarTags: ['causal_conjunction'],
    estimatedDifficulty: 600,
    questionText: 'Mr. Tanaka will lead the negotiations _______ he possesses extensive experience in bilateral trade agreements.',
    options: [
      'A. because',
      'B. although',
      'C. despite',
      'D. nevertheless'
    ],
    correctAnswer: 'A',
    explanation: 'Mệnh đề sau giải thích nguyên nhân cho việc ông Tanaka dẫn dắt đàm phán, theo sau là mệnh đề S + V, do đó dùng liên từ "because".',
    vietnameseTranslation: 'Ông Tanaka sẽ dẫn dắt đàm phán bởi vì ông có nhiều kinh nghiệm trong các hiệp định song phương.',
    keyVocabulary: [
      { word: 'Bilateral', ipa: '/ˌbaɪˈlæt.ər.əl/', meaning: 'Song phương' }
    ]
  },
  {
    id: 'toeic_p5_6',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'hard',
    topic: 'Project Management',
    subSkill: 'mandative_subjunctive',
    questionType: 'grammar_subjunctive',
    vocabularyTags: ['committee', 'revised', 'submit'],
    grammarTags: ['subjunctive_mood'],
    estimatedDifficulty: 750,
    questionText: 'The project committee has requested that all department heads _______ their revised quarterly goals by noon.',
    options: [
      'A. submits',
      'B. submit',
      'C. submitted',
      'D. submitting'
    ],
    correctAnswer: 'B',
    explanation: 'Cấu trúc bàng thái cách / giả định thức với động từ yêu cầu: "request that + S + (should) + V-bare infinitive". Do đó dùng "submit".',
    vietnameseTranslation: 'Ủy ban dự án yêu cầu tất cả trưởng bộ phận phải nộp mục tiêu điều chỉnh trước buổi trưa.',
    keyVocabulary: [
      { word: 'Revised', ipa: '/rɪˈvaɪzd/', meaning: 'Đã sửa đổi' }
    ]
  },
  {
    id: 'toeic_p5_7',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'easy',
    topic: 'Administrative Approvals',
    subSkill: 'noun_position',
    questionType: 'grammar_pos',
    vocabularyTags: ['approval', 'requisition', 'pending'],
    grammarTags: ['noun_formation'],
    estimatedDifficulty: 380,
    questionText: 'The purchase requisition will be processed once we receive formal _______ from the department director.',
    options: [
      'A. approve',
      'B. approving',
      'C. approval',
      'D. approved'
    ],
    correctAnswer: 'C',
    explanation: 'Đứng sau tính từ "formal", cần một danh từ. Chọn "approval" (sự phê duyệt chính thức).',
    vietnameseTranslation: 'Yêu cầu mua sắm sẽ được xử lý khi chúng tôi nhận được sự phê duyệt chính thức từ giám đốc bộ phận.',
    keyVocabulary: [
      { word: 'Approval', ipa: '/əˈpruː.vəl/', meaning: 'Sự phê duyệt' },
      { word: 'Requisition', ipa: '/ˌrek.wɪˈzɪʃ.ən/', meaning: 'Yêu cầu, đơn xin cấp vật tư' }
    ]
  },
  {
    id: 'toeic_p5_8',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'medium',
    topic: 'Project Milestones',
    subSkill: 'future_perfect_tense',
    questionType: 'grammar_tense',
    vocabularyTags: ['complete', 'milestone', 'schedule'],
    grammarTags: ['future_perfect'],
    estimatedDifficulty: 560,
    questionText: 'By the time the foreign delegation arrives next Thursday, our engineering team _______ the system migration.',
    options: [
      'A. will complete',
      'B. will have completed',
      'C. completed',
      'D. is completing'
    ],
    correctAnswer: 'B',
    explanation: 'Mệnh đề trạng ngữ chỉ thời gian với "By the time + hiện tại đơn (arrives)" chỉ một hành động sẽ hoàn tất trước một thời điểm trong tương lai, cần dùng thì Tương lai Hoàn thành "will have completed".',
    vietnameseTranslation: 'Trước thời điểm phái đoàn nước ngoài đến vào thứ Năm tới, đội ngũ kỹ thuật sẽ hoàn tất việc chuyển đổi hệ thống.',
    keyVocabulary: [
      { word: 'Delegation', ipa: '/ˌdel.ɪˈɡeɪ.ʃən/', meaning: 'Phái đoàn đại biểu' }
    ]
  },
  {
    id: 'toeic_p5_9',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'easy',
    topic: 'Security Regulations',
    subSkill: 'passive_with_modals',
    questionType: 'grammar_voice',
    vocabularyTags: ['escorted', 'visitors', 'identification'],
    grammarTags: ['passive_voice', 'modal_verbs'],
    estimatedDifficulty: 410,
    questionText: 'All temporary visitors _______ by a badged employee while inside the research laboratory.',
    options: [
      'A. must accompany',
      'B. must be accompanied',
      'C. must have accompanied',
      'D. accompanying'
    ],
    correctAnswer: 'B',
    explanation: 'Chủ ngữ "All temporary visitors" là đối tượng chịu tác động của hành động đi cùng (họ được nhân viên đi cùng), cần dạng bị động với khiếm khuyết động từ: "must be accompanied".',
    vietnameseTranslation: 'Tất cả khách tạm thời phải có nhân viên đeo thẻ đi cùng khi ở bên trong phòng thí nghiệm nghiên cứu.',
    keyVocabulary: [
      { word: 'Accompanied', ipa: '/əˈkʌm.pə.nid/', meaning: 'Được đi cùng, tháp tùng' }
    ]
  },
  {
    id: 'toeic_p5_10',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'medium',
    topic: 'Office Protocols',
    subSkill: 'preposition_distinction',
    questionType: 'grammar_preposition',
    vocabularyTags: ['holidays', 'operations', 'service'],
    grammarTags: ['preposition_except_for'],
    estimatedDifficulty: 520,
    questionText: 'Customer phone support is available seven days a week _______ official national public holidays.',
    options: [
      'A. except for',
      'B. in addition to',
      'C. owing to',
      'D. instead of'
    ],
    correctAnswer: 'A',
    explanation: '"Except for" mang nghĩa "ngoại trừ" các ngày lễ quốc gia. "Owing to" nghĩa là do/vì, "In addition to" là bên cạnh.',
    vietnameseTranslation: 'Tổng đài hỗ trợ khách hàng hoạt động 7 ngày một tuần ngoại trừ các ngày nghỉ lễ quốc gia chính thức.',
    keyVocabulary: [
      { word: 'Except for', ipa: '/ɪkˈsept fɔːr/', meaning: 'Ngoại trừ' }
    ]
  },
  {
    id: 'toeic_p5_11',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'medium',
    topic: 'Corporate Strategy',
    subSkill: 'correlative_conjunctions',
    questionType: 'grammar_conjunction',
    vocabularyTags: ['neither', 'viable', 'alternatives'],
    grammarTags: ['correlative_pairs'],
    estimatedDifficulty: 540,
    questionText: 'The feasibility study revealed that _______ the original proposal nor the revised alternative was economically viable.',
    options: [
      'A. either',
      'B. neither',
      'C. both',
      'D. whether'
    ],
    correctAnswer: 'B',
    explanation: 'Cặp liên từ tương hỗ đi với "nor" là "neither... nor" (cả cái này lẫn cái kia đều không). "Either" đi với "or".',
    vietnameseTranslation: 'Nghiên cứu khả thi chỉ ra rằng cả đề xuất ban đầu lẫn phương án sửa đổi đều không khả thi về mặt kinh tế.',
    keyVocabulary: [
      { word: 'Economically viable', ipa: '/ˌiː.kəˈnɒm.ɪ.kli ˈvaɪ.ə.bəl/', meaning: 'Khả thi về mặt kinh tế' }
    ]
  },
  {
    id: 'toeic_p5_12',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'hard',
    topic: 'Human Resources Hiring',
    subSkill: 'relative_pronoun_case',
    questionType: 'grammar_pronoun',
    vocabularyTags: ['candidate', 'credentials', 'impressive'],
    grammarTags: ['relative_clauses'],
    estimatedDifficulty: 680,
    questionText: 'We extended an employment offer to the senior developer _______ portfolio demonstrated extensive microservice expertise.',
    options: [
      'A. who',
      'B. whom',
      'C. whose',
      'D. which'
    ],
    correctAnswer: 'C',
    explanation: 'Cần một đại từ quan hệ mang tính sở hữu bổ nghĩa cho danh từ "portfolio" (hồ sơ dự án CỦA nhà phát triển đó). Chọn "whose".',
    vietnameseTranslation: 'Chúng tôi đã gửi lời mời làm việc tới nhà phát triển cấp cao có hồ sơ năng lực thể hiện chuyên môn sâu về microservice.',
    keyVocabulary: [
      { word: 'Portfolio', ipa: '/ˌpɔːtˈfəʊ.li.əʊ/', meaning: 'Hồ sơ năng lực, tập tác phẩm' }
    ]
  },
  {
    id: 'toeic_p5_13',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'medium',
    topic: 'Corporate Decision Making',
    subSkill: 'business_collocations',
    questionType: 'vocab_collocation',
    vocabularyTags: ['consensus', 'unanimous', 'deliberation'],
    grammarTags: ['verb_noun_collocation'],
    estimatedDifficulty: 610,
    questionText: 'After three hours of intensive deliberation, the executive committee finally reached a _______ regarding the merger.',
    options: [
      'A. consensus',
      'B. hesitation',
      'C. contradiction',
      'D. disturbance'
    ],
    correctAnswer: 'A',
    explanation: 'Cụm từ cố định trong tiếng Anh thương mại: "reach a consensus" (đạt được sự đồng thuận chung sau khi thảo luận).',
    vietnameseTranslation: 'Sau ba giờ bàn bạc kỹ lưỡng, ban điều hành cuối cùng đã đạt được sự đồng thuận về thương vụ sáp nhập.',
    keyVocabulary: [
      { word: 'Consensus', ipa: '/kənˈsen.səs/', meaning: 'Sự đồng thuận chung' },
      { word: 'Deliberation', ipa: '/dɪˌlɪb.əˈreɪ.ʃən/', meaning: 'Sự cân nhắc thảo luận kỹ' }
    ]
  },
  {
    id: 'toeic_p5_14',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'medium',
    topic: 'Financial Reporting',
    subSkill: 'adverb_degree',
    questionType: 'vocab_meaning',
    vocabularyTags: ['substantially', 'revenue', 'exceeded'],
    grammarTags: ['degree_adverb'],
    estimatedDifficulty: 590,
    questionText: 'Second-quarter net earnings were _______ higher than projected due to booming overseas sales.',
    options: [
      'A. substantially',
      'B. reluctantly',
      'C. mutually',
      'D. rigidly'
    ],
    correctAnswer: 'A',
    explanation: '"Substantially higher" là cụm từ chuẩn chỉ mức độ tăng đáng kể / vượt bậc. "Reluctantly" (miễn cưỡng), "Rigidly" (cứng nhắc).',
    vietnameseTranslation: 'Lợi nhuận ròng quý hai cao hơn đáng kể so với dự kiến nhờ doanh số bùng nổ ở thị trường nước ngoài.',
    keyVocabulary: [
      { word: 'Substantially', ipa: '/səbˈstæn.ʃəl.i/', meaning: 'Đáng kể, phần lớn' }
    ]
  },
  {
    id: 'toeic_p5_15',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'hard',
    topic: 'Workplace Stress',
    subSkill: 'participial_adjective',
    questionType: 'grammar_pos',
    vocabularyTags: ['demanding', 'schedule', 'resilience'],
    grammarTags: ['participle_as_adjective'],
    estimatedDifficulty: 670,
    questionText: 'Managing multiple enterprise implementations concurrently is a highly _______ task that requires exceptional focus.',
    options: [
      'A. demanded',
      'B. demanding',
      'C. demand',
      'D. demandingly'
    ],
    correctAnswer: 'B',
    explanation: '"A demanding task" sử dụng hiện tại phân từ V-ing đóng vai trò tính từ chủ động miêu tả tính chất của công việc (đòi hỏi khắt khe, áp lực cao).',
    vietnameseTranslation: 'Quản lý nhiều đợt triển khai cho doanh nghiệp cùng lúc là một nhiệm vụ đòi hỏi rất khắt khe cần sự tập trung cao độ.',
    keyVocabulary: [
      { word: 'Demanding', ipa: '/dɪˈmɑːn.dɪŋ/', meaning: 'Đòi hỏi khắt khe, nhiều thử thách' }
    ]
  },
  {
    id: 'toeic_p5_16',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'hard',
    topic: 'Organizational Performance',
    subSkill: 'negative_inversion',
    questionType: 'grammar_pos',
    vocabularyTags: ['rarely', 'enthusiasm', 'turnaround'],
    grammarTags: ['negative_inversion'],
    estimatedDifficulty: 780,
    questionText: 'Rarely _______ such enthusiasm among investors as when our renewable battery technology was unveiled.',
    options: [
      'A. we have witnessed',
      'B. have we witnessed',
      'C. we witnessed',
      'D. witnessing'
    ],
    correctAnswer: 'B',
    explanation: 'Cấu trúc đảo ngữ với trạng từ phủ định/bán phủ định đứng đầu câu ("Rarely"): Trợ động từ phải đảo lên trước chủ ngữ ("have we witnessed").',
    vietnameseTranslation: 'Hiếm khi chúng tôi chứng kiến sự hào hứng nhiệt thành của các nhà đầu tư như khi công nghệ pin tái tạo được công bố.',
    keyVocabulary: [
      { word: 'Unveiled', ipa: '/ʌnˈveɪld/', meaning: 'Được vén màn, công bố ra mắt' }
    ]
  },
  {
    id: 'toeic_p5_17',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'easy',
    topic: 'Customer Satisfaction',
    subSkill: 'phrasal_verbs',
    questionType: 'vocab_meaning',
    vocabularyTags: ['investigate', 'look_into', 'client'],
    grammarTags: ['phrasal_verb'],
    estimatedDifficulty: 430,
    questionText: 'The quality assurance supervisor promised to _______ the billing discrepancy immediately.',
    options: [
      'A. look into',
      'B. look after',
      'C. look through',
      'D. look out'
    ],
    correctAnswer: 'A',
    explanation: '"Look into" là cụm động từ có nghĩa là điều tra, xem xét kỹ lưỡng một vấn đề/khiếu nại. "Look after" là chăm sóc.',
    vietnameseTranslation: 'Giám sát đảm bảo chất lượng đã hứa sẽ điều tra sự sai lệch hóa đơn ngay lập tức.',
    keyVocabulary: [
      { word: 'Look into', ipa: '/lʊk ˈɪn.tuː/', meaning: 'Điều tra, kiểm tra kỹ' }
    ]
  },
  {
    id: 'toeic_p5_18',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'medium',
    topic: 'Hospitality Accommodations',
    subSkill: 'formal_verb_choice',
    questionType: 'vocab_meaning',
    vocabularyTags: ['accommodate', 'dietary', 'conference'],
    grammarTags: ['transitive_verb'],
    estimatedDifficulty: 580,
    questionText: 'Our convention hotel is fully equipped to _______ special dietary preferences with advanced notification.',
    options: [
      'A. accommodate',
      'B. terminate',
      'C. complicate',
      'D. contaminate'
    ],
    correctAnswer: 'A',
    explanation: 'Động từ "accommodate" trong ngữ cảnh dịch vụ/khách sạn mang nghĩa đáp ứng / phục vụ theo nhu cầu đặc biệt của khách.',
    vietnameseTranslation: 'Khách sạn hội nghị của chúng tôi được trang bị đầy đủ để đáp ứng các sở thích ăn kiêng đặc biệt nếu được báo trước.',
    keyVocabulary: [
      { word: 'Accommodate', ipa: '/əˈkɒm.ə.deɪt/', meaning: 'Đáp ứng nhu cầu, cung cấp tiện nghi' }
    ]
  },
  {
    id: 'toeic_p5_19',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'easy',
    estimatedDifficulty: 370,
    topic: 'Corporate Travel Policy',
    subSkill: 'possessive_pronoun',
    questionType: 'grammar_pronoun',
    vocabularyTags: ['receipts', 'expense', 'reimbursement'],
    grammarTags: ['possessive_adjective'],
    questionText: 'Employees attending the regional trade summit must retain _______ travel expense receipts to claim full reimbursement.',
    options: [
      'A. their',
      'B. theirs',
      'C. them',
      'D. they'
    ],
    correctAnswer: 'A',
    explanation: 'Chỗ trống đứng trước cụm danh từ "travel expense receipts", cần tính từ sở hữu "their" để bổ nghĩa.',
    vietnameseTranslation: 'Nhân viên tham dự hội nghị thương mại khu vực phải giữ lại biên lai chi phí đi lại của họ để yêu cầu hoàn trả đầy đủ.',
    keyVocabulary: [
      { word: 'Retain', ipa: '/rɪˈteɪn/', meaning: 'Giữ lại, duy trì' },
      { word: 'Reimbursement', ipa: '/ˌriː.ɪmˈbɜːs.mənt/', meaning: 'Khoản hoàn trả chi phí' }
    ]
  },
  {
    id: 'toeic_p5_20',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'easy',
    estimatedDifficulty: 390,
    topic: 'Office Energy Conservation',
    subSkill: 'preposition_time',
    questionType: 'grammar_preposition',
    vocabularyTags: ['workstation', 'monitors', 'conservation'],
    grammarTags: ['preposition_before_v_ing'],
    questionText: 'All personnel are kindly requested to switch off their workstation monitors _______ leaving the corporate building.',
    options: [
      'A. before',
      'B. during',
      'C. among',
      'D. between'
    ],
    correctAnswer: 'A',
    explanation: 'Giới từ chỉ thời gian "before" đi kèm V-ing ("before leaving") mang nghĩa "trước khi rời khỏi toà nhà".',
    vietnameseTranslation: 'Tất cả nhân viên được đề nghị tắt màn hình máy trạm trước khi rời khỏi tòa nhà công ty.',
    keyVocabulary: [
      { word: 'Switch off', ipa: '/swɪtʃ ɒf/', meaning: 'Tắt nguồn thiết bị' },
      { word: 'Workstation', ipa: '/ˈwɜːkˌsteɪ.ʃən/', meaning: 'Vị trí làm việc, máy trạm' }
    ]
  },
  {
    id: 'toeic_p5_21',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'easy',
    estimatedDifficulty: 400,
    topic: 'Financial Reporting',
    subSkill: 'adjective_modification',
    questionType: 'grammar_pos',
    vocabularyTags: ['remarkable', 'recovery', 'quarterly'],
    grammarTags: ['adjective_before_noun'],
    questionText: 'The quarterly audit report highlighted the company’s _______ recovery following the overseas supply disruption.',
    options: [
      'A. remarkable',
      'B. remarkably',
      'C. remark',
      'D. remarked'
    ],
    correctAnswer: 'A',
    explanation: 'Chỗ trống đứng sau sở hữu cách ("company’s") và trước danh từ ("recovery"), cần tính từ "remarkable" để bổ nghĩa cho danh từ.',
    vietnameseTranslation: 'Báo cáo kiểm toán hàng quý nêu bật sự phục hồi đáng kể của công ty sau sự gián đoạn nguồn cung ở nước ngoài.',
    keyVocabulary: [
      { word: 'Remarkable', ipa: '/rɪˈmɑː.kə.bəl/', meaning: 'Đáng chú ý, xuất sắc' },
      { word: 'Recovery', ipa: '/rɪˈkʌv.ər.i/', meaning: 'Sự phục hồi' }
    ]
  },
  {
    id: 'toeic_p5_22',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'easy',
    estimatedDifficulty: 410,
    topic: 'Corporate Professional Training',
    subSkill: 'correlative_conjunction',
    questionType: 'grammar_conjunction',
    vocabularyTags: ['contractors', 'seminar', 'enrollment'],
    grammarTags: ['both_and'],
    questionText: 'The cybersecurity training workshop is mandatory for _______ full-time staff and independent contractors.',
    options: [
      'A. both',
      'B. either',
      'C. neither',
      'D. whether'
    ],
    correctAnswer: 'A',
    explanation: 'Cặp liên từ tương quan chuẩn xác "both ... and ..." (cả ... và ...). Đi kèm với từ "and" ở vế sau.',
    vietnameseTranslation: 'Buổi hội thảo đào tạo an ninh mạng là bắt buộc đối với cả nhân viên toàn thời gian và nhà thầu độc lập.',
    keyVocabulary: [
      { word: 'Mandatory', ipa: '/ˈmæn.də.tər.i/', meaning: 'Bắt buộc' },
      { word: 'Contractors', ipa: '/kənˈtræk.tərz/', meaning: 'Nhà thầu phụ' }
    ]
  },
  {
    id: 'toeic_p5_23',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'easy',
    estimatedDifficulty: 420,
    topic: 'Commuter Transportation',
    subSkill: 'present_simple_schedule',
    questionType: 'grammar_tense',
    vocabularyTags: ['commuter', 'express', 'platform'],
    grammarTags: ['present_simple'],
    questionText: 'The airport express shuttle _______ at Platform 4 every twenty minutes during peak commuting hours.',
    options: [
      'A. arrives',
      'B. arrived',
      'C. arriving',
      'D. will have arrived'
    ],
    correctAnswer: 'A',
    explanation: 'Sự việc diễn ra theo lịch trình cố định ("every twenty minutes"), chủ ngữ số ít "The airport express shuttle" dùng thì hiện tại đơn "arrives".',
    vietnameseTranslation: 'Xe đưa đón nhanh sân bay đến Sân ga số 4 cứ hai mươi phút một lần trong giờ cao điểm đi lại.',
    keyVocabulary: [
      { word: 'Commuting', ipa: '/kəˈmjuː.tɪŋ/', meaning: 'Việc đi lại hàng ngày giữa nhà và nơi làm việc' },
      { word: 'Platform', ipa: '/ˈplæt.fɔːm/', meaning: 'Sân ga, bục đón tàu xe' }
    ]
  },
  {
    id: 'toeic_p5_24',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'easy',
    estimatedDifficulty: 430,
    topic: 'Retail & Customer Service',
    subSkill: 'business_vocabulary',
    questionType: 'vocab_meaning',
    vocabularyTags: ['refund', 'receipt', 'merchandise'],
    grammarTags: ['noun_selection'],
    questionText: 'Customers presenting an original purchase receipt within thirty days are eligible for a complete _______.',
    options: [
      'A. refund',
      'B. penalty',
      'C. donation',
      'D. vacancy'
    ],
    correctAnswer: 'A',
    explanation: 'Danh từ phù hợp với ngữ cảnh trả hàng bán lẻ: "eligible for a complete refund" (được hoàn lại toàn bộ tiền).',
    vietnameseTranslation: 'Khách hàng xuất trình hóa đơn mua hàng gốc trong vòng 30 ngày sẽ đủ điều kiện được hoàn tiền đầy đủ.',
    keyVocabulary: [
      { word: 'Refund', ipa: '/ˈriː.fʌnd/', meaning: 'Khoản tiền hoàn lại' },
      { word: 'Eligible', ipa: '/ˈel.ɪ.dʒə.bəl/', meaning: 'Đủ điều kiện, thích hợp' }
    ]
  },
  {
    id: 'toeic_p5_25',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'easy',
    estimatedDifficulty: 440,
    topic: 'Accounts Payable',
    subSkill: 'noun_derivation',
    questionType: 'grammar_pos',
    vocabularyTags: ['invoices', 'prompt', 'suppliers'],
    grammarTags: ['noun_as_subject'],
    questionText: 'Prompt _______ of vendor invoices helps maintain positive long-term relationships with regional suppliers.',
    options: [
      'A. payment',
      'B. pay',
      'C. payable',
      'D. paid'
    ],
    correctAnswer: 'A',
    explanation: 'Đứng sau tính từ "Prompt" và đứng đầu câu làm chủ ngữ cho động từ "helps", cần danh từ "payment".',
    vietnameseTranslation: 'Việc thanh toán hóa đơn nhà cung cấp nhanh chóng giúp duy trì mối quan hệ lâu dài tốt đẹp với các đối tác khu vực.',
    keyVocabulary: [
      { word: 'Prompt', ipa: '/prɒmpt/', meaning: 'Kịp thời, nhanh chóng' },
      { word: 'Invoices', ipa: '/ˈɪn.vɔɪ.sɪz/', meaning: 'Hóa đơn thanh toán' }
    ]
  },
  {
    id: 'toeic_p5_26',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'easy',
    estimatedDifficulty: 440,
    topic: 'Human Resources & Recruitment',
    subSkill: 'preposition_scope',
    questionType: 'grammar_preposition',
    vocabularyTags: ['intranet', 'vacancies', 'postings'],
    grammarTags: ['preposition_under'],
    questionText: 'Current job openings and internal transfer vacancies are listed _______ the Careers tab on our staff intranet.',
    options: [
      'A. under',
      'B. across',
      'C. through',
      'D. beyond'
    ],
    correctAnswer: 'A',
    explanation: 'Giới từ "under" được sử dụng theo cấu trúc danh mục trang web/tài liệu: "under the Careers tab" (dưới mục Nghề nghiệp).',
    vietnameseTranslation: 'Các vị trí tuyển dụng hiện tại và chuyển công tác nội bộ được liệt kê dưới thẻ Tuyển dụng trên mạng nội bộ.',
    keyVocabulary: [
      { word: 'Vacancies', ipa: '/ˈveɪ.kən.siz/', meaning: 'Vị trí còn trống' },
      { word: 'Intranet', ipa: '/ˈɪn.trə.net/', meaning: 'Mạng nội bộ doanh nghiệp' }
    ]
  },
  {
    id: 'toeic_p5_27',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'easy',
    estimatedDifficulty: 450,
    topic: 'Manufacturing & Energy',
    subSkill: 'comparative_adjective',
    questionType: 'grammar_comparative',
    vocabularyTags: ['generator', 'diesel', 'efficient'],
    grammarTags: ['comparative_degree'],
    questionText: 'The newly commissioned electric turbine operates significantly _______ than older fossil-fuel generators.',
    options: [
      'A. more efficiently',
      'B. efficient',
      'C. efficiency',
      'D. most efficient'
    ],
    correctAnswer: 'A',
    explanation: 'Động từ "operates" cần trạng từ bổ nghĩa kết hợp so sánh hơn với từ "than" ở phía sau -> "more efficiently".',
    vietnameseTranslation: 'Tua-bin điện mới vận hành hiệu quả hơn đáng kể so với các máy phát điện chạy bằng nhiên liệu hóa thạch cũ.',
    keyVocabulary: [
      { word: 'Commissioned', ipa: '/kəˈmɪʃ.ənd/', meaning: 'Được đưa vào vận hành chính thức' },
      { word: 'Turbine', ipa: '/ˈtɜː.baɪn/', meaning: 'Tua-bin máy phát' }
    ]
  },
  {
    id: 'toeic_p5_28',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'medium',
    estimatedDifficulty: 490,
    topic: 'International Marketing',
    subSkill: 'concessive_conjunction',
    questionType: 'grammar_conjunction',
    vocabularyTags: ['exports', 'domestic', 'surged'],
    grammarTags: ['subordinating_conjunction_although'],
    questionText: '_______ domestic retail sales experienced a slight decline, overseas export revenue surged by eighteen percent.',
    options: [
      'A. Although',
      'B. Despite',
      'C. Because',
      'D. Furthermore'
    ],
    correctAnswer: 'A',
    explanation: 'Mệnh đề sau dấu phẩy tương phản với mệnh đề trước. Theo sau là mệnh đề đầy đủ (S + V) nên dùng liên từ "Although" (mặc dù).',
    vietnameseTranslation: 'Mặc dù doanh số bán lẻ trong nước giảm nhẹ, doanh thu xuất khẩu sang nước ngoài vẫn tăng vọt 18%.',
    keyVocabulary: [
      { word: 'Surged', ipa: '/sɜːdʒd/', meaning: 'Tăng vọt mạnh mẽ' },
      { word: 'Overseas', ipa: '/ˌəʊ.vəˈsiːz/', meaning: 'Ở nước ngoài, hải ngoại' }
    ]
  },
  {
    id: 'toeic_p5_29',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'medium',
    estimatedDifficulty: 510,
    topic: 'Engineering & Innovation',
    subSkill: 'relative_pronoun',
    questionType: 'grammar_relative_clause',
    vocabularyTags: ['innovators', 'patents', 'recognized'],
    grammarTags: ['relative_whose'],
    questionText: 'Management officially recognized the biomedical researchers _______ groundbreaking patents enhanced patient recovery rates.',
    options: [
      'A. whose',
      'B. which',
      'C. whom',
      'D. whoever'
    ],
    correctAnswer: 'A',
    explanation: 'Đ đại từ quan hệ sở hữu "whose" đứng giữa danh từ chỉ người ("researchers") và danh từ sở hữu ("patents").',
    vietnameseTranslation: 'Ban giám đốc đã chính thức vinh danh các nhà nghiên cứu y sinh có các bằng sáng chế đột phá giúp nâng cao tỷ lệ hồi phục.',
    keyVocabulary: [
      { word: 'Groundbreaking', ipa: '/ˈɡraʊndˌbreɪ.kɪŋ/', meaning: 'Đột phá, mang tính khai phá' },
      { word: 'Patents', ipa: '/ˈpeɪ.tənts/', meaning: 'Bằng sáng chế' }
    ]
  },
  {
    id: 'toeic_p5_30',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'medium',
    estimatedDifficulty: 530,
    topic: 'Workplace Safety Compliance',
    subSkill: 'collocation_verb_preposition',
    questionType: 'vocab_meaning',
    vocabularyTags: ['protocols', 'hazardous', 'protective'],
    grammarTags: ['adhere_to'],
    questionText: 'All laboratory technicians must strictly _______ to certified protocols when handling volatile chemical compounds.',
    options: [
      'A. adhere',
      'B. comply',
      'C. observe',
      'D. fulfill'
    ],
    correctAnswer: 'A',
    explanation: 'Cụm động từ cố định đi với giới từ "to": "adhere to" (tuân thủ quy định/giao thức). "Comply" đi với "with".',
    vietnameseTranslation: 'Tất cả kỹ thuật viên phòng thí nghiệm phải tuân thủ nghiêm ngặt các quy định đã được chứng nhận khi xử lý hợp chất hóa học dễ bay hơi.',
    keyVocabulary: [
      { word: 'Adhere to', ipa: '/ədˈhɪər tuː/', meaning: 'Tuân thủ chặt chẽ' },
      { word: 'Volatile', ipa: '/ˈvɒl.ə.taɪl/', meaning: 'Dễ bay hơi, không ổn định' }
    ]
  },
  {
    id: 'toeic_p5_31',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'medium',
    estimatedDifficulty: 540,
    topic: 'Event Facility Management',
    subSkill: 'passive_voice',
    questionType: 'grammar_voice',
    vocabularyTags: ['auditorium', 'cleared', 'surcharges'],
    grammarTags: ['passive_modal_must_be'],
    questionText: 'The main exhibition auditorium must be completely _______ by ten o’clock tonight so custodial crews can sanitize the floors.',
    options: [
      'A. vacated',
      'B. vacating',
      'C. vacate',
      'D. vacation'
    ],
    correctAnswer: 'A',
    explanation: 'Cấu trúc bị động với modal verb: "must be + V3/ed". Do đó dùng quá khứ phân từ "vacated" (được rời đi, giải phóng mặt bằng).',
    vietnameseTranslation: 'Khán phòng triển lãm chính phải được rời khỏi hoàn toàn trước 10 giờ tối nay để nhân viên vệ sinh có thể khử khuẩn sàn nhà.',
    keyVocabulary: [
      { word: 'Vacated', ipa: '/vəˈkeɪ.tɪd/', meaning: 'Được dọn trống, giải phóng' },
      { word: 'Custodial', ipa: '/kʌsˈtəʊ.di.əl/', meaning: 'Thuộc về lao công, vệ sinh tòa nhà' }
    ]
  },
  {
    id: 'toeic_p5_32',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'medium',
    estimatedDifficulty: 560,
    topic: 'Construction & Regulations',
    subSkill: 'complex_preposition',
    questionType: 'grammar_preposition',
    vocabularyTags: ['renovations', 'ordinances', 'municipal'],
    grammarTags: ['in_accordance_with'],
    questionText: 'Commercial building alterations must be executed _______ municipal zoning ordinances and fire codes.',
    options: [
      'A. in accordance with',
      'B. on behalf of',
      'C. with regard to',
      'D. as a consequence'
    ],
    correctAnswer: 'A',
    explanation: 'Cụm giới từ "in accordance with" có nghĩa là "phù hợp với / chiếu theo quy định/luật lệ".',
    vietnameseTranslation: 'Việc sửa đổi công trình thương mại phải được thực hiện theo đúng các quy định phân vùng đô thị và quy chuẩn phòng cháy chữa cháy.',
    keyVocabulary: [
      { word: 'In accordance with', ipa: '/ɪn əˈkɔː.dəns wɪð/', meaning: 'Chiếu theo, phù hợp theo' },
      { word: 'Ordinances', ipa: '/ˈɔː.dɪ.nənsɪz/', meaning: 'Quy định pháp lệnh đô thị' }
    ]
  },
  {
    id: 'toeic_p5_33',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'medium',
    estimatedDifficulty: 580,
    topic: 'Executive Leadership',
    subSkill: 'gerund_after_preposition',
    questionType: 'grammar_gerund',
    vocabularyTags: ['praise', 'expediting', 'merger'],
    grammarTags: ['gerund_object_of_preposition'],
    questionText: 'The executive committee commended Ms. Vance for _______ the acquisition contract negotiations with foreign investors.',
    options: [
      'A. expediting',
      'B. expedite',
      'C. expedited',
      'D. expedition'
    ],
    correctAnswer: 'A',
    explanation: 'Sau giới từ "for" đi kèm tân ngữ danh từ phía sau ("the acquisition contract negotiations"), cần dùng danh động từ "expediting".',
    vietnameseTranslation: 'Ủy ban điều hành đã tuyên dương bà Vance vì đã xúc tiến các cuộc đàm phán hợp đồng thâu tóm với các nhà đầu tư nước ngoài.',
    keyVocabulary: [
      { word: 'Commended', ipa: '/kəˈmen.dɪd/', meaning: 'Khen ngợi, biểu dương' },
      { word: 'Expediting', ipa: '/ˈek.spə.daɪ.tɪŋ/', meaning: 'Xúc tiến đẩy nhanh tiến độ' }
    ]
  },
  {
    id: 'toeic_p5_34',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'medium',
    estimatedDifficulty: 600,
    topic: 'Corporate Governance',
    subSkill: 'adverb_manner',
    questionType: 'grammar_pos',
    vocabularyTags: ['directors', 'inquiries', 'resolution'],
    grammarTags: ['adverb_modifying_verb'],
    questionText: 'The board of directors responded _______ to shareholder inquiries regarding the proposed restructuring plan.',
    options: [
      'A. promptly',
      'B. prompt',
      'C. promptness',
      'D. prompter'
    ],
    correctAnswer: 'A',
    explanation: 'Động từ "responded" cần trạng từ chỉ thể cách "promptly" (kịp thời, ngay lập tức) để bổ nghĩa.',
    vietnameseTranslation: 'Hội đồng quản trị đã phản hồi nhanh chóng trước những chất vấn của cổ đông liên quan đến kế hoạch tái cấu trúc được đề xuất.',
    keyVocabulary: [
      { word: 'Promptly', ipa: '/ˈprɒmpt.li/', meaning: 'Nhanh chóng, không chậm trễ' },
      { word: 'Restructuring', ipa: '/ˌriːˈstrʌk.tʃər.ɪŋ/', meaning: 'Sự tái cấu trúc doanh nghiệp' }
    ]
  },
  {
    id: 'toeic_p5_35',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'medium',
    estimatedDifficulty: 610,
    topic: 'Branch Operations',
    subSkill: 'subject_verb_agreement',
    questionType: 'grammar_agreement',
    vocabularyTags: ['subsidiary', 'performance', 'metrics'],
    grammarTags: ['indefinite_pronoun_singular'],
    questionText: 'Each of the regional branch offices _______ quarterly financial performance metrics directly to corporate headquarters.',
    options: [
      'A. submits',
      'B. submit',
      'C. submitting',
      'D. have submitted'
    ],
    correctAnswer: 'A',
    explanation: 'Chủ ngữ bắt đầu bằng "Each of + danh từ số nhiều" là chủ ngữ số ít, do đó động từ chia thì hiện tại đơn ở ngôi thứ ba số ít "submits".',
    vietnameseTranslation: 'Mỗi chi nhánh khu vực đều gửi số liệu kết quả tài chính hàng quý trực tiếp về trụ sở chính của tập đoàn.',
    keyVocabulary: [
      { word: 'Submits', ipa: '/səbˈmɪts/', meaning: 'Trình nộp, gửi lên' },
      { word: 'Metrics', ipa: '/ˈmet.rɪks/', meaning: 'Các chỉ số đo lường' }
    ]
  },
  {
    id: 'toeic_p5_36',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'medium',
    estimatedDifficulty: 620,
    topic: 'Budgeting & Financial Forecasts',
    subSkill: 'business_idiom_collocation',
    questionType: 'vocab_meaning',
    vocabularyTags: ['fluctuations', 'expenditure', 'consideration'],
    grammarTags: ['take_into_consideration'],
    questionText: 'Department heads must take potential exchange rate fluctuations into _______ when drafting annual expenditure forecasts.',
    options: [
      'A. consideration',
      'B. calculation',
      'C. compensation',
      'D. celebration'
    ],
    correctAnswer: 'A',
    explanation: 'Thành ngữ thương mại cố định: "take something into consideration" (tính đến, xem xét cân nhắc một yếu tố nào đó).',
    vietnameseTranslation: 'Các trưởng bộ phận phải tính đến biến động tỷ giá hối đoái tiềm ẩn khi soạn thảo dự báo chi tiêu hàng năm.',
    keyVocabulary: [
      { word: 'Consideration', ipa: '/kənˌsɪd.əˈreɪ.ʃən/', meaning: 'Sự cân nhắc kỹ lưỡng' },
      { word: 'Fluctuations', ipa: '/ˌflʌk.tʃuˈeɪ.ʃənz/', meaning: 'Sự biến động thất thường' }
    ]
  },
  {
    id: 'toeic_p5_37',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'hard',
    estimatedDifficulty: 670,
    topic: 'Internal Auditing',
    subSkill: 'mandative_subjunctive',
    questionType: 'grammar_subjunctive',
    vocabularyTags: ['forensic', 'recommended', 'auditor'],
    grammarTags: ['mandative_subjunctive'],
    questionText: 'The governance committee recommended that the chief auditor _______ an independent forensic investigation into the matter.',
    options: [
      'A. commission',
      'B. commissions',
      'C. commissioned',
      'D. will commission'
    ],
    correctAnswer: 'A',
    explanation: 'Cấu trúc giả định thức đòi hỏi động từ nguyên thể không "to": "recommend that + S + (should) + V-bare". Do đó chọn "commission".',
    vietnameseTranslation: 'Ủy ban quản trị đề nghị kiểm toán viên trưởng tiến hành một cuộc điều tra độc lập về vấn đề này.',
    keyVocabulary: [
      { word: 'Commission', ipa: '/kəˈmɪʃ.ən/', meaning: 'Ủy thác thực hiện, chỉ định điều tra' },
      { word: 'Forensic', ipa: '/fəˈren.zɪk/', meaning: 'Thuộc pháp y, điều tra pháp lý' }
    ]
  },
  {
    id: 'toeic_p5_38',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'hard',
    estimatedDifficulty: 700,
    topic: 'Warehouse Dispatch',
    subSkill: 'reduced_relative_clause',
    questionType: 'grammar_participle',
    vocabularyTags: ['cutoff', 'freight', 'dispatched'],
    grammarTags: ['passive_participle'],
    questionText: 'Any freight consignments _______ after the four o’clock cutoff window will be processed during the subsequent business shift.',
    options: [
      'A. received',
      'B. receiving',
      'C. receive',
      'D. are received'
    ],
    correctAnswer: 'A',
    explanation: 'Mệnh đề quan hệ rút gọn ở thể bị động: "consignments (which are) received after...". Do đó dùng quá khứ phân từ "received".',
    vietnameseTranslation: 'Bất kỳ lô hàng vận chuyển nào được nhận sau thời hạn 4 giờ chiều sẽ được xử lý trong ca làm việc tiếp theo.',
    keyVocabulary: [
      { word: 'Consignments', ipa: '/kənˈsaɪn.mənts/', meaning: 'Lô hàng ký gửi vận chuyển' },
      { word: 'Subsequent', ipa: '/ˈsʌb.sɪ.kwənt/', meaning: 'Xảy ra sau đó, tiếp theo' }
    ]
  },
  {
    id: 'toeic_p5_39',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'hard',
    estimatedDifficulty: 730,
    topic: 'Product Quality Assurance',
    subSkill: 'inverted_conditional',
    questionType: 'grammar_conditional',
    vocabularyTags: ['averted', 'remediation', 'flaw'],
    grammarTags: ['inverted_condition_type3'],
    questionText: '_______ quality control detected the microchip defect earlier, the costly worldwide recall could have been completely averted.',
    options: [
      'A. Had',
      'B. Were',
      'C. Should',
      'D. If have'
    ],
    correctAnswer: 'A',
    explanation: 'Đảo ngữ câu điều kiện loại 3: "Had + S + V3/ed, S + could have + V3/ed". Thay thế cho "If quality control had detected...".',
    vietnameseTranslation: 'Nếu bộ phận kiểm soát chất lượng phát hiện ra lỗi vi chip sớm hơn, đợt thu hồi tốn kém trên toàn thế giới đã có thể tránh được hoàn toàn.',
    keyVocabulary: [
      { word: 'Averted', ipa: '/əˈvɜː.tɪd/', meaning: 'Ngăn chặn, phòng tránh được' },
      { word: 'Defect', ipa: '/ˈdiː.fekt/', meaning: 'Sai sót, khiếm khuyết kỹ thuật' }
    ]
  },
  {
    id: 'toeic_p5_40',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'hard',
    estimatedDifficulty: 760,
    topic: 'Supply Chain Disruptions',
    subSkill: 'advanced_vocabulary',
    questionType: 'vocab_meaning',
    vocabularyTags: ['precluded', 'embargo', 'disruptions'],
    grammarTags: ['transitive_verb'],
    questionText: 'Severe geopolitical tensions and maritime freight tariffs unfortunately _______ the timely distribution of crucial surgical supplies.',
    options: [
      'A. precluded',
      'B. consented',
      'C. coincided',
      'D. accommodated'
    ],
    correctAnswer: 'A',
    explanation: 'Động từ "preclude" mang nghĩa trang trọng: ngăn cản, khiến điều gì không thể xảy ra ("precluded the timely distribution").',
    vietnameseTranslation: 'Căng thẳng địa chính trị nghiêm trọng và thuế quan vận tải biển đáng tiếc đã ngăn cản việc phân phối kịp thời vật tư phẫu thuật thiết yếu.',
    keyVocabulary: [
      { word: 'Precluded', ipa: '/prɪˈkluː.dɪd/', meaning: 'Ngăn cản, loại trừ khả năng' },
      { word: 'Crucial', ipa: '/ˈkruː.ʃəl/', meaning: 'Tối quan trọng, then chốt' }
    ]
  },
  {
    id: 'toeic_p5_41',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'hard',
    estimatedDifficulty: 790,
    topic: 'Sales Target Performance',
    subSkill: 'negative_inversion',
    questionType: 'grammar_inversion',
    vocabularyTags: ['surpassed', 'expenditures', 'benchmark'],
    grammarTags: ['not_only_inversion'],
    questionText: 'Not only _______ the fourth-quarter revenue benchmark, but the enterprise also trimmed administrative overhead by ten percent.',
    options: [
      'A. did the marketing division surpass',
      'B. the marketing division surpassed',
      'C. surpassed the marketing division',
      'D. has the marketing division surpass'
    ],
    correctAnswer: 'A',
    explanation: 'Cấu trúc đảo ngữ với cụm phủ định đầu câu "Not only...": Trợ động từ "did" đảo lên trước chủ ngữ ("did the marketing division surpass").',
    vietnameseTranslation: 'Bộ phận tiếp thị không những vượt qua chỉ tiêu doanh thu quý 4 mà doanh nghiệp còn cắt giảm 10% chi phí hành chính.',
    keyVocabulary: [
      { word: 'Surpass', ipa: '/səˈpɑːs/', meaning: 'Vượt qua, trội hơn' },
      { word: 'Overhead', ipa: '/ˈəʊ.və.hed/', meaning: 'Chi phí hoạt động gián tiếp' }
    ]
  },
  {
    id: 'toeic_p5_42',
    part: 'part5_grammar',
    skill: 'reading',
    difficulty: 'hard',
    estimatedDifficulty: 820,
    topic: 'Corporate Resilience',
    subSkill: 'formal_concessive_preposition',
    questionType: 'grammar_preposition',
    vocabularyTags: ['notwithstanding', 'headwinds', 'profitability'],
    grammarTags: ['preposition_notwithstanding'],
    questionText: '_______ persistent semiconductor shortages and escalating logistics overhead, the automaker achieved record annual net earnings.',
    options: [
      'A. Notwithstanding',
      'B. Furthermore',
      'C. Whereas',
      'D. Provided that'
    ],
    correctAnswer: 'A',
    explanation: 'Giới từ trang trọng "Notwithstanding" (= Despite / In spite of) đi kèm cụm danh từ phía sau chỉ sự nhượng bộ / tương phản.',
    vietnameseTranslation: 'Bất chấp tình trạng thiếu hụt chất bán dẫn kéo dài và chi phí hậu cần leo thang, hãng sản xuất ô tô vẫn đạt lợi nhuận ròng kỷ lục hàng năm.',
    keyVocabulary: [
      { word: 'Notwithstanding', ipa: '/ˌnɒt.wɪðˈstæn.dɪŋ/', meaning: 'Bất chấp, mặc dù' },
      { word: 'Semiconductor', ipa: '/ˌsem.i.kənˈdʌk.tər/', meaning: 'Chất bán dẫn' }
    ]
  },

  // ===========================================================================
  // PART 6: TEXT COMPLETION (READING - 9 QUESTIONS ACROSS 3 COMPLETE GROUPS)
  // ===========================================================================
  // --- GROUP P6_1 (3 questions) ---
  {
    id: 'toeic_p6_1',
    part: 'part6_text',
    skill: 'reading',
    difficulty: 'medium',
    topic: 'Logistics Infrastructure',
    subSkill: 'verb_tense_aspect',
    questionType: 'grammar_tense',
    groupId: 'toeic_grp_p6_1',
    passageId: 'toeic_grp_p6_1',
    vocabularyTags: ['implementing', 'infrastructure', 'cloud'],
    grammarTags: ['present_continuous'],
    estimatedDifficulty: 500,
    passage: `INTERNAL MEMORANDUM
To: Regional Operations Staff
From: Corporate Logistics Management
Date: September 15

In order to optimize our nationwide parcel delivery network, we are currently [ ___1___ ] a brand-new cloud tracking infrastructure. This enhancement will provide real-time updates to our enterprise clients. [ ___2___ ], local hub managers are instructed to complete the training module by the end of next week. Any technical inquiries regarding portal navigation should be directed to the IT helpdesk [ ___3___ ].`,
    questionText: 'Part 6: Chọn từ thích hợp nhất để điền vào chỗ trống số [ ___1___ ].',
    options: [
      'A. implementing',
      'B. implement',
      'C. implementation',
      'D. implemented'
    ],
    correctAnswer: 'A',
    explanation: 'Đứng sau "are currently", cần một hiện tại phân từ V-ing để tạo thành thì Hiện tại Tiếp diễn "are implementing".',
    vietnameseTranslation: 'BẢN GHI NHỚ NỘI BỘ: Để tối ưu hóa mạng lưới... hiện tại chúng tôi đang triển khai (implementing) hạ tầng...',
    keyVocabulary: [
      { word: 'Implementing', ipa: '/ˈɪm.plɪ.men.tɪŋ/', meaning: 'Đang triển khai' }
    ]
  },
  {
    id: 'toeic_p6_2',
    part: 'part6_text',
    skill: 'reading',
    difficulty: 'medium',
    topic: 'Logistics Infrastructure',
    subSkill: 'transition_word',
    questionType: 'grammar_conjunction',
    groupId: 'toeic_grp_p6_1',
    passageId: 'toeic_grp_p6_1',
    vocabularyTags: ['therefore', 'instructed', 'management'],
    grammarTags: ['adverbial_transition'],
    estimatedDifficulty: 550,
    passage: `INTERNAL MEMORANDUM
To: Regional Operations Staff
From: Corporate Logistics Management
Date: September 15

In order to optimize our nationwide parcel delivery network, we are currently [ ___1___ ] a brand-new cloud tracking infrastructure. This enhancement will provide real-time updates to our enterprise clients. [ ___2___ ], local hub managers are instructed to complete the training module by the end of next week. Any technical inquiries regarding portal navigation should be directed to the IT helpdesk [ ___3___ ].`,
    questionText: 'Part 6: Chọn liên từ chuyển ý thích hợp nhất cho chỗ trống [ ___2___ ].',
    options: [
      'A. On the contrary',
      'B. Therefore',
      'C. Otherwise',
      'D. In spite of'
    ],
    correctAnswer: 'B',
    explanation: 'Thể hiện mối quan hệ nguyên nhân - kết quả giữa việc hệ thống mới nâng cấp và yêu cầu đào tạo. Chọn "Therefore" (Do đó/Vì vậy).',
    vietnameseTranslation: 'Cải tiến này sẽ cung cấp cập nhật thời gian thực... Do đó (Therefore), các trưởng chi nhánh được chỉ đạo...',
    keyVocabulary: [
      { word: 'Therefore', ipa: '/ˈðeə.fɔːr/', meaning: 'Do đó' }
    ]
  },
  {
    id: 'toeic_p6_3',
    part: 'part6_text',
    skill: 'reading',
    difficulty: 'medium',
    topic: 'Logistics Infrastructure',
    subSkill: 'adverb_manner',
    questionType: 'vocab_meaning',
    groupId: 'toeic_grp_p6_1',
    passageId: 'toeic_grp_p6_1',
    vocabularyTags: ['promptly', 'helpdesk', 'inquiries'],
    grammarTags: ['manner_adverb'],
    estimatedDifficulty: 570,
    passage: `INTERNAL MEMORANDUM
To: Regional Operations Staff
From: Corporate Logistics Management
Date: September 15

In order to optimize our nationwide parcel delivery network, we are currently [ ___1___ ] a brand-new cloud tracking infrastructure. This enhancement will provide real-time updates to our enterprise clients. [ ___2___ ], local hub managers are instructed to complete the training module by the end of next week. Any technical inquiries regarding portal navigation should be directed to the IT helpdesk [ ___3___ ].`,
    questionText: 'Part 6: Chọn từ thích hợp nhất để điền vào chỗ trống số [ ___3___ ].',
    options: [
      'A. promptly',
      'B. reluctantly',
      'C. previously',
      'D. vaguely'
    ],
    correctAnswer: 'A',
    explanation: 'Đứng cuối câu bổ nghĩa cho việc liên hệ bộ phận hỗ trợ kỹ thuật, "promptly" (kịp thời, ngay lập tức) là lựa chọn tự nhiên và chính xác nhất.',
    vietnameseTranslation: 'Mọi thắc mắc kỹ thuật... nên được gửi tới bộ phận IT kịp thời (promptly).',
    keyVocabulary: [
      { word: 'Promptly', ipa: '/ˈprɒmpt.li/', meaning: 'Ngay tức thì, không chậm trễ' }
    ]
  },

  // --- GROUP P6_2 (3 questions) ---
  {
    id: 'toeic_p6_4',
    part: 'part6_text',
    skill: 'reading',
    difficulty: 'easy',
    topic: 'Facilities & Workplace',
    subSkill: 'adverb_modification',
    questionType: 'grammar_pos',
    groupId: 'toeic_grp_p6_2',
    passageId: 'toeic_grp_p6_2',
    vocabularyTags: ['temporarily', 'restricted', 'renovation'],
    grammarTags: ['adverb_before_participle'],
    estimatedDifficulty: 420,
    passage: `FACILITY UPDATE NOTICE
To: All Headquarters Employees
From: Building Administration
Date: March 10

Please be advised that scheduled carpeting and lighting upgrades on the fourth floor will commence this Saturday. During the work period, access to conference rooms 4A and 4B will be [ ___1___ ] restricted. [ ___2___ ], staff members scheduled to host client briefings are encouraged to book alternative spaces in the East Wing. We sincerely appreciate your patience and [ ___3___ ] during these necessary workplace improvements.`,
    questionText: 'Part 6: Chọn từ thích hợp nhất cho chỗ trống [ ___1___ ].',
    options: [
      'A. temporary',
      'B. temporarily',
      'C. temporize',
      'D. temporariness'
    ],
    correctAnswer: 'B',
    explanation: 'Đứng trước phân từ tính từ "restricted", cần trạng từ "temporarily" (tạm thời bị hạn chế).',
    vietnameseTranslation: '...lối vào các phòng họp 4A và 4B sẽ tạm thời bị hạn chế (temporarily restricted)...',
    keyVocabulary: [
      { word: 'Temporarily', ipa: '/ˈtem.pər.ər.əl.i/', meaning: 'Tạm thời' }
    ]
  },
  {
    id: 'toeic_p6_5',
    part: 'part6_text',
    skill: 'reading',
    difficulty: 'easy',
    topic: 'Facilities & Workplace',
    subSkill: 'sentence_connector',
    questionType: 'grammar_conjunction',
    groupId: 'toeic_grp_p6_2',
    passageId: 'toeic_grp_p6_2',
    vocabularyTags: ['consequently', 'alternative'],
    grammarTags: ['transitional_adverb'],
    estimatedDifficulty: 450,
    passage: `FACILITY UPDATE NOTICE
To: All Headquarters Employees
From: Building Administration
Date: March 10

Please be advised that scheduled carpeting and lighting upgrades on the fourth floor will commence this Saturday. During the work period, access to conference rooms 4A and 4B will be [ ___1___ ] restricted. [ ___2___ ], staff members scheduled to host client briefings are encouraged to book alternative spaces in the East Wing. We sincerely appreciate your patience and [ ___3___ ] during these necessary workplace improvements.`,
    questionText: 'Part 6: Chọn liên từ hoặc trạng từ chuyển tiếp cho chỗ trống [ ___2___ ].',
    options: [
      'A. Consequently',
      'B. Meanwhile',
      'C. Although',
      'D. Except'
    ],
    correctAnswer: 'A',
    explanation: '"Consequently" (Hệ quả là / Do đó) thể hiện quan hệ kết quả khi phòng họp tầng 4 bị chặn nên nhân viên phải đặt phòng ở cánh Đông.',
    vietnameseTranslation: 'Hệ quả là (Consequently), nhân viên có lịch đón khách được khuyến khích đặt phòng ở Cánh Đông.',
    keyVocabulary: [
      { word: 'Consequently', ipa: '/ˈkɒn.sɪ.kwənt.li/', meaning: 'Do đó, hệ quả là' }
    ]
  },
  {
    id: 'toeic_p6_6',
    part: 'part6_text',
    skill: 'reading',
    difficulty: 'easy',
    topic: 'Facilities & Workplace',
    subSkill: 'parallel_nouns',
    questionType: 'vocab_meaning',
    groupId: 'toeic_grp_p6_2',
    passageId: 'toeic_grp_p6_2',
    vocabularyTags: ['cooperation', 'patience', 'appreciation'],
    grammarTags: ['parallel_structure'],
    estimatedDifficulty: 440,
    passage: `FACILITY UPDATE NOTICE
To: All Headquarters Employees
From: Building Administration
Date: March 10

Please be advised that scheduled carpeting and lighting upgrades on the fourth floor will commence this Saturday. During the work period, access to conference rooms 4A and 4B will be [ ___1___ ] restricted. [ ___2___ ], staff members scheduled to host client briefings are encouraged to book alternative spaces in the East Wing. We sincerely appreciate your patience and [ ___3___ ] during these necessary workplace improvements.`,
    questionText: 'Part 6: Chọn từ thích hợp cho chỗ trống [ ___3___ ].',
    options: [
      'A. cooperation',
      'B. defiance',
      'C. suspension',
      'D. collision'
    ],
    correctAnswer: 'A',
    explanation: 'Cấu trúc song hành với "patience and [ ___ ]" trong thông báo công sở: "patience and cooperation" (sự kiên nhẫn và hợp tác).',
    vietnameseTranslation: 'Chúng tôi chân thành cảm ơn sự kiên nhẫn và hợp tác (cooperation) của quý vị...',
    keyVocabulary: [
      { word: 'Cooperation', ipa: '/kəʊˌɒp.ərˈeɪ.ʃən/', meaning: 'Sự hợp tác' }
    ]
  },

  // --- GROUP P6_3 (3 questions) ---
  {
    id: 'toeic_p6_7',
    part: 'part6_text',
    skill: 'reading',
    difficulty: 'hard',
    topic: 'Human Resources Policy',
    subSkill: 'passive_modal_verb',
    questionType: 'grammar_voice',
    groupId: 'toeic_grp_p6_3',
    passageId: 'toeic_grp_p6_3',
    vocabularyTags: ['transferred', 'rollover', 'unused'],
    grammarTags: ['modal_passive'],
    estimatedDifficulty: 700,
    passage: `POLICY BULLETIN: ANNUAL LEAVE ROLLOVER
To: All Department Heads and Permanent Staff
From: Global HR Benefits Committee
Date: November 20

As we approach the fiscal year-end, employees are reminded to review their remaining paid time off (PTO) balances. Under revised corporate regulations, up to five unused days may be [ ___1___ ] into the upcoming calendar year. [ ___2___ ], requests exceeding this ceiling will require written authorization from department vice presidents. Staff must submit their final leave schedules [ ___3___ ] ensure seamless operational coverage throughout December.`,
    questionText: 'Part 6: Chọn dạng động từ thích hợp cho chỗ trống [ ___1___ ].',
    options: [
      'A. transfer',
      'B. transferred',
      'C. transferring',
      'D. transference'
    ],
    correctAnswer: 'B',
    explanation: 'Sau "may be", cần phân từ hai V-ed tạo thể bị động: "may be transferred" (có thể được chuyển sang năm tiếp theo).',
    vietnameseTranslation: '...tối đa 5 ngày nghỉ chưa dùng có thể được chuyển sang (transferred) năm tiếp theo.',
    keyVocabulary: [
      { word: 'Rollover', ipa: '/ˈrəʊlˌəʊ.vər/', meaning: 'Sự chuyển tiếp, dời sang kỳ sau' }
    ]
  },
  {
    id: 'toeic_p6_8',
    part: 'part6_text',
    skill: 'reading',
    difficulty: 'hard',
    topic: 'Human Resources Policy',
    subSkill: 'discourse_connectors',
    questionType: 'grammar_conjunction',
    groupId: 'toeic_grp_p6_3',
    passageId: 'toeic_grp_p6_3',
    vocabularyTags: ['furthermore', 'authorization', 'regulations'],
    grammarTags: ['additive_transition'],
    estimatedDifficulty: 710,
    passage: `POLICY BULLETIN: ANNUAL LEAVE ROLLOVER
To: All Department Heads and Permanent Staff
From: Global HR Benefits Committee
Date: November 20

As we approach the fiscal year-end, employees are reminded to review their remaining paid time off (PTO) balances. Under revised corporate regulations, up to five unused days may be [ ___1___ ] into the upcoming calendar year. [ ___2___ ], requests exceeding this ceiling will require written authorization from department vice presidents. Staff must submit their final leave schedules [ ___3___ ] ensure seamless operational coverage throughout December.`,
    questionText: 'Part 6: Chọn liên từ nối phù hợp nhất cho chỗ trống [ ___2___ ].',
    options: [
      'A. Furthermore',
      'B. On the other hand',
      'C. In contrast',
      'D. Regardless'
    ],
    correctAnswer: 'A',
    explanation: '"Furthermore" (Hơn thế nữa / Thêm vào đó) dùng để bổ sung quy định chi tiết tiếp theo cho trường hợp vượt mức hạn định 5 ngày.',
    vietnameseTranslation: 'Hơn nữa (Furthermore), các yêu cầu vượt quá mức trần này sẽ cần văn bản phê duyệt...',
    keyVocabulary: [
      { word: 'Furthermore', ipa: '/ˌfɜː.ðəˈmɔːr/', meaning: 'Hơn nữa, thêm vào đó' }
    ]
  },
  {
    id: 'toeic_p6_9',
    part: 'part6_text',
    skill: 'reading',
    difficulty: 'hard',
    topic: 'Human Resources Policy',
    subSkill: 'purpose_clause',
    questionType: 'grammar_preposition',
    groupId: 'toeic_grp_p6_3',
    passageId: 'toeic_grp_p6_3',
    vocabularyTags: ['in_order_to', 'coverage', 'operational'],
    grammarTags: ['purpose_infinitive'],
    estimatedDifficulty: 720,
    passage: `POLICY BULLETIN: ANNUAL LEAVE ROLLOVER
To: All Department Heads and Permanent Staff
From: Global HR Benefits Committee
Date: November 20

As we approach the fiscal year-end, employees are reminded to review their remaining paid time off (PTO) balances. Under revised corporate regulations, up to five unused days may be [ ___1___ ] into the upcoming calendar year. [ ___2___ ], requests exceeding this ceiling will require written authorization from department vice presidents. Staff must submit their final leave schedules [ ___3___ ] ensure seamless operational coverage throughout December.`,
    questionText: 'Part 6: Chọn cụm từ thích hợp cho chỗ trống [ ___3___ ].',
    options: [
      'A. in order to',
      'B. so that',
      'C. because of',
      'D. as well as'
    ],
    correctAnswer: 'A',
    explanation: 'Theo sau chỗ trống là động từ nguyên mẫu "ensure", do đó cụm từ chỉ mục đích thích hợp là "in order to + V". "So that" phải đi với mệnh đề S + V.',
    vietnameseTranslation: 'Nhân viên phải nộp lịch nghỉ phép để (in order to) đảm bảo việc duy trì vận hành trơn tru suốt tháng 12.',
    keyVocabulary: [
      { word: 'In order to', ipa: '/ɪn ˈɔː.dər tuː/', meaning: 'Để mà, nhằm mục đích' }
    ]
  },

  // --- GROUP P6_4 (3 questions - Customer Survey Feedback) ---
  {
    id: 'toeic_p6_10',
    part: 'part6_text',
    skill: 'reading',
    difficulty: 'easy',
    estimatedDifficulty: 450,
    topic: 'Customer Relations & Retail Feedback',
    subSkill: 'noun_phrase',
    questionType: 'grammar_pos',
    groupId: 'toeic_grp_p6_4',
    passageId: 'toeic_grp_p6_4',
    vocabularyTags: ['satisfaction', 'survey', 'feedback'],
    grammarTags: ['noun_modifier'],
    passage: `Dear Valued Customer,
Thank you for recently dining at Bistro Royale. We strive to offer memorable culinary experiences to all our guests. We would be immensely grateful if you could take three minutes to complete our online customer satisfaction [ ___1___ ]. Your honest comments will help us [ ___2___ ] our seasonal lunch and dinner selections. As a token of our heartfelt appreciation, you will receive a coupon code for fifteen percent off your next visit upon [ ___3___ ] the questionnaire.`,
    questionText: 'Part 6: Chọn danh từ thích hợp nhất để hoàn thành chỗ trống [ ___1___ ].',
    options: [
      'A. survey',
      'B. surveying',
      'C. surveyed',
      'D. surveyor'
    ],
    correctAnswer: 'A',
    explanation: 'Cụm danh từ "customer satisfaction survey" (khảo sát mức độ hài lòng khách hàng) cần danh từ chính "survey".',
    vietnameseTranslation: 'Kính gửi Quý khách hàng... hoàn thành bản khảo sát (survey) mức độ hài lòng trực tuyến.',
    keyVocabulary: [
      { word: 'Survey', ipa: '/ˈsɜː.veɪ/', meaning: 'Bản khảo sát' }
    ]
  },
  {
    id: 'toeic_p6_11',
    part: 'part6_text',
    skill: 'reading',
    difficulty: 'easy',
    estimatedDifficulty: 460,
    topic: 'Customer Relations & Retail Feedback',
    subSkill: 'verb_bare_infinitive',
    questionType: 'grammar_pos',
    groupId: 'toeic_grp_p6_4',
    passageId: 'toeic_grp_p6_4',
    vocabularyTags: ['improve', 'seasonal', 'selections'],
    grammarTags: ['causative_help_verb'],
    passage: `Dear Valued Customer,
Thank you for recently dining at Bistro Royale. We strive to offer memorable culinary experiences to all our guests. We would be immensely grateful if you could take three minutes to complete our online customer satisfaction [ ___1___ ]. Your honest comments will help us [ ___2___ ] our seasonal lunch and dinner selections. As a token of our heartfelt appreciation, you will receive a coupon code for fifteen percent off your next visit upon [ ___3___ ] the questionnaire.`,
    questionText: 'Part 6: Chọn dạng động từ thích hợp cho chỗ trống [ ___2___ ].',
    options: [
      'A. improve',
      'B. improves',
      'C. improvement',
      'D. improvable'
    ],
    correctAnswer: 'A',
    explanation: 'Cấu trúc "help + (O) + V(bare) / to V". Sau "help us", chọn động từ nguyên mẫu "improve".',
    vietnameseTranslation: 'Ý kiến chân thành của quý khách sẽ giúp chúng tôi cải thiện (improve) thực đơn theo mùa.',
    keyVocabulary: [
      { word: 'Improve', ipa: '/ɪmˈpruːv/', meaning: 'Cải thiện, nâng cao' }
    ]
  },
  {
    id: 'toeic_p6_12',
    part: 'part6_text',
    skill: 'reading',
    difficulty: 'easy',
    estimatedDifficulty: 470,
    topic: 'Customer Relations & Retail Feedback',
    subSkill: 'gerund_after_preposition',
    questionType: 'grammar_pos',
    groupId: 'toeic_grp_p6_4',
    passageId: 'toeic_grp_p6_4',
    vocabularyTags: ['completing', 'questionnaire', 'appreciation'],
    grammarTags: ['preposition_gerund'],
    passage: `Dear Valued Customer,
Thank you for recently dining at Bistro Royale. We strive to offer memorable culinary experiences to all our guests. We would be immensely grateful if you could take three minutes to complete our online customer satisfaction [ ___1___ ]. Your honest comments will help us [ ___2___ ] our seasonal lunch and dinner selections. As a token of our heartfelt appreciation, you will receive a coupon code for fifteen percent off your next visit upon [ ___3___ ] the questionnaire.`,
    questionText: 'Part 6: Chọn dạng từ thích hợp nhất cho chỗ trống [ ___3___ ].',
    options: [
      'A. complete',
      'B. completed',
      'C. completing',
      'D. completely'
    ],
    correctAnswer: 'C',
    explanation: 'Sau giới từ "upon", cần một danh động từ V-ing đóng vai trò tân ngữ: "upon completing the questionnaire".',
    vietnameseTranslation: 'Quý khách sẽ nhận được mã giảm giá 15% sau khi hoàn thành (completing) bảng câu hỏi.',
    keyVocabulary: [
      { word: 'Questionnaire', ipa: '/ˌkwes.tʃəˈneər/', meaning: 'Bảng câu hỏi khảo sát' }
    ]
  },

  // --- GROUP P6_5 (3 questions - Travel Expense Policy) ---
  {
    id: 'toeic_p6_13',
    part: 'part6_text',
    skill: 'reading',
    difficulty: 'medium',
    estimatedDifficulty: 560,
    topic: 'Corporate Finance & Travel Policy',
    subSkill: 'adjective_modifier',
    questionType: 'grammar_pos',
    groupId: 'toeic_grp_p6_5',
    passageId: 'toeic_grp_p6_5',
    vocabularyTags: ['economical', 'airfares', 'reimbursement'],
    grammarTags: ['adjective_modification'],
    passage: `MEMORANDUM
To: All Corporate Sales Representatives
From: Central Accounting Department
Date: May 8
Subject: Revised Travel Expense Guidelines

Please take note of upcoming revisions to our corporate travel reimbursement procedures effective June 1. Under the updated framework, all domestic flight reservations must be booked at least fourteen business days in advance to secure [ ___1___ ] airfares. Furthermore, expense claims lacking itemized digital receipts will no longer be [ ___2___ ] for processing. [ ___3___ ], employees traveling overseas are permitted a twenty percent increase in daily meal allowances to account for currency fluctuations.`,
    questionText: 'Part 6: Chọn tính từ thích hợp nhất cho chỗ trống [ ___1___ ].',
    options: [
      'A. economy',
      'B. economical',
      'C. economize',
      'D. economically'
    ],
    correctAnswer: 'B',
    explanation: 'Chỗ trống đứng trước danh từ "airfares", cần một tính từ "economical" (tiết kiệm, giá rẻ) để bổ nghĩa.',
    vietnameseTranslation: 'Đặt vé trước ít nhất 14 ngày để có được giá vé máy bay tiết kiệm (economical).',
    keyVocabulary: [
      { word: 'Economical', ipa: '/ˌiː.kəˈnɒm.ɪ.kəl/', meaning: 'Tiết kiệm chi phí' }
    ]
  },
  {
    id: 'toeic_p6_14',
    part: 'part6_text',
    skill: 'reading',
    difficulty: 'medium',
    estimatedDifficulty: 570,
    topic: 'Corporate Finance & Travel Policy',
    subSkill: 'passive_voice_participle',
    questionType: 'grammar_tense',
    groupId: 'toeic_grp_p6_5',
    passageId: 'toeic_grp_p6_5',
    vocabularyTags: ['accepted', 'receipts', 'processing'],
    grammarTags: ['passive_voice'],
    passage: `MEMORANDUM
To: All Corporate Sales Representatives
From: Central Accounting Department
Date: May 8
Subject: Revised Travel Expense Guidelines

Please take note of upcoming revisions to our corporate travel reimbursement procedures effective June 1. Under the updated framework, all domestic flight reservations must be booked at least fourteen business days in advance to secure [ ___1___ ] airfares. Furthermore, expense claims lacking itemized digital receipts will no longer be [ ___2___ ] for processing. [ ___3___ ], employees traveling overseas are permitted a twenty percent increase in daily meal allowances to account for currency fluctuations.`,
    questionText: 'Part 6: Chọn dạng từ thích hợp nhất cho chỗ trống [ ___2___ ].',
    options: [
      'A. accepted',
      'B. accepting',
      'C. acceptance',
      'D. acceptably'
    ],
    correctAnswer: 'A',
    explanation: 'Cấu trúc bị động "will no longer be + V3/ed": "be accepted for processing" (được chấp thuận xử lý).',
    vietnameseTranslation: 'Yêu cầu thanh toán thiếu hóa đơn điện tử sẽ không còn được chấp nhận (accepted) để xử lý.',
    keyVocabulary: [
      { word: 'Receipts', ipa: '/rɪˈsiːts/', meaning: 'Hóa đơn, biên lai' }
    ]
  },
  {
    id: 'toeic_p6_15',
    part: 'part6_text',
    skill: 'reading',
    difficulty: 'medium',
    estimatedDifficulty: 580,
    topic: 'Corporate Finance & Travel Policy',
    subSkill: 'additive_transition',
    questionType: 'grammar_conjunction',
    groupId: 'toeic_grp_p6_5',
    passageId: 'toeic_grp_p6_5',
    vocabularyTags: ['in_addition', 'allowance', 'fluctuations'],
    grammarTags: ['discourse_transition'],
    passage: `MEMORANDUM
To: All Corporate Sales Representatives
From: Central Accounting Department
Date: May 8
Subject: Revised Travel Expense Guidelines

Please take note of upcoming revisions to our corporate travel reimbursement procedures effective June 1. Under the updated framework, all domestic flight reservations must be booked at least fourteen business days in advance to secure [ ___1___ ] airfares. Furthermore, expense claims lacking itemized digital receipts will no longer be [ ___2___ ] for processing. [ ___3___ ], employees traveling overseas are permitted a twenty percent increase in daily meal allowances to account for currency fluctuations.`,
    questionText: 'Part 6: Chọn liên từ chuyển ý thích hợp nhất cho chỗ trống [ ___3___ ].',
    options: [
      'A. However',
      'B. In contrast',
      'C. Conversely',
      'D. In addition'
    ],
    correctAnswer: 'D',
    explanation: 'Đoạn văn bổ sung thêm một quyền lợi mới cho nhân viên công tác nước ngoài. Chọn liên từ bổ sung thông tin "In addition" (Ngoài ra).',
    vietnameseTranslation: 'Ngoài ra (In addition), nhân viên công tác nước ngoài được phép tăng 20% phụ cấp ăn uống.',
    keyVocabulary: [
      { word: 'In addition', ipa: '/ɪn əˈdɪʃ.ən/', meaning: 'Ngoài ra, thêm vào đó' }
    ]
  },

  // --- GROUP P6_6 (3 questions - Annual Charity Gala) ---
  {
    id: 'toeic_p6_16',
    part: 'part6_text',
    skill: 'reading',
    difficulty: 'medium',
    estimatedDifficulty: 620,
    topic: 'Corporate Philanthropy & Events',
    subSkill: 'subject_verb_agreement',
    questionType: 'grammar_tense',
    groupId: 'toeic_grp_p6_6',
    passageId: 'toeic_grp_p6_6',
    vocabularyTags: ['celebrates', 'philanthropic', 'gala'],
    grammarTags: ['subject_verb_agreement'],
    passage: `CORDIAL INVITATION: HOPE FOUNDATION ANNUAL GALA
We cordially invite corporate sponsors and community partners to the 12th Annual Hope Foundation Charity Gala, held on Saturday, October 18, at the Bellevue Hotel. This prestigious black-tie evening [ ___1___ ] significant philanthropic contributions toward youth STEM education programs. Because dining capacity in the Grand Ballroom is strictly restricted, early registration is [ ___2___ ] advised. Guests who reserve executive corporate tables by September 15 will [ ___3___ ] complimentary sponsorship branding across all event digital banners.`,
    questionText: 'Part 6: Chọn dạng động từ thích hợp nhất cho chỗ trống [ ___1___ ].',
    options: [
      'A. celebrates',
      'B. celebrated',
      'C. celebrating',
      'D. celebration'
    ],
    correctAnswer: 'A',
    explanation: 'Chủ ngữ số ít "This prestigious black-tie evening" cần động từ chia thì Hiện tại đơn số ít "celebrates".',
    vietnameseTranslation: 'Buổi dạ tiệc trang trọng này tôn vinh (celebrates) những đóng góp từ thiện to lớn.',
    keyVocabulary: [
      { word: 'Philanthropic', ipa: '/ˌfɪl.ənˈθrɒp.ɪk/', meaning: 'Thuộc về từ thiện' }
    ]
  },
  {
    id: 'toeic_p6_17',
    part: 'part6_text',
    skill: 'reading',
    difficulty: 'medium',
    estimatedDifficulty: 630,
    topic: 'Corporate Philanthropy & Events',
    subSkill: 'adverb_degree',
    questionType: 'grammar_pos',
    groupId: 'toeic_grp_p6_6',
    passageId: 'toeic_grp_p6_6',
    vocabularyTags: ['strongly', 'advised', 'registration'],
    grammarTags: ['adverb_modification'],
    passage: `CORDIAL INVITATION: HOPE FOUNDATION ANNUAL GALA
We cordially invite corporate sponsors and community partners to the 12th Annual Hope Foundation Charity Gala, held on Saturday, October 18, at the Bellevue Hotel. This prestigious black-tie evening [ ___1___ ] significant philanthropic contributions toward youth STEM education programs. Because dining capacity in the Grand Ballroom is strictly restricted, early registration is [ ___2___ ] advised. Guests who reserve executive corporate tables by September 15 will [ ___3___ ] complimentary sponsorship branding across all event digital banners.`,
    questionText: 'Part 6: Chọn từ thích hợp nhất để điền vào chỗ trống số [ ___2___ ].',
    options: [
      'A. strong',
      'B. strongly',
      'C. strength',
      'D. strengthen'
    ],
    correctAnswer: 'B',
    explanation: 'Bổ nghĩa cho phân từ "advised", cần trạng từ chỉ mức độ "strongly advised" (được khuyến nghị mạnh mẽ).',
    vietnameseTranslation: 'Vì sức chứa có hạn, việc đăng ký sớm được đặc biệt khuyến khích (strongly advised).',
    keyVocabulary: [
      { word: 'Advised', ipa: '/ədˈvaɪzd/', meaning: 'Được khuyên, khuyến nghị' }
    ]
  },
  {
    id: 'toeic_p6_18',
    part: 'part6_text',
    skill: 'reading',
    difficulty: 'medium',
    estimatedDifficulty: 640,
    topic: 'Corporate Philanthropy & Events',
    subSkill: 'business_collocation',
    questionType: 'vocab_meaning',
    groupId: 'toeic_grp_p6_6',
    passageId: 'toeic_grp_p6_6',
    vocabularyTags: ['receive', 'complimentary', 'branding'],
    grammarTags: ['verb_object_collocation'],
    passage: `CORDIAL INVITATION: HOPE FOUNDATION ANNUAL GALA
We cordially invite corporate sponsors and community partners to the 12th Annual Hope Foundation Charity Gala, held on Saturday, October 18, at the Bellevue Hotel. This prestigious black-tie evening [ ___1___ ] significant philanthropic contributions toward youth STEM education programs. Because dining capacity in the Grand Ballroom is strictly restricted, early registration is [ ___2___ ] advised. Guests who reserve executive corporate tables by September 15 will [ ___3___ ] complimentary sponsorship branding across all event digital banners.`,
    questionText: 'Part 6: Chọn động từ thích hợp nhất cho chỗ trống [ ___3___ ].',
    options: [
      'A. receive',
      'B. cancel',
      'C. decline',
      'D. hesitate'
    ],
    correctAnswer: 'A',
    explanation: 'Sau "will", cần động từ nguyên mẫu mang nghĩa nhận được quyền lợi: "will receive complimentary sponsorship branding".',
    vietnameseTranslation: 'Khách đặt bàn trước ngày 15/9 sẽ nhận được (receive) quảng bá thương hiệu tài trợ miễn phí.',
    keyVocabulary: [
      { word: 'Complimentary', ipa: '/ˌkɒm.plɪˈmen.tər.i/', meaning: 'Miễn phí kèm theo' }
    ]
  },

  // --- GROUP P6_7 (3 questions - IT Cloud Migration Downtime) ---
  {
    id: 'toeic_p6_19',
    part: 'part6_text',
    skill: 'reading',
    difficulty: 'hard',
    estimatedDifficulty: 700,
    topic: 'Enterprise Cloud & System Maintenance',
    subSkill: 'adverb_modifier',
    questionType: 'grammar_pos',
    groupId: 'toeic_grp_p6_7',
    passageId: 'toeic_grp_p6_7',
    vocabularyTags: ['entirely', 'unavailable', 'migration'],
    grammarTags: ['adverb_adjective_modifier'],
    passage: `SYSTEMS ADVISORY: ENTERPRISE DATABASE MIGRATION
To: All Global Staff
From: Infrastructure Architecture Directorate
Date: August 2

Please be advised that our central enterprise database will undergo comprehensive cloud migration this coming weekend, beginning Friday at 9:00 PM and concluding Sunday at 6:00 PM. During this operational window, access to customer relationship records and internal accounting tools will be [ ___1___ ] unavailable. [ ___2___ ], local workstations will remain disconnected from external servers to protect sensitive client records during data transfer. We apologize for any temporary inconvenience and urge project managers to conclude all critical time-sensitive transactions [ ___3___ ] Friday afternoon.`,
    questionText: 'Part 6: Chọn trạng từ phù hợp nhất điền vào khoảng trống [ ___1___ ].',
    options: [
      'A. entirely',
      'B. entire',
      'C. entirety',
      'D. entertain'
    ],
    correctAnswer: 'A',
    explanation: 'Bổ nghĩa cho tính từ "unavailable", cần một trạng từ mức độ "entirely" (hoàn toàn không thể truy cập).',
    vietnameseTranslation: 'Trong khung giờ này, quyền truy cập sẽ hoàn toàn (entirely) không khả dụng.',
    keyVocabulary: [
      { word: 'Unavailable', ipa: '/ˌʌn.əˈveɪ.lə.bəl/', meaning: 'Không thể truy cập / không khả dụng' }
    ]
  },
  {
    id: 'toeic_p6_20',
    part: 'part6_text',
    skill: 'reading',
    difficulty: 'hard',
    estimatedDifficulty: 710,
    topic: 'Enterprise Cloud & System Maintenance',
    subSkill: 'discourse_transition',
    questionType: 'grammar_conjunction',
    groupId: 'toeic_grp_p6_7',
    passageId: 'toeic_grp_p6_7',
    vocabularyTags: ['moreover', 'workstations', 'disconnected'],
    grammarTags: ['additive_transition'],
    passage: `SYSTEMS ADVISORY: ENTERPRISE DATABASE MIGRATION
To: All Global Staff
From: Infrastructure Architecture Directorate
Date: August 2

Please be advised that our central enterprise database will undergo comprehensive cloud migration this coming weekend, beginning Friday at 9:00 PM and concluding Sunday at 6:00 PM. During this operational window, access to customer relationship records and internal accounting tools will be [ ___1___ ] unavailable. [ ___2___ ], local workstations will remain disconnected from external servers to protect sensitive client records during data transfer. We apologize for any temporary inconvenience and urge project managers to conclude all critical time-sensitive transactions [ ___3___ ] Friday afternoon.`,
    questionText: 'Part 6: Chọn liên từ chuyển tiếp thích hợp nhất cho chỗ trống [ ___2___ ].',
    options: [
      'A. Moreover',
      'B. Although',
      'C. Despite',
      'D. Whereas'
    ],
    correctAnswer: 'A',
    explanation: 'Câu sau bổ sung thêm một biện pháp kỹ thuật song song (ngắt kết nối máy trạm nội bộ). Chọn trạng từ nối "Moreover" (Hơn thế nữa).',
    vietnameseTranslation: 'Hơn thế nữa (Moreover), các máy trạm tại chỗ sẽ duy trì ngắt kết nối với máy chủ ngoài.',
    keyVocabulary: [
      { word: 'Moreover', ipa: '/mɔːˈrəʊ.vər/', meaning: 'Hơn thế nữa' }
    ]
  },
  {
    id: 'toeic_p6_21',
    part: 'part6_text',
    skill: 'reading',
    difficulty: 'hard',
    estimatedDifficulty: 720,
    topic: 'Enterprise Cloud & System Maintenance',
    subSkill: 'preposition_deadline',
    questionType: 'grammar_preposition',
    groupId: 'toeic_grp_p6_7',
    passageId: 'toeic_grp_p6_7',
    vocabularyTags: ['prior_to', 'transactions', 'deadline'],
    grammarTags: ['preposition_prior_to'],
    passage: `SYSTEMS ADVISORY: ENTERPRISE DATABASE MIGRATION
To: All Global Staff
From: Infrastructure Architecture Directorate
Date: August 2

Please be advised that our central enterprise database will undergo comprehensive cloud migration this coming weekend, beginning Friday at 9:00 PM and concluding Sunday at 6:00 PM. During this operational window, access to customer relationship records and internal accounting tools will be [ ___1___ ] unavailable. [ ___2___ ], local workstations will remain disconnected from external servers to protect sensitive client records during data transfer. We apologize for any temporary inconvenience and urge project managers to conclude all critical time-sensitive transactions [ ___3___ ] Friday afternoon.`,
    questionText: 'Part 6: Chọn giới từ thời gian thích hợp nhất cho chỗ trống [ ___3___ ].',
    options: [
      'A. prior to',
      'B. until',
      'C. since',
      'D. into'
    ],
    correctAnswer: 'A',
    explanation: 'Cụm giới từ "prior to + time" có nghĩa là trước một thời điểm cụ thể: "prior to Friday afternoon" (trước chiều thứ Sáu).',
    vietnameseTranslation: 'Hoàn tất các giao dịch quan trọng trước (prior to) chiều thứ Sáu.',
    keyVocabulary: [
      { word: 'Prior to', ipa: '/ˈpraɪ.ər tuː/', meaning: 'Trước (thời điểm)' }
    ]
  },

  // --- GROUP P6_8 (3 questions - Leadership Succession) ---
  {
    id: 'toeic_p6_22',
    part: 'part6_text',
    skill: 'reading',
    difficulty: 'hard',
    estimatedDifficulty: 760,
    topic: 'Corporate Governance & Executive Succession',
    subSkill: 'superlative_adjective',
    questionType: 'vocab_meaning',
    groupId: 'toeic_grp_p6_8',
    passageId: 'toeic_grp_p6_8',
    vocabularyTags: ['foremost', 'renewable', 'producers'],
    grammarTags: ['adjective_choice'],
    passage: `PRESS RELEASE: LEADERSHIP SUCCESSION AT VELOX ENERGY
HOUSTON — Velox Energy today announced that Chief Executive Officer Katherine Lindqvist plans to retire at the conclusion of the current fiscal quarter following twenty-two years of distinguished service. Under Ms. Lindqvist’s visionary leadership, Velox transformed into one of the nation’s [ ___1___ ] producers of renewable wind and solar energy. The Board of Directors has unanimously designated Chief Operating Officer Liam Gallagher as her successor. Mr. Gallagher’s extensive operational background makes him uniquely [ ___2___ ] to lead Velox into its next phase of global expansion. [ ___3___ ]`,
    questionText: 'Part 6: Chọn từ vựng thích hợp nhất ngữ cảnh cho vị trí [ ___1___ ].',
    options: [
      'A. foremost',
      'B. prior',
      'C. primitive',
      'D. former'
    ],
    correctAnswer: 'A',
    explanation: '"one of the nation\'s foremost producers" (một trong những nhà sản xuất hàng đầu cả nước). "Foremost" mang nghĩa đứng đầu, quan trọng nhất.',
    vietnameseTranslation: 'Trở thành một trong những nhà sản xuất hàng đầu (foremost) cả nước về năng lượng tái tạo.',
    keyVocabulary: [
      { word: 'Foremost', ipa: '/ˈfɔː.məʊst/', meaning: 'Hàng đầu, quan trọng nhất' }
    ]
  },
  {
    id: 'toeic_p6_23',
    part: 'part6_text',
    skill: 'reading',
    difficulty: 'hard',
    estimatedDifficulty: 770,
    topic: 'Corporate Governance & Executive Succession',
    subSkill: 'predicate_adjective',
    questionType: 'grammar_pos',
    groupId: 'toeic_grp_p6_8',
    passageId: 'toeic_grp_p6_8',
    vocabularyTags: ['qualified', 'successor', 'expansion'],
    grammarTags: ['participle_adjective'],
    passage: `PRESS RELEASE: LEADERSHIP SUCCESSION AT VELOX ENERGY
HOUSTON — Velox Energy today announced that Chief Executive Officer Katherine Lindqvist plans to retire at the conclusion of the current fiscal quarter following twenty-two years of distinguished service. Under Ms. Lindqvist’s visionary leadership, Velox transformed into one of the nation’s [ ___1___ ] producers of renewable wind and solar energy. The Board of Directors has unanimously designated Chief Operating Officer Liam Gallagher as her successor. Mr. Gallagher’s extensive operational background makes him uniquely [ ___2___ ] to lead Velox into its next phase of global expansion. [ ___3___ ]`,
    questionText: 'Part 6: Chọn hình thái từ thích hợp nhất cho chỗ trống [ ___2___ ].',
    options: [
      'A. qualified',
      'B. qualifies',
      'C. qualification',
      'D. qualify'
    ],
    correctAnswer: 'A',
    explanation: 'Cấu trúc "make someone + adj": "makes him uniquely qualified to lead..." (khiến ông ấy có đủ phẩm chất đặc biệt để lãnh đạo).',
    vietnameseTranslation: 'Kinh nghiệm vận hành phong phú giúp ông ấy có đầy đủ năng lực (qualified) để lãnh đạo.',
    keyVocabulary: [
      { word: 'Qualified', ipa: '/ˈkwɒl.ɪ.faɪd/', meaning: 'Đủ điều kiện, có năng lực' }
    ]
  },
  {
    id: 'toeic_p6_24',
    part: 'part6_text',
    skill: 'reading',
    difficulty: 'hard',
    estimatedDifficulty: 780,
    topic: 'Corporate Governance & Executive Succession',
    subSkill: 'sentence_insertion',
    questionType: 'inference',
    groupId: 'toeic_grp_p6_8',
    passageId: 'toeic_grp_p6_8',
    vocabularyTags: ['handover', 'duties', 'succession'],
    grammarTags: ['sentence_context_cohesion'],
    passage: `PRESS RELEASE: LEADERSHIP SUCCESSION AT VELOX ENERGY
HOUSTON — Velox Energy today announced that Chief Executive Officer Katherine Lindqvist plans to retire at the conclusion of the current fiscal quarter following twenty-two years of distinguished service. Under Ms. Lindqvist’s visionary leadership, Velox transformed into one of the nation’s [ ___1___ ] producers of renewable wind and solar energy. The Board of Directors has unanimously designated Chief Operating Officer Liam Gallagher as her successor. Mr. Gallagher’s extensive operational background makes him uniquely [ ___2___ ] to lead Velox into its next phase of global expansion. [ ___3___ ]`,
    questionText: 'Part 6: Chọn câu thích hợp nhất để điền vào chỗ trống số [ ___3___ ].',
    options: [
      'A. The formal handover of executive duties will occur on November 1.',
      'B. The factory will shut down manufacturing completely next week.',
      'C. Gasoline prices are forecasted to fluctuate sharply this winter.',
      'D. Most junior accountants prefer working remotely on Mondays.'
    ],
    correctAnswer: 'A',
    explanation: 'Văn cảnh thông báo chuyển giao quyền lãnh đạo, câu A nêu thời điểm chính thức chuyển giao chức vụ (November 1) tạo sự liền mạch hoàn hảo cho đoạn văn.',
    vietnameseTranslation: 'Buổi bàn giao chính thức nhiệm vụ điều hành sẽ diễn ra vào ngày 1 tháng 11.',
    keyVocabulary: [
      { word: 'Handover', ipa: '/ˈhændˌəʊ.vər/', meaning: 'Sự bàn giao quyền hạn / công việc' }
    ]
  },

  // ===========================================================================
  // PART 7: READING COMPREHENSION (READING - 12 QUESTIONS ACROSS 4 GROUPS)
  // ===========================================================================
  // --- GROUP P7_1 (3 questions) ---
  {
    id: 'toeic_p7_1',
    part: 'part7_reading',
    skill: 'reading',
    difficulty: 'easy',
    topic: 'HR & Work Policy',
    subSkill: 'schedule_extraction',
    questionType: 'specific_detail',
    groupId: 'toeic_grp_p7_1',
    passageId: 'toeic_grp_p7_1',
    vocabularyTags: ['hybrid', 'collaborative', 'schedule'],
    grammarTags: ['passive_required'],
    estimatedDifficulty: 450,
    passage: `MEMORANDUM
To: All Staff Members
From: Human Resources Department
Date: August 28
Subject: New Hybrid Work Policy Implementation

Starting next Monday, our company will formally transition to a hybrid work schedule. Employees in software engineering and product design are required to be present at the office on Tuesdays and Thursdays for core collaborative sessions. For the remaining three days, you may choose to work remotely from home, provided that all sprint deadlines and daily standup check-ins are met.

Please ensure your remote workspace meets our enterprise security standards by installing the updated VPN client available on the company intranet portal by Friday afternoon.`,
    questionText: 'Part 7: On which days are software engineering employees required to work at the office?',
    options: [
      'A. Mondays and Wednesdays',
      'B. Tuesdays and Thursdays',
      'C. Fridays only',
      'D. Every working day'
    ],
    correctAnswer: 'B',
    explanation: 'Trong thông báo ghi rõ: "Employees in software engineering and product design are required to be present at the office on Tuesdays and Thursdays".',
    vietnameseTranslation: 'Nhân viên công nghệ phần mềm được yêu cầu làm việc tại văn phòng vào những ngày nào? (B) Thứ Ba và Thứ Năm.',
    keyVocabulary: [
      { word: 'Hybrid', ipa: '/ˈhaɪ.brɪd/', meaning: 'Mô hình kết hợp' },
      { word: 'Collaborative', ipa: '/kəˈlæb.ər.ə.tɪv/', meaning: 'Mang tính hợp tác' }
    ]
  },
  {
    id: 'toeic_p7_2',
    part: 'part7_reading',
    skill: 'reading',
    difficulty: 'easy',
    topic: 'HR & Work Policy',
    subSkill: 'action_item_identification',
    questionType: 'specific_detail',
    groupId: 'toeic_grp_p7_1',
    passageId: 'toeic_grp_p7_1',
    vocabularyTags: ['enterprise', 'security', 'vpn'],
    grammarTags: ['gerund_by_installing'],
    estimatedDifficulty: 480,
    passage: `MEMORANDUM
To: All Staff Members
From: Human Resources Department
Date: August 28
Subject: New Hybrid Work Policy Implementation

Starting next Monday, our company will formally transition to a hybrid work schedule. Employees in software engineering and product design are required to be present at the office on Tuesdays and Thursdays for core collaborative sessions. For the remaining three days, you may choose to work remotely from home, provided that all sprint deadlines and daily standup check-ins are met.

Please ensure your remote workspace meets our enterprise security standards by installing the updated VPN client available on the company intranet portal by Friday afternoon.`,
    questionText: 'Part 7: What must employees do before Friday afternoon?',
    options: [
      'A. Submit a formal resignation letter',
      'B. Purchase new ergonomic desks',
      'C. Install the updated VPN client software',
      'D. Schedule a meeting with the HR Director'
    ],
    correctAnswer: 'C',
    explanation: 'Bản ghi nhớ kết luận: "...installing the updated VPN client available on the company intranet portal by Friday afternoon".',
    vietnameseTranslation: 'Nhân viên phải làm gì trước chiều thứ Sáu? (C) Cài đặt phần mềm VPN cập nhật.',
    keyVocabulary: [
      { word: 'Enterprise security', ipa: '/ˈen.tə.praɪz sɪˈkjʊə.rə.ti/', meaning: 'Bảo mật cấp doanh nghiệp' }
    ]
  },
  {
    id: 'toeic_p7_1_c',
    part: 'part7_reading',
    skill: 'reading',
    difficulty: 'medium',
    topic: 'HR & Work Policy',
    subSkill: 'condition_extraction',
    questionType: 'specific_detail',
    groupId: 'toeic_grp_p7_1',
    passageId: 'toeic_grp_p7_1',
    vocabularyTags: ['provided_that', 'standup', 'deadlines'],
    grammarTags: ['conditional_clause'],
    estimatedDifficulty: 510,
    passage: `MEMORANDUM
To: All Staff Members
From: Human Resources Department
Date: August 28
Subject: New Hybrid Work Policy Implementation

Starting next Monday, our company will formally transition to a hybrid work schedule. Employees in software engineering and product design are required to be present at the office on Tuesdays and Thursdays for core collaborative sessions. For the remaining three days, you may choose to work remotely from home, provided that all sprint deadlines and daily standup check-ins are met.

Please ensure your remote workspace meets our enterprise security standards by installing the updated VPN client available on the company intranet portal by Friday afternoon.`,
    questionText: 'Part 7: What condition must be fulfilled for employees to work from home on the remaining days?',
    options: [
      'A. They must meet all sprint deadlines and attend daily standup check-ins',
      'B. They must work at least ten overtime hours per week',
      'C. They must surrender their corporate laptop computers',
      'D. They must live within five kilometers of the office building'
    ],
    correctAnswer: 'A',
    explanation: 'Đoạn văn nêu điều kiện: "...provided that all sprint deadlines and daily standup check-ins are met".',
    vietnameseTranslation: 'Điều kiện nào phải được đáp ứng để nhân viên làm việc tại nhà? (A) Phải đáp ứng mọi hạn chót sprint và tham gia điểm danh standup hàng ngày.',
    keyVocabulary: [
      { word: 'Provided that', ipa: '/prəˈvaɪ.dɪd ðæt/', meaning: 'Với điều kiện là' }
    ]
  },

  // --- GROUP P7_2 (3 questions) ---
  {
    id: 'toeic_p7_3',
    part: 'part7_reading',
    skill: 'reading',
    difficulty: 'medium',
    topic: 'Customer Support & Warranty',
    subSkill: 'issue_identification',
    questionType: 'specific_detail',
    groupId: 'toeic_grp_p7_2',
    passageId: 'toeic_grp_p7_2',
    vocabularyTags: ['defective', 'warranty', 'hardware'],
    grammarTags: ['past_simple'],
    estimatedDifficulty: 560,
    passage: `EMAIL CORRESPONDENCE
From: Clara Dupont <c.dupont@vortextech.com>
To: Support Desk <support@luminaoffice.com>
Date: October 4, 10:15 AM
Subject: Warranty inquiry for Lumina Pro Projector (Model LP-400)

Dear Lumina Support Team,
Our firm purchased four units of the Lumina Pro Projector last November for our executive conference rooms. Yesterday, one unit ceased displaying video signals while the cooling fan continued operating at maximum speed. 

According to our purchasing invoice, these projectors came with a comprehensive three-year corporate hardware warranty. Could you please provide instructions on shipping this defective unit for repair or dispatching an on-site technician? We have a major investor summit scheduled in two weeks.

Best regards,
Clara Dupont
Facility Coordinator, Vortex Technologies`,
    questionText: 'Part 7: What issue is Ms. Dupont experiencing with the projector?',
    options: [
      'A. The cooling fan has stopped rotating completely',
      'B. The video display failed while the fan kept running',
      'C. The power cable was severed during installation',
      'D. The remote control battery compartment is missing'
    ],
    correctAnswer: 'B',
    explanation: 'Email chỉ rõ: "one unit ceased displaying video signals while the cooling fan continued operating at maximum speed".',
    vietnameseTranslation: 'Cô Dupont gặp sự cố gì với máy chiếu? (B) Màn hình mất tín hiệu trong khi quạt tản nhiệt vẫn chạy.',
    keyVocabulary: [
      { word: 'Defective', ipa: '/dɪˈfek.tɪv/', meaning: 'Bị lỗi, hỏng hóc' }
    ]
  },
  {
    id: 'toeic_p7_4',
    part: 'part7_reading',
    skill: 'reading',
    difficulty: 'medium',
    topic: 'Customer Support & Warranty',
    subSkill: 'urgency_motive',
    questionType: 'inference_author',
    groupId: 'toeic_grp_p7_2',
    passageId: 'toeic_grp_p7_2',
    vocabularyTags: ['dispatching', 'coordinator', 'summit'],
    grammarTags: ['present_participle'],
    estimatedDifficulty: 590,
    passage: `EMAIL CORRESPONDENCE
From: Clara Dupont <c.dupont@vortextech.com>
To: Support Desk <support@luminaoffice.com>
Date: October 4, 10:15 AM
Subject: Warranty inquiry for Lumina Pro Projector (Model LP-400)

Dear Lumina Support Team,
Our firm purchased four units of the Lumina Pro Projector last November for our executive conference rooms. Yesterday, one unit ceased displaying video signals while the cooling fan continued operating at maximum speed. 

According to our purchasing invoice, these projectors came with a comprehensive three-year corporate hardware warranty. Could you please provide instructions on shipping this defective unit for repair or dispatching an on-site technician? We have a major investor summit scheduled in two weeks.

Best regards,
Clara Dupont
Facility Coordinator, Vortex Technologies`,
    questionText: 'Part 7: Why is Ms. Dupont seeking an urgent resolution?',
    options: [
      'A. The three-year warranty will expire in two days',
      'B. Her company has an investor summit in two weeks',
      'C. She needs to submit an insurance claim tomorrow',
      'D. The office is moving to a different corporate park'
    ],
    correctAnswer: 'B',
    explanation: 'Cuối thư cô Dupont nhấn mạnh: "We have a major investor summit scheduled in two weeks".',
    vietnameseTranslation: 'Tại sao cô Dupont cần giải quyết khẩn cấp? (B) Công ty có hội nghị nhà đầu tư trong hai tuần tới.',
    keyVocabulary: [
      { word: 'Dispatching', ipa: '/dɪˈspætʃ.ɪŋ/', meaning: 'Cử đi, điều động' }
    ]
  },
  {
    id: 'toeic_p7_2_c',
    part: 'part7_reading',
    skill: 'reading',
    difficulty: 'easy',
    topic: 'Customer Support & Warranty',
    subSkill: 'warranty_duration',
    questionType: 'specific_detail',
    groupId: 'toeic_grp_p7_2',
    passageId: 'toeic_grp_p7_2',
    vocabularyTags: ['warranty', 'three_year'],
    grammarTags: ['adjective_compound'],
    estimatedDifficulty: 420,
    passage: `EMAIL CORRESPONDENCE
From: Clara Dupont <c.dupont@vortextech.com>
To: Support Desk <support@luminaoffice.com>
Date: October 4, 10:15 AM
Subject: Warranty inquiry for Lumina Pro Projector (Model LP-400)

Dear Lumina Support Team,
Our firm purchased four units of the Lumina Pro Projector last November for our executive conference rooms. Yesterday, one unit ceased displaying video signals while the cooling fan continued operating at maximum speed. 

According to our purchasing invoice, these projectors came with a comprehensive three-year corporate hardware warranty. Could you please provide instructions on shipping this defective unit for repair or dispatching an on-site technician? We have a major investor summit scheduled in two weeks.

Best regards,
Clara Dupont
Facility Coordinator, Vortex Technologies`,
    questionText: 'Part 7: What warranty duration covers the Lumina Pro Projectors?',
    options: [
      'A. One year',
      'B. Two years',
      'C. Three years',
      'D. Five years'
    ],
    correctAnswer: 'C',
    explanation: 'Bản thư nêu rõ: "...these projectors came with a comprehensive three-year corporate hardware warranty".',
    vietnameseTranslation: 'Thời hạn bảo hành của máy chiếu là bao lâu? (C) 3 năm.',
    keyVocabulary: [
      { word: 'Comprehensive', ipa: '/ˌkɒm.prɪˈhen.sɪv/', meaning: 'Toàn diện' }
    ]
  },

  // --- GROUP P7_3 (3 questions) ---
  {
    id: 'toeic_p7_5',
    part: 'part7_reading',
    skill: 'reading',
    difficulty: 'medium',
    topic: 'Real Estate & Contracts',
    subSkill: 'amount_extraction',
    questionType: 'specific_detail',
    groupId: 'toeic_grp_p7_3',
    passageId: 'toeic_grp_p7_3',
    vocabularyTags: ['rent', 'calendar_month', 'lease'],
    grammarTags: ['numeric_expression'],
    estimatedDifficulty: 580,
    passage: `EXECUTIVE LEASE ABSTRACT
Property: Westlake Financial Tower, Suite 1400 (5,500 sq ft)
Landlord: Highline Commercial Properties LLC
Tenant: Nexus BioHealth Corp
Term: 36 Months (Effective January 1, 2027 to December 31, 2029)

Terms and Conditions:
1. Base Rent: $18,500 per calendar month, due on the first day of each month. Late payments past the fifth day will incur an automatic 5% penalty fee.
2. Tenant Improvements: Landlord agrees to furnish a $25,000 tenant improvement allowance dedicated exclusively to fiber-optic data cabling and HVAC recalibration.
3. Subleasing: Tenant shall not assign or sublease any portion of Suite 1400 without prior written consent from the Landlord, which shall not be unreasonably withheld.`,
    questionText: 'Part 7: What is the monthly base rent for Suite 1400?',
    options: [
      'A. $5,500',
      'B. $18,500',
      'C. $25,000',
      'D. $36,000'
    ],
    correctAnswer: 'B',
    explanation: 'Mục 1 ghi rõ: "Base Rent: $18,500 per calendar month".',
    vietnameseTranslation: 'Tiền thuê cơ bản hàng tháng cho Phòng 1400 là bao nhiêu? (B) 18.500 USD.',
    keyVocabulary: [
      { word: 'Base Rent', ipa: '/beɪs rent/', meaning: 'Tiền thuê cơ sở' }
    ]
  },
  {
    id: 'toeic_p7_6',
    part: 'part7_reading',
    skill: 'reading',
    difficulty: 'medium',
    topic: 'Real Estate & Contracts',
    subSkill: 'condition_interpretation',
    questionType: 'specific_detail',
    groupId: 'toeic_grp_p7_3',
    passageId: 'toeic_grp_p7_3',
    vocabularyTags: ['penalty', 'late_payment'],
    grammarTags: ['conditional_temporal'],
    estimatedDifficulty: 610,
    passage: `EXECUTIVE LEASE ABSTRACT
Property: Westlake Financial Tower, Suite 1400 (5,500 sq ft)
Landlord: Highline Commercial Properties LLC
Tenant: Nexus BioHealth Corp
Term: 36 Months (Effective January 1, 2027 to December 31, 2029)

Terms and Conditions:
1. Base Rent: $18,500 per calendar month, due on the first day of each month. Late payments past the fifth day will incur an automatic 5% penalty fee.
2. Tenant Improvements: Landlord agrees to furnish a $25,000 tenant improvement allowance dedicated exclusively to fiber-optic data cabling and HVAC recalibration.
3. Subleasing: Tenant shall not assign or sublease any portion of Suite 1400 without prior written consent from the Landlord, which shall not be unreasonably withheld.`,
    questionText: 'Part 7: When does a late payment penalty apply to the tenant?',
    options: [
      'A. If rent is submitted after the fifth day of the month',
      'B. If the tenant vacates the property before 36 months',
      'C. If electricity consumption exceeds the building quota',
      'D. If data cabling is installed without union workers'
    ],
    correctAnswer: 'A',
    explanation: 'Điều khoản 1 nêu rõ: "Late payments past the fifth day will incur an automatic 5% penalty fee".',
    vietnameseTranslation: 'Khi nào tiền phạt nộp muộn áp dụng cho bên thuê? (A) Nếu tiền thuê nộp sau ngày thứ 5 của tháng.',
    keyVocabulary: [
      { word: 'Incur', ipa: '/ɪnˈkɜːr/', meaning: 'Gánh chịu, phát sinh (chi phí/phạt)' }
    ]
  },
  {
    id: 'toeic_p7_7',
    part: 'part7_reading',
    skill: 'reading',
    difficulty: 'hard',
    topic: 'Real Estate & Contracts',
    subSkill: 'sublease_requirement',
    questionType: 'inference_author',
    groupId: 'toeic_grp_p7_3',
    passageId: 'toeic_grp_p7_3',
    vocabularyTags: ['subleasing', 'consent', 'landlord'],
    grammarTags: ['negative_modal'],
    estimatedDifficulty: 690,
    passage: `EXECUTIVE LEASE ABSTRACT
Property: Westlake Financial Tower, Suite 1400 (5,500 sq ft)
Landlord: Highline Commercial Properties LLC
Tenant: Nexus BioHealth Corp
Term: 36 Months (Effective January 1, 2027 to December 31, 2029)

Terms and Conditions:
1. Base Rent: $18,500 per calendar month, due on the first day of each month. Late payments past the fifth day will incur an automatic 5% penalty fee.
2. Tenant Improvements: Landlord agrees to furnish a $25,000 tenant improvement allowance dedicated exclusively to fiber-optic data cabling and HVAC recalibration.
3. Subleasing: Tenant shall not assign or sublease any portion of Suite 1400 without prior written consent from the Landlord, which shall not be unreasonably withheld.`,
    questionText: 'Part 7: What must Nexus BioHealth do before renting office space to another business?',
    options: [
      'A. Repay the entire $25,000 improvement allowance',
      'B. Obtain prior written authorization from Highline Commercial Properties',
      'C. Increase the monthly base rent by 10 percent',
      'D. File a public notice with the city municipality'
    ],
    correctAnswer: 'B',
    explanation: 'Điều khoản 3 quy định: "...shall not assign or sublease any portion of Suite 1400 without prior written consent from the Landlord".',
    vietnameseTranslation: 'Bên thuê phải làm gì trước khi cho công ty khác thuê lại văn phòng? (B) Xin văn bản đồng ý trước từ chủ tòa nhà.',
    keyVocabulary: [
      { word: 'Sublease', ipa: '/ˈsʌb.liːs/', meaning: 'Cho thuê lại' },
      { word: 'Consent', ipa: '/kənˈsent/', meaning: 'Sự bằng lòng, chấp thuận' }
    ]
  },

  // --- GROUP P7_4 (3 questions - Double Passage) ---
  {
    id: 'toeic_p7_8',
    part: 'part7_reading',
    skill: 'reading',
    difficulty: 'hard',
    topic: 'Client Accounting & Invoicing',
    subSkill: 'discrepancy_identification',
    questionType: 'specific_detail',
    groupId: 'toeic_grp_p7_4',
    passageId: 'toeic_grp_p7_4',
    vocabularyTags: ['invoice', 'discrepancy', 'subscription'],
    grammarTags: ['past_passive'],
    estimatedDifficulty: 740,
    passage: `[DOCUMENT 1: EMAIL]
From: Arthur Campbell <a.campbell@campbelldesign.com>
To: Accounts Receivable <billing@veritascloud.io>
Date: April 14
Subject: Discrepancy on Invoice #VC-8841

Dear Veritas Billing Team,
I am reviewing our monthly subscription invoice #VC-8841 for March services. We were billed for fifty active enterprise cloud seats at $40 per user ($2,000). However, according to our contract amendment signed on February 28, our team downsized to thirty-five active seats effective March 1. Please re-issue an adjusted invoice reflecting the accurate total of $1,400.

Sincerely,
Arthur Campbell
Managing Partner, Campbell Design Studio

---
[DOCUMENT 2: RESPONSE EMAIL]
From: Elena Rostova <e.rostova@veritascloud.io>
To: Arthur Campbell <a.campbell@campbelldesign.com>
Date: April 15
Subject: RE: Discrepancy on Invoice #VC-8841

Dear Mr. Campbell,
Thank you for bringing this to our attention. Our automated billing engine had not refreshed your user tier prior to the March billing run. We have verified your February 28 amendment and issued revised Invoice #VC-8841-A for $1,400. Additionally, we have credited a $50 courtesy voucher toward your April account balance for the inconvenience.

Best regards,
Elena Rostova
Senior Billing Specialist, Veritas Cloud Solutions`,
    questionText: 'Part 7: Why did Mr. Campbell contact the billing team?',
    options: [
      'A. To request a renewal of an expired corporate discount',
      'B. To report an overcharge based on outdated user seat counts',
      'C. To terminate Campbell Design’s cloud services immediately',
      'D. To inquire about upgrading to dedicated private servers'
    ],
    correctAnswer: 'B',
    explanation: 'Ông Campbell viết thư phản ánh việc bị tính tiền cho 50 tài khoản thay vì 35 tài khoản sau khi đã ký phụ lục hợp đồng giảm quy mô.',
    vietnameseTranslation: 'Tại sao ông Campbell liên hệ với bộ phận thanh toán? (B) Để phản ánh việc bị tính tiền thừa do số lượng tài khoản cũ.',
    keyVocabulary: [
      { word: 'Downsized', ipa: '/ˈdaʊn.saɪzd/', meaning: 'Thu nhỏ quy mô' }
    ]
  },
  {
    id: 'toeic_p7_9',
    part: 'part7_reading',
    skill: 'reading',
    difficulty: 'hard',
    topic: 'Client Accounting & Invoicing',
    subSkill: 'amount_calculation',
    questionType: 'specific_detail',
    groupId: 'toeic_grp_p7_4',
    passageId: 'toeic_grp_p7_4',
    vocabularyTags: ['adjusted', 'invoice', 'voucher'],
    grammarTags: ['numeric_expression'],
    estimatedDifficulty: 760,
    passage: `[DOCUMENT 1: EMAIL]
From: Arthur Campbell <a.campbell@campbelldesign.com>
To: Accounts Receivable <billing@veritascloud.io>
Date: April 14
Subject: Discrepancy on Invoice #VC-8841

Dear Veritas Billing Team,
I am reviewing our monthly subscription invoice #VC-8841 for March services. We were billed for fifty active enterprise cloud seats at $40 per user ($2,000). However, according to our contract amendment signed on February 28, our team downsized to thirty-five active seats effective March 1. Please re-issue an adjusted invoice reflecting the accurate total of $1,400.

Sincerely,
Arthur Campbell
Managing Partner, Campbell Design Studio

---
[DOCUMENT 2: RESPONSE EMAIL]
From: Elena Rostova <e.rostova@veritascloud.io>
To: Arthur Campbell <a.campbell@campbelldesign.com>
Date: April 15
Subject: RE: Discrepancy on Invoice #VC-8841

Dear Mr. Campbell,
Thank you for bringing this to our attention. Our automated billing engine had not refreshed your user tier prior to the March billing run. We have verified your February 28 amendment and issued revised Invoice #VC-8841-A for $1,400. Additionally, we have credited a $50 courtesy voucher toward your April account balance for the inconvenience.

Best regards,
Elena Rostova
Senior Billing Specialist, Veritas Cloud Solutions`,
    questionText: 'Part 7: What is the corrected amount of Invoice #VC-8841-A?',
    options: [
      'A. $1,350',
      'B. $1,400',
      'C. $1,950',
      'D. $2,000'
    ],
    correctAnswer: 'B',
    explanation: 'Cả hai tài liệu đều nêu rõ số tiền hóa đơn đã điều chỉnh là $1,400 (35 người dùng x $40).',
    vietnameseTranslation: 'Số tiền chính xác trên hóa đơn sửa đổi VC-8841-A là bao nhiêu? (B) 1.400 USD.',
    keyVocabulary: [
      { word: 'Revised', ipa: '/rɪˈvaɪzd/', meaning: 'Đã sửa đổi' }
    ]
  },
  {
    id: 'toeic_p7_10',
    part: 'part7_reading',
    skill: 'reading',
    difficulty: 'hard',
    topic: 'Client Accounting & Invoicing',
    subSkill: 'cross_document_inference',
    questionType: 'inference_author',
    groupId: 'toeic_grp_p7_4',
    passageId: 'toeic_grp_p7_4',
    vocabularyTags: ['courtesy', 'credit', 'inconvenience'],
    grammarTags: ['present_perfect'],
    estimatedDifficulty: 790,
    passage: `[DOCUMENT 1: EMAIL]
From: Arthur Campbell <a.campbell@campbelldesign.com>
To: Accounts Receivable <billing@veritascloud.io>
Date: April 14
Subject: Discrepancy on Invoice #VC-8841

Dear Veritas Billing Team,
I am reviewing our monthly subscription invoice #VC-8841 for March services. We were billed for fifty active enterprise cloud seats at $40 per user ($2,000). However, according to our contract amendment signed on February 28, our team downsized to thirty-five active seats effective March 1. Please re-issue an adjusted invoice reflecting the accurate total of $1,400.

Sincerely,
Arthur Campbell
Managing Partner, Campbell Design Studio

---
[DOCUMENT 2: RESPONSE EMAIL]
From: Elena Rostova <e.rostova@veritascloud.io>
To: Arthur Campbell <a.campbell@campbelldesign.com>
Date: April 15
Subject: RE: Discrepancy on Invoice #VC-8841

Dear Mr. Campbell,
Thank you for bringing this to our attention. Our automated billing engine had not refreshed your user tier prior to the March billing run. We have verified your February 28 amendment and issued revised Invoice #VC-8841-A for $1,400. Additionally, we have credited a $50 courtesy voucher toward your April account balance for the inconvenience.

Best regards,
Elena Rostova
Senior Billing Specialist, Veritas Cloud Solutions`,
    questionText: 'Part 7: What extra compensation did Veritas Cloud Solutions grant to Campbell Design?',
    options: [
      'A. A full refund for the entire month of February',
      'B. Three free months of dedicated customer phone support',
      'C. A $50 voucher applied to their April billing cycle',
      'D. An upgrade to seventy-five enterprise user seats'
    ],
    correctAnswer: 'C',
    explanation: 'Bà Rostova thông báo ở cuối email: "Additionally, we have credited a $50 courtesy voucher toward your April account balance for the inconvenience".',
    vietnameseTranslation: 'Veritas Cloud Solutions đã đền bù thêm khoản gì cho Campbell Design? (C) Một phiếu giảm giá 50 USD áp dụng cho kỳ hóa đơn tháng Tư.',
    keyVocabulary: [
      { word: 'Courtesy voucher', ipa: '/ˈkɜː.tə.si ˈvaʊ.tʃər/', meaning: 'Phiếu ưu đãi tri ân khách hàng' }
    ]
  },

  // --- GROUP P7_5 (3 questions - Transit Service Restructuring) ---
  {
    id: 'toeic_p7_11',
    part: 'part7_reading',
    skill: 'reading',
    difficulty: 'easy',
    estimatedDifficulty: 460,
    topic: 'Transportation & Commuter Advisory',
    subSkill: 'cause_identification',
    questionType: 'detail',
    groupId: 'toeic_grp_p7_5',
    passageId: 'toeic_grp_p7_5',
    vocabularyTags: ['suspended', 'track', 'upgrades'],
    grammarTags: ['prepositional_due_to'],
    passage: `METROPOLITAN TRANSIT AUTHORITY (MTA)
WEEKEND RAILWAY SERVICE RESTRUCTURING
Dates: Saturday, October 12 – Sunday, October 13

Due to necessary track replacement and electrical catenary upgrades between Greenfield Station and Harbor Central, Red Line train services will be suspended throughout the upcoming weekend.

Temporary Service Alternatives:
- Express Bus Shuttles (Route 40-X): Depart every 10 minutes from Greenfield Station directly to Harbor Central. Travel time is approximately 25 minutes. No fare required with a valid rail pass.
- Local Bus Shuttles (Route 40-L): Stop at all intermediate stations (Oak Park, Riverview, Civic Plaza). Departures every 15 minutes.
- Regular rail service will resume promptly with the first morning train on Monday, October 14, at 5:15 AM.

Customer service agents in bright yellow jackets will be stationed at all affected platforms to assist passengers.`,
    questionText: 'Part 7: Why will Red Line train service be suspended this weekend?',
    options: [
      'A. Severe storm damage across coastal terminals',
      'B. Scheduled track replacement and electrical catenary upgrades',
      'C. An unexpected regional transit strike by train conductors',
      'D. Construction of a brand-new airport terminal station'
    ],
    correctAnswer: 'B',
    explanation: 'Thông báo nêu: "Due to necessary track replacement and electrical catenary upgrades... Red Line train services will be suspended...".',
    vietnameseTranslation: 'Tại sao dịch vụ tàu tuyến Đỏ bị tạm ngưng cuối tuần này? (B) Thay thế đường ray định kỳ và nâng cấp hệ thống dây điện trên cao.',
    keyVocabulary: [
      { word: 'Suspended', ipa: '/səˈspen.dɪd/', meaning: 'Bị tạm ngưng hoạt động' }
    ]
  },
  {
    id: 'toeic_p7_12',
    part: 'part7_reading',
    skill: 'reading',
    difficulty: 'easy',
    estimatedDifficulty: 470,
    topic: 'Transportation & Commuter Advisory',
    subSkill: 'scanning_number',
    questionType: 'detail',
    groupId: 'toeic_grp_p7_5',
    passageId: 'toeic_grp_p7_5',
    vocabularyTags: ['shuttles', 'departures', 'frequency'],
    grammarTags: ['temporal_adverbial'],
    passage: `METROPOLITAN TRANSIT AUTHORITY (MTA)
WEEKEND RAILWAY SERVICE RESTRUCTURING
Dates: Saturday, October 12 – Sunday, October 13

Due to necessary track replacement and electrical catenary upgrades between Greenfield Station and Harbor Central, Red Line train services will be suspended throughout the upcoming weekend.

Temporary Service Alternatives:
- Express Bus Shuttles (Route 40-X): Depart every 10 minutes from Greenfield Station directly to Harbor Central. Travel time is approximately 25 minutes. No fare required with a valid rail pass.
- Local Bus Shuttles (Route 40-L): Stop at all intermediate stations (Oak Park, Riverview, Civic Plaza). Departures every 15 minutes.
- Regular rail service will resume promptly with the first morning train on Monday, October 14, at 5:15 AM.

Customer service agents in bright yellow jackets will be stationed at all affected platforms to assist passengers.`,
    questionText: 'Part 7: How frequently do Express Bus Shuttles (Route 40-X) depart from Greenfield Station?',
    options: [
      'A. Every 10 minutes',
      'B. Every 15 minutes',
      'C. Every 25 minutes',
      'D. Once an hour'
    ],
    correctAnswer: 'A',
    explanation: 'Văn bản nêu: "Express Bus Shuttles (Route 40-X): Depart every 10 minutes from Greenfield Station directly to Harbor Central".',
    vietnameseTranslation: 'Xe buýt tốc hành (Tuyến 40-X) khởi hành từ Ga Greenfield bao lâu một chuyến? (A) Cứ mỗi 10 phút một chuyến.',
    keyVocabulary: [
      { word: 'Shuttles', ipa: '/ˈʃʌt.əlz/', meaning: 'Xe buýt trung chuyển tuyến ngắn' }
    ]
  },
  {
    id: 'toeic_p7_13',
    part: 'part7_reading',
    skill: 'reading',
    difficulty: 'easy',
    estimatedDifficulty: 480,
    topic: 'Transportation & Commuter Advisory',
    subSkill: 'detail',
    questionType: 'detail',
    groupId: 'toeic_grp_p7_5',
    passageId: 'toeic_grp_p7_5',
    vocabularyTags: ['agents', 'platforms', 'assist'],
    grammarTags: ['passive_voice'],
    passage: `METROPOLITAN TRANSIT AUTHORITY (MTA)
WEEKEND RAILWAY SERVICE RESTRUCTURING
Dates: Saturday, October 12 – Sunday, October 13

Due to necessary track replacement and electrical catenary upgrades between Greenfield Station and Harbor Central, Red Line train services will be suspended throughout the upcoming weekend.

Temporary Service Alternatives:
- Express Bus Shuttles (Route 40-X): Depart every 10 minutes from Greenfield Station directly to Harbor Central. Travel time is approximately 25 minutes. No fare required with a valid rail pass.
- Local Bus Shuttles (Route 40-L): Stop at all intermediate stations (Oak Park, Riverview, Civic Plaza). Departures every 15 minutes.
- Regular rail service will resume promptly with the first morning train on Monday, October 14, at 5:15 AM.

Customer service agents in bright yellow jackets will be stationed at all affected platforms to assist passengers.`,
    questionText: 'Part 7: What does the notice say about customer service agents?',
    options: [
      'A. They will inspect electronic tickets inside buses',
      'B. They will distribute free coffee and newspapers',
      'C. They will wear bright yellow jackets to assist passengers on platforms',
      'D. They will sell discount monthly railway passes'
    ],
    correctAnswer: 'C',
    explanation: 'Câu cuối thông báo: "Customer service agents in bright yellow jackets will be stationed at all affected platforms to assist passengers".',
    vietnameseTranslation: 'Thông báo nêu điều gì về nhân viên dịch vụ khách hàng? (C) Họ sẽ mặc áo khoác màu vàng sáng để hỗ trợ hành khách trên các sân ga.',
    keyVocabulary: [
      { word: 'Stationed', ipa: '/ˈsteɪ.ʃənd/', meaning: 'Được bố trí túc trực' }
    ]
  },

  // --- GROUP P7_6 (3 questions - E-Commerce Support Ticket) ---
  {
    id: 'toeic_p7_14',
    part: 'part7_reading',
    skill: 'reading',
    difficulty: 'medium',
    estimatedDifficulty: 580,
    topic: 'E-Commerce Customer Service',
    subSkill: 'purpose',
    questionType: 'main_idea',
    groupId: 'toeic_grp_p7_6',
    passageId: 'toeic_grp_p7_6',
    vocabularyTags: ['replacement', 'damaged', 'porcelain'],
    grammarTags: ['infinitive_purpose'],
    passage: `SUPPORT TICKET #49021
Customer Name: Rebecca Sterling
Order Number: #ORD-98214 (Placed on: September 4)
Subject: Replacement request for damaged porcelain dinnerware set

Dear Customer Care Team,
I received package #ORD-98214 yesterday afternoon containing the 16-piece Artisanal Porcelain Dinnerware Set that I purchased as an anniversary gift. While the outer cardboard parcel was intact, three ceramic dinner plates inside the presentation box were shattered upon opening, likely due to insufficient bubble padding.

As the anniversary celebration takes place this coming Saturday, September 14, I would prefer an expedited replacement rather than a store credit. I have uploaded high-resolution photographs of the damaged items and the shipping barcode via your customer portal. Could you please confirm if a replacement parcel can be dispatched via overnight courier?

Thank you,
Rebecca Sterling`,
    questionText: 'Part 7: What is the primary purpose of Ms. Sterling’s message?',
    options: [
      'A. To cancel an annual subscription service',
      'B. To request an expedited replacement for broken merchandise',
      'C. To inquire about becoming a retail distributor',
      'D. To write a complimentary testimonial for a chef'
    ],
    correctAnswer: 'B',
    explanation: 'Khách hàng viết thư yêu cầu: "...three ceramic dinner plates inside the presentation box were shattered... prefer an expedited replacement...".',
    vietnameseTranslation: 'Mục đích chính trong tin nhắn của bà Sterling là gì? (B) Yêu cầu đổi gấp món hàng bị vỡ.',
    keyVocabulary: [
      { word: 'Porcelain', ipa: '/ˈpɔː.səl.ɪn/', meaning: 'Đồ sứ mỹ nghệ' }
    ]
  },
  {
    id: 'toeic_p7_15',
    part: 'part7_reading',
    skill: 'reading',
    difficulty: 'medium',
    estimatedDifficulty: 590,
    topic: 'E-Commerce Customer Service',
    subSkill: 'inference',
    questionType: 'inference_author',
    groupId: 'toeic_grp_p7_6',
    passageId: 'toeic_grp_p7_6',
    vocabularyTags: ['shattered', 'padding', 'insufficient'],
    grammarTags: ['prepositional_due_to'],
    passage: `SUPPORT TICKET #49021
Customer Name: Rebecca Sterling
Order Number: #ORD-98214 (Placed on: September 4)
Subject: Replacement request for damaged porcelain dinnerware set

Dear Customer Care Team,
I received package #ORD-98214 yesterday afternoon containing the 16-piece Artisanal Porcelain Dinnerware Set that I purchased as an anniversary gift. While the outer cardboard parcel was intact, three ceramic dinner plates inside the presentation box were shattered upon opening, likely due to insufficient bubble padding.

As the anniversary celebration takes place this coming Saturday, September 14, I would prefer an expedited replacement rather than a store credit. I have uploaded high-resolution photographs of the damaged items and the shipping barcode via your customer portal. Could you please confirm if a replacement parcel can be dispatched via overnight courier?

Thank you,
Rebecca Sterling`,
    questionText: 'Part 7: What does Ms. Sterling indicate regarding the cause of the breakage?',
    options: [
      'A. The parcel was left outdoors in heavy rain',
      'B. The courier mishandled the outer cardboard box',
      'C. Inadequate bubble protective padding inside the gift box',
      'D. Defective ceramic manufacturing molds'
    ],
    correctAnswer: 'C',
    explanation: 'Bà Sterling nhận định: "...likely due to insufficient bubble padding".',
    vietnameseTranslation: 'Bà Sterling chỉ ra nguyên nhân khiến đĩa bị vỡ là gì? (C) Không đủ lớp đệm bóng khí bảo vệ bên trong hộp.',
    keyVocabulary: [
      { word: 'Insufficient', ipa: '/ˌɪn.səˈfɪʃ.ənt/', meaning: 'Không đầy đủ, thiếu hụt' }
    ]
  },
  {
    id: 'toeic_p7_16',
    part: 'part7_reading',
    skill: 'reading',
    difficulty: 'medium',
    estimatedDifficulty: 600,
    topic: 'E-Commerce Customer Service',
    subSkill: 'detail',
    questionType: 'detail',
    groupId: 'toeic_grp_p7_6',
    passageId: 'toeic_grp_p7_6',
    vocabularyTags: ['uploaded', 'barcode', 'portal'],
    grammarTags: ['present_perfect'],
    passage: `SUPPORT TICKET #49021
Customer Name: Rebecca Sterling
Order Number: #ORD-98214 (Placed on: September 4)
Subject: Replacement request for damaged porcelain dinnerware set

Dear Customer Care Team,
I received package #ORD-98214 yesterday afternoon containing the 16-piece Artisanal Porcelain Dinnerware Set that I purchased as an anniversary gift. While the outer cardboard parcel was intact, three ceramic dinner plates inside the presentation box were shattered upon opening, likely due to insufficient bubble padding.

As the anniversary celebration takes place this coming Saturday, September 14, I would prefer an expedited replacement rather than a store credit. I have uploaded high-resolution photographs of the damaged items and the shipping barcode via your customer portal. Could you please confirm if a replacement parcel can be dispatched via overnight courier?

Thank you,
Rebecca Sterling`,
    questionText: 'Part 7: What step has Ms. Sterling already taken?',
    options: [
      'A. Uploaded photos of the damaged plates and shipping barcode',
      'B. Returned the remaining unbroken plates to the local post office',
      'C. Contacted her credit card issuer to dispute the charge',
      'D. Purchased an alternative gift from a department store'
    ],
    correctAnswer: 'A',
    explanation: 'Bà Sterling cho biết: "I have uploaded high-resolution photographs of the damaged items and the shipping barcode via your customer portal".',
    vietnameseTranslation: 'Bà Sterling đã thực hiện bước nào? (A) Tải lên ảnh chụp các đĩa bị vỡ và mã vạch vận chuyển.',
    keyVocabulary: [
      { word: 'Barcode', ipa: '/ˈbɑː.kəʊd/', meaning: 'Mã vạch' }
    ]
  },

  // --- GROUP P7_7 (3 questions - Solar Microgrid Press Release) ---
  {
    id: 'toeic_p7_17',
    part: 'part7_reading',
    skill: 'reading',
    difficulty: 'medium',
    estimatedDifficulty: 630,
    topic: 'Clean Energy & Regional Economic Growth',
    subSkill: 'main_idea',
    questionType: 'main_idea',
    groupId: 'toeic_grp_p7_7',
    passageId: 'toeic_grp_p7_7',
    vocabularyTags: ['microgrid', 'utility-scale', 'photovoltaic'],
    grammarTags: ['present_perfect'],
    passage: `AUSTIN BUSINESS CHRONICLE
SOLARIS ENERGY BREAKS GROUND ON REGIONAL MICROGRID IN CENTRAL TEXAS
By Marcus Vance | July 19

AUSTIN — Solaris Energy announced yesterday that it has commenced construction on a $45-million utility-scale solar microgrid in Williamson County. Designed to supply clean electricity to over 18,000 households, the facility integrates 60,000 photovoltaic solar modules with a high-capacity lithium-iron phosphate battery storage system.

According to Chief Technology Officer Dr. Elena Navarro, the microgrid is engineered to insulate critical local infrastructure, including regional hospitals and water treatment plants, from power grid disruptions during severe weather events. The initiative received a $12-million infrastructure subsidy from the federal Department of Energy and is projected to create 140 construction jobs over the next fourteen months. Solaris expects commercial commissioning of the facility to conclude by November of next year.`,
    questionText: 'Part 7: What is the main subject of the news article?',
    options: [
      'A. A lawsuit over municipal water treatment fees',
      'B. Closure of an outdated coal power plant in Austin',
      'C. Groundbreaking of a major solar microgrid project in Central Texas',
      'D. Layoffs among electrical engineering personnel'
    ],
    correctAnswer: 'C',
    explanation: 'Tiêu đề và đoạn 1 nêu rõ: "Solaris Energy announced yesterday that it has commenced construction on a $45-million utility-scale solar microgrid in Williamson County".',
    vietnameseTranslation: 'Chủ đề chính của bài báo là gì? (C) Khởi công dự án lưới điện vi mô năng lượng mặt trời lớn tại Trung tâm Texas.',
    keyVocabulary: [
      { word: 'Groundbreaking', ipa: '/ˈɡraʊndˌbreɪ.kɪŋ/', meaning: 'Khởi công xây dựng' }
    ]
  },
  {
    id: 'toeic_p7_18',
    part: 'part7_reading',
    skill: 'reading',
    difficulty: 'medium',
    estimatedDifficulty: 640,
    topic: 'Clean Energy & Regional Economic Growth',
    subSkill: 'detail',
    questionType: 'detail',
    groupId: 'toeic_grp_p7_7',
    passageId: 'toeic_grp_p7_7',
    vocabularyTags: ['insulate', 'infrastructure', 'disruptions'],
    grammarTags: ['infinitive_purpose'],
    passage: `AUSTIN BUSINESS CHRONICLE
SOLARIS ENERGY BREAKS GROUND ON REGIONAL MICROGRID IN CENTRAL TEXAS
By Marcus Vance | July 19

AUSTIN — Solaris Energy announced yesterday that it has commenced construction on a $45-million utility-scale solar microgrid in Williamson County. Designed to supply clean electricity to over 18,000 households, the facility integrates 60,000 photovoltaic solar modules with a high-capacity lithium-iron phosphate battery storage system.

According to Chief Technology Officer Dr. Elena Navarro, the microgrid is engineered to insulate critical local infrastructure, including regional hospitals and water treatment plants, from power grid disruptions during severe weather events. The initiative received a $12-million infrastructure subsidy from the federal Department of Energy and is projected to create 140 construction jobs over the next fourteen months. Solaris expects commercial commissioning of the facility to conclude by November of next year.`,
    questionText: 'Part 7: According to Dr. Navarro, how will the microgrid assist local infrastructure?',
    options: [
      'A. By lowering monthly hospital prescription drug costs',
      'B. By protecting critical facilities from electrical grid outages',
      'C. By purifying municipal wastewater using solar ultraviolet lights',
      'D. By eliminating all electric utility fees for county residents'
    ],
    correctAnswer: 'B',
    explanation: 'Tiến sĩ Navarro giải thích: "...the microgrid is engineered to insulate critical local infrastructure, including regional hospitals and water treatment plants, from power grid disruptions during severe weather events".',
    vietnameseTranslation: 'Theo Tiến sĩ Navarro, lưới điện vi mô hỗ trợ hạ tầng địa phương như thế nào? (B) Bảo vệ các cơ sở quan trọng khỏi sự cố mất điện.',
    keyVocabulary: [
      { word: 'Insulate', ipa: '/ˈɪn.sjə.leɪt/', meaning: 'Bảo vệ, cách ly khỏi tác động xấu' }
    ]
  },
  {
    id: 'toeic_p7_19',
    part: 'part7_reading',
    skill: 'reading',
    difficulty: 'medium',
    estimatedDifficulty: 650,
    topic: 'Clean Energy & Regional Economic Growth',
    subSkill: 'detail',
    questionType: 'detail',
    groupId: 'toeic_grp_p7_7',
    passageId: 'toeic_grp_p7_7',
    vocabularyTags: ['subsidy', 'grant', 'funding'],
    grammarTags: ['passive_voice'],
    passage: `AUSTIN BUSINESS CHRONICLE
SOLARIS ENERGY BREAKS GROUND ON REGIONAL MICROGRID IN CENTRAL TEXAS
By Marcus Vance | July 19

AUSTIN — Solaris Energy announced yesterday that it has commenced construction on a $45-million utility-scale solar microgrid in Williamson County. Designed to supply clean electricity to over 18,000 households, the facility integrates 60,000 photovoltaic solar modules with a high-capacity lithium-iron phosphate battery storage system.

According to Chief Technology Officer Dr. Elena Navarro, the microgrid is engineered to insulate critical local infrastructure, including regional hospitals and water treatment plants, from power grid disruptions during severe weather events. The initiative received a $12-million infrastructure subsidy from the federal Department of Energy and is projected to create 140 construction jobs over the next fourteen months. Solaris expects commercial commissioning of the facility to conclude by November of next year.`,
    questionText: 'Part 7: What does the article state about project financing?',
    options: [
      'A. Funding was provided entirely by foreign private investors',
      'B. Local residents approved a property tax increase',
      'C. Construction costs doubled due to lithium battery shortages',
      'D. It secured a $12-million federal infrastructure subsidy'
    ],
    correctAnswer: 'D',
    explanation: 'Bài viết cho biết: "The initiative received a $12-million infrastructure subsidy from the federal Department of Energy...".',
    vietnameseTranslation: 'Bài viết nêu điều gì về tài chính của dự án? (D) Dự án nhận được khoản trợ cấp hạ tầng 12 triệu USD từ chính phủ liên bang.',
    keyVocabulary: [
      { word: 'Subsidy', ipa: '/ˈsʌb.sɪ.di/', meaning: 'Khoản tiền trợ cấp' }
    ]
  },

  // --- GROUP P7_8 (3 questions - Leadership Workshop Double Passage) ---
  {
    id: 'toeic_p7_20',
    part: 'part7_reading',
    skill: 'reading',
    difficulty: 'hard',
    estimatedDifficulty: 720,
    topic: 'Professional Development & Training Feedback',
    subSkill: 'cross_document_detail',
    questionType: 'specific_detail',
    groupId: 'toeic_grp_p7_8',
    passageId: 'toeic_grp_p7_8',
    vocabularyTags: ['cross-functional', 'bottlenecks', 'agile'],
    grammarTags: ['participial_focusing'],
    passage: `[DOCUMENT 1: WORKSHOP BROCHURE]
EXCEL EXECUTIVE INSTITUTE: FALL PROFESSIONAL SEMINAR SERIES
Location: Grand Hyatt Regency, Chicago, IL
Date: Thursday, October 24

Session Tracks:
- Track A (9:00 AM – 11:30 AM): "Cross-Functional Agile Leadership" — Facilitated by Dr. Warren Hayes, author of Team Dynamics 3.0. Focuses on resolving interdepartmental bottlenecks.
- Track B (1:00 PM – 3:30 PM): "Financial Analytics for Non-Financial Managers" — Facilitated by Ms. Cynthia Morales, former CFO of Zenith Global. Emphasizes variance analysis and cash-flow forecasting.
- Track C (4:00 PM – 5:30 PM): "Executive Negotiation & Strategic Influence" — Interactive workshop with case studies.

Enrollment Fees: $350 per single session, or $850 for an all-day comprehensive pass (includes networking luncheon). Early registration discount of 10% applies to bookings finalized before October 1.

---
[DOCUMENT 2: FOLLOW-UP EMAIL]
From: Derek Lawson <d.lawson@nexustech.com>
To: Training Director <inquiries@excelexec.org>
Date: October 28
Subject: Feedback on October 24 Seminar Attendance

Dear Excel Executive Institute,
I attended the full-day seminar in Chicago last Thursday under my firm’s professional development sponsorship. I found Ms. Cynthia Morales’ afternoon session on financial cash-flow modeling exceptionally valuable and immediately applicable to our quarterly budget reviews. 

However, I wanted to inquire regarding the continuing professional education (CPE) credits promised in the seminar syllabus. Our accounting department requires the formal digital certificate of completion before they can authorize reimbursement for my $850 registration fee. Could you please email this document to my attention at your earliest convenience?

Sincerely,
Derek Lawson
Senior Operations Lead, Nexus Technologies`,
    questionText: 'Part 7: According to Document 1, what is the focus of Track A?',
    options: [
      'A. Conducting international corporate tax audits',
      'B. Resolving cross-functional agile leadership bottlenecks',
      'C. Designing enterprise software databases',
      'D. Negotiating commercial office lease agreements'
    ],
    correctAnswer: 'B',
    explanation: 'Tài liệu 1 nêu về Track A: "Cross-Functional Agile Leadership... Focuses on resolving interdepartmental bottlenecks".',
    vietnameseTranslation: 'Theo Tài liệu 1, trọng tâm của Track A là gì? (B) Giải quyết các điểm nghẽn trong lãnh đạo linh hoạt liên phòng ban.',
    keyVocabulary: [
      { word: 'Bottlenecks', ipa: '/ˈbɒt.əl.neks/', meaning: 'Các điểm nghẽn, ách tắc' }
    ]
  },
  {
    id: 'toeic_p7_21',
    part: 'part7_reading',
    skill: 'reading',
    difficulty: 'hard',
    estimatedDifficulty: 730,
    topic: 'Professional Development & Training Feedback',
    subSkill: 'cross_document_relationship',
    questionType: 'specific_detail',
    groupId: 'toeic_grp_p7_8',
    passageId: 'toeic_grp_p7_8',
    vocabularyTags: ['facilitated', 'cash-flow', 'forecasting'],
    grammarTags: ['relative_clause'],
    passage: `[DOCUMENT 1: WORKSHOP BROCHURE]
EXCEL EXECUTIVE INSTITUTE: FALL PROFESSIONAL SEMINAR SERIES
Location: Grand Hyatt Regency, Chicago, IL
Date: Thursday, October 24

Session Tracks:
- Track A (9:00 AM – 11:30 AM): "Cross-Functional Agile Leadership" — Facilitated by Dr. Warren Hayes, author of Team Dynamics 3.0. Focuses on resolving interdepartmental bottlenecks.
- Track B (1:00 PM – 3:30 PM): "Financial Analytics for Non-Financial Managers" — Facilitated by Ms. Cynthia Morales, former CFO of Zenith Global. Emphasizes variance analysis and cash-flow forecasting.
- Track C (4:00 PM – 5:30 PM): "Executive Negotiation & Strategic Influence" — Interactive workshop with case studies.

Enrollment Fees: $350 per single session, or $850 for an all-day comprehensive pass (includes networking luncheon). Early registration discount of 10% applies to bookings finalized before October 1.

---
[DOCUMENT 2: FOLLOW-UP EMAIL]
From: Derek Lawson <d.lawson@nexustech.com>
To: Training Director <inquiries@excelexec.org>
Date: October 28
Subject: Feedback on October 24 Seminar Attendance

Dear Excel Executive Institute,
I attended the full-day seminar in Chicago last Thursday under my firm’s professional development sponsorship. I found Ms. Cynthia Morales’ afternoon session on financial cash-flow modeling exceptionally valuable and immediately applicable to our quarterly budget reviews. 

However, I wanted to inquire regarding the continuing professional education (CPE) credits promised in the seminar syllabus. Our accounting department requires the formal digital certificate of completion before they can authorize reimbursement for my $850 registration fee. Could you please email this document to my attention at your earliest convenience?

Sincerely,
Derek Lawson
Senior Operations Lead, Nexus Technologies`,
    questionText: 'Part 7: Which session in the brochure did Mr. Lawson attend in the afternoon?',
    options: [
      'A. Track B, facilitated by Ms. Cynthia Morales',
      'B. Track A, facilitated by Dr. Warren Hayes',
      'C. Track C, focusing on strategic negotiations',
      'D. The early morning keynote address'
    ],
    correctAnswer: 'A',
    explanation: 'Tài liệu 2 ông Lawson viết: "I found Ms. Cynthia Morales’ afternoon session on financial cash-flow modeling exceptionally valuable...", đối chiếu Tài liệu 1 đó chính là Track B (1:00 PM - 3:30 PM).',
    vietnameseTranslation: 'Ông Lawson đã tham dự phiên nào trong tài liệu vào buổi chiều? (A) Track B do bà Cynthia Morales điều phối.',
    keyVocabulary: [
      { word: 'Facilitated', ipa: '/fəˈsɪl.ɪ.teɪ.tɪd/', meaning: 'Do người nào chủ trì / điều phối' }
    ]
  },
  {
    id: 'toeic_p7_22',
    part: 'part7_reading',
    skill: 'reading',
    difficulty: 'hard',
    estimatedDifficulty: 740,
    topic: 'Professional Development & Training Feedback',
    subSkill: 'cross_document_inference',
    questionType: 'inference_author',
    groupId: 'toeic_grp_p7_8',
    passageId: 'toeic_grp_p7_8',
    vocabularyTags: ['reimbursement', 'certificate', 'registration'],
    grammarTags: ['temporal_conjunction_before'],
    passage: `[DOCUMENT 1: WORKSHOP BROCHURE]
EXCEL EXECUTIVE INSTITUTE: FALL PROFESSIONAL SEMINAR SERIES
Location: Grand Hyatt Regency, Chicago, IL
Date: Thursday, October 24

Session Tracks:
- Track A (9:00 AM – 11:30 AM): "Cross-Functional Agile Leadership" — Facilitated by Dr. Warren Hayes, author of Team Dynamics 3.0. Focuses on resolving interdepartmental bottlenecks.
- Track B (1:00 PM – 3:30 PM): "Financial Analytics for Non-Financial Managers" — Facilitated by Ms. Cynthia Morales, former CFO of Zenith Global. Emphasizes variance analysis and cash-flow forecasting.
- Track C (4:00 PM – 5:30 PM): "Executive Negotiation & Strategic Influence" — Interactive workshop with case studies.

Enrollment Fees: $350 per single session, or $850 for an all-day comprehensive pass (includes networking luncheon). Early registration discount of 10% applies to bookings finalized before October 1.

---
[DOCUMENT 2: FOLLOW-UP EMAIL]
From: Derek Lawson <d.lawson@nexustech.com>
To: Training Director <inquiries@excelexec.org>
Date: October 28
Subject: Feedback on October 24 Seminar Attendance

Dear Excel Executive Institute,
I attended the full-day seminar in Chicago last Thursday under my firm’s professional development sponsorship. I found Ms. Cynthia Morales’ afternoon session on financial cash-flow modeling exceptionally valuable and immediately applicable to our quarterly budget reviews. 

However, I wanted to inquire regarding the continuing professional education (CPE) credits promised in the seminar syllabus. Our accounting department requires the formal digital certificate of completion before they can authorize reimbursement for my $850 registration fee. Could you please email this document to my attention at your earliest convenience?

Sincerely,
Derek Lawson
Senior Operations Lead, Nexus Technologies`,
    questionText: 'Part 7: Why does Mr. Lawson urgently request the digital certificate of completion?',
    options: [
      'A. To qualify for a promotion to Vice President',
      'B. To satisfy the requirements of a Chicago law firm',
      'C. To obtain corporate reimbursement for his $850 registration fee',
      'D. To present a research paper at the next annual conference'
    ],
    correctAnswer: 'C',
    explanation: 'Ông Lawson nêu rõ: "Our accounting department requires the formal digital certificate of completion before they can authorize reimbursement for my $850 registration fee".',
    vietnameseTranslation: 'Tại sao ông Lawson khẩn trương yêu cầu chứng chỉ hoàn thành khóa học? (C) Để được công ty hoàn trả khoản phí đăng ký 850 USD.',
    keyVocabulary: [
      { word: 'Reimbursement', ipa: '/ˌriː.ɪmˈbɜːs.mənt/', meaning: 'Khoản tiền hoàn trả' }
    ]
  },

  // --- GROUP P7_9 (3 questions - Architecture Zoning Double Passage) ---
  {
    id: 'toeic_p7_23',
    part: 'part7_reading',
    skill: 'reading',
    difficulty: 'hard',
    estimatedDifficulty: 770,
    topic: 'Urban Planning & Commercial Architecture',
    subSkill: 'detail',
    questionType: 'specific_detail',
    groupId: 'toeic_grp_p7_9',
    passageId: 'toeic_grp_p7_9',
    vocabularyTags: ['variance', 'height', 'zoning'],
    grammarTags: ['participial_exceeding'],
    passage: `[DOCUMENT 1: ARCHITECTURAL DESIGN SUMMARY]
Project: The Meridian Commercial Plaza
Architectural Firm: Foster & Sterling Architects
Client: Vanguard Real Estate Holdings
Submission Date: March 15

Design Specifications:
- Structure: 18-story mixed-use commercial tower containing 280,000 square feet of Class-A office space and ground-level retail boutiques.
- Sustainability: Targeting LEED Platinum certification featuring high-efficiency triple-glazed glass facade, rooftop photovoltaic solar arrays, and rainwater harvesting cisterns.
- Parking: Two-level underground garage accommodating 320 electric-vehicle charging bays.
- Height Variance Request: Project height is 245 feet, exceeding the standard downtown commercial zone ceiling of 220 feet by 25 feet.

---
[DOCUMENT 2: REGULATORY RESPONSE LETTER]
CITY OF METROPOLIS ZONING & PLANNING COMMISSION
Date: April 10
To: Julian Foster, Foster & Sterling Architects
Subject: Conditional Approval for The Meridian Plaza (Application #ZP-2027-88)

Dear Mr. Foster,
The Metropolis Zoning Commission convened on April 8 to review your design proposal for The Meridian Plaza. We are pleased to inform you that your request for a 25-foot height variance has been conditionally approved, subject to the following statutory stipulations:

1. Pedestrian Access: The developer must dedicate a 30-foot public setback along the western perimeter to create a landscaped pedestrian promenade connecting to the riverfront park.
2. Construction Timeline: Heavy foundation drilling must be restricted to the hours of 8:00 AM through 5:00 PM on weekdays to mitigate noise disturbance for nearby residential condominiums.
3. Final Environmental Review: The Department of Water Management must inspect and certify the stormwater cistern blueprints prior to building permit issuance.

Respectfully submitted,
Margaret Thornton
Chairperson, Metropolis Zoning Board`,
    questionText: 'Part 7: In Document 1, what exception did Foster & Sterling Architects request?',
    options: [
      'A. Permission to eliminate all electric vehicle charging bays',
      'B. A reduction in required emergency staircase widths',
      'C. A 25-foot building height variance exceeding standard zoning limits',
      'D. An exemption from federal rainwater drainage codes'
    ],
    correctAnswer: 'C',
    explanation: 'Tài liệu 1 mục Height Variance Request ghi rõ: "Project height is 245 feet, exceeding the standard downtown commercial zone ceiling of 220 feet by 25 feet".',
    vietnameseTranslation: 'Trong Tài liệu 1, công ty kiến trúc Foster & Sterling đã yêu cầu ngoại lệ gì? (C) Ngoại lệ về chiều cao tòa nhà vượt mức quy chuẩn 25 feet.',
    keyVocabulary: [
      { word: 'Variance', ipa: '/ˈveə.ri.əns/', meaning: 'Sự chuẩn y ngoại lệ (trong quy hoạch đô thị)' }
    ]
  },
  {
    id: 'toeic_p7_24',
    part: 'part7_reading',
    skill: 'reading',
    difficulty: 'hard',
    estimatedDifficulty: 780,
    topic: 'Urban Planning & Commercial Architecture',
    subSkill: 'detail',
    questionType: 'specific_detail',
    groupId: 'toeic_grp_p7_9',
    passageId: 'toeic_grp_p7_9',
    vocabularyTags: ['promenade', 'pedestrian', 'stipulations'],
    grammarTags: ['modal_must'],
    passage: `[DOCUMENT 1: ARCHITECTURAL DESIGN SUMMARY]
Project: The Meridian Commercial Plaza
Architectural Firm: Foster & Sterling Architects
Client: Vanguard Real Estate Holdings
Submission Date: March 15

Design Specifications:
- Structure: 18-story mixed-use commercial tower containing 280,000 square feet of Class-A office space and ground-level retail boutiques.
- Sustainability: Targeting LEED Platinum certification featuring high-efficiency triple-glazed glass facade, rooftop photovoltaic solar arrays, and rainwater harvesting cisterns.
- Parking: Two-level underground garage accommodating 320 electric-vehicle charging bays.
- Height Variance Request: Project height is 245 feet, exceeding the standard downtown commercial zone ceiling of 220 feet by 25 feet.

---
[DOCUMENT 2: REGULATORY RESPONSE LETTER]
CITY OF METROPOLIS ZONING & PLANNING COMMISSION
Date: April 10
To: Julian Foster, Foster & Sterling Architects
Subject: Conditional Approval for The Meridian Plaza (Application #ZP-2027-88)

Dear Mr. Foster,
The Metropolis Zoning Commission convened on April 8 to review your design proposal for The Meridian Plaza. We are pleased to inform you that your request for a 25-foot height variance has been conditionally approved, subject to the following statutory stipulations:

1. Pedestrian Access: The developer must dedicate a 30-foot public setback along the western perimeter to create a landscaped pedestrian promenade connecting to the riverfront park.
2. Construction Timeline: Heavy foundation drilling must be restricted to the hours of 8:00 AM through 5:00 PM on weekdays to mitigate noise disturbance for nearby residential condominiums.
3. Final Environmental Review: The Department of Water Management must inspect and certify the stormwater cistern blueprints prior to building permit issuance.

Respectfully submitted,
Margaret Thornton
Chairperson, Metropolis Zoning Board`,
    questionText: 'Part 7: What must Vanguard Real Estate provide according to Stipulation 1 of the letter?',
    options: [
      'A. A 30-foot public setback for a landscaped pedestrian promenade',
      'B. Soundproof windows for all adjacent condominium residents',
      'C. A free underground shuttle connecting to downtown hotels',
      'D. Financial donations to the municipal public library'
    ],
    correctAnswer: 'A',
    explanation: 'Tài liệu 2 Điều 1 ghi: "Pedestrian Access: The developer must dedicate a 30-foot public setback along the western perimeter to create a landscaped pedestrian promenade...".',
    vietnameseTranslation: 'Theo Điều kiện 1 trong thư, chủ đầu tư phải cung cấp điều gì? (A) Khoảng lùi 30 feet cho lối đi dạo bộ có cảnh quan dành cho công chúng.',
    keyVocabulary: [
      { word: 'Promenade', ipa: '/ˌprɒm.əˈnɑːd/', meaning: 'Đường đi dạo dải bộ hành' }
    ]
  },
  {
    id: 'toeic_p7_25',
    part: 'part7_reading',
    skill: 'reading',
    difficulty: 'hard',
    estimatedDifficulty: 790,
    topic: 'Urban Planning & Commercial Architecture',
    subSkill: 'cross_document_inference',
    questionType: 'cross_document_inference',
    groupId: 'toeic_grp_p7_9',
    passageId: 'toeic_grp_p7_9',
    vocabularyTags: ['water_management', 'cistern', 'blueprints'],
    grammarTags: ['prepositional_prior_to'],
    passage: `[DOCUMENT 1: ARCHITECTURAL DESIGN SUMMARY]
Project: The Meridian Commercial Plaza
Architectural Firm: Foster & Sterling Architects
Client: Vanguard Real Estate Holdings
Submission Date: March 15

Design Specifications:
- Structure: 18-story mixed-use commercial tower containing 280,000 square feet of Class-A office space and ground-level retail boutiques.
- Sustainability: Targeting LEED Platinum certification featuring high-efficiency triple-glazed glass facade, rooftop photovoltaic solar arrays, and rainwater harvesting cisterns.
- Parking: Two-level underground garage accommodating 320 electric-vehicle charging bays.
- Height Variance Request: Project height is 245 feet, exceeding the standard downtown commercial zone ceiling of 220 feet by 25 feet.

---
[DOCUMENT 2: REGULATORY RESPONSE LETTER]
CITY OF METROPOLIS ZONING & PLANNING COMMISSION
Date: April 10
To: Julian Foster, Foster & Sterling Architects
Subject: Conditional Approval for The Meridian Plaza (Application #ZP-2027-88)

Dear Mr. Foster,
The Metropolis Zoning Commission convened on April 8 to review your design proposal for The Meridian Plaza. We are pleased to inform you that your request for a 25-foot height variance has been conditionally approved, subject to the following statutory stipulations:

1. Pedestrian Access: The developer must dedicate a 30-foot public setback along the western perimeter to create a landscaped pedestrian promenade connecting to the riverfront park.
2. Construction Timeline: Heavy foundation drilling must be restricted to the hours of 8:00 AM through 5:00 PM on weekdays to mitigate noise disturbance for nearby residential condominiums.
3. Final Environmental Review: The Department of Water Management must inspect and certify the stormwater cistern blueprints prior to building permit issuance.

Respectfully submitted,
Margaret Thornton
Chairperson, Metropolis Zoning Board`,
    questionText: 'Part 7: Which municipal authority must review the stormwater cistern blueprints before a permit is granted?',
    options: [
      'A. The City Fire and Rescue Battalion',
      'B. The Historic Preservation Society',
      'C. The Highway Traffic Control Bureau',
      'D. The Department of Water Management'
    ],
    correctAnswer: 'D',
    explanation: 'Tài liệu 2 Điều 3 nêu rõ: "The Department of Water Management must inspect and certify the stormwater cistern blueprints prior to building permit issuance".',
    vietnameseTranslation: 'Cơ quan thành phố nào phải thẩm định bản thiết kế bể chứa nước mưa trước khi cấp giấy phép? (D) Sở Quản lý Nguồn nước (Department of Water Management).',
    keyVocabulary: [
      { word: 'Blueprints', ipa: '/ˈbluː.prɪnts/', meaning: 'Bản vẽ thiết kế kỹ thuật' }
    ]
  },

  // ===========================================================================
  // SPEAKING PART (TOEIC 4 SKILLS - 4 TASKS)
  // ===========================================================================
  {
    id: 'toeic_sp_1',
    part: 'speaking_read',
    skill: 'speaking',
    difficulty: 'medium',
    topic: 'Company Overview & Orientation',
    subSkill: 'pronunciation_intonation',
    questionType: 'speaking_read_aloud',
    vocabularyTags: ['financial', 'portfolio', 'analysts'],
    grammarTags: ['imperative_polite'],
    estimatedDifficulty: 500,
    questionText: 'Task 1 (Read a text aloud): Nhấn Micro và đọc to đoạn văn bản công sở sau với ngữ điệu và phát âm chuẩn xác.',
    passage: 'Good morning and welcome to Apex Financial Group. Before we begin our tour of the new trading floor, please make sure your visitor badges are visible at all times. If you have any questions regarding our investment portfolio, feel free to ask our analysts during the Q&A session at noon.',
    explanation: 'Tiêu chí đánh giá: Phát âm IPA chuẩn các từ vựng học thuật (Financial, Portfolio, Analysts), ngắt nghỉ đúng cụm ngữ nghĩa và ngữ điệu tự nhiên.',
    vietnameseTranslation: 'Chào buổi sáng và chào mừng quý vị đến với Tập đoàn Tài chính Apex. Trước khi bắt đầu chuyến tham quan sàn giao dịch mới, vui lòng đảm bảo thẻ khách của quý vị luôn được đeo rõ ràng...',
    keyVocabulary: [
      { word: 'Financial', ipa: '/faɪˈnæn.ʃəl/', meaning: 'Thuộc về tài chính' },
      { word: 'Portfolio', ipa: '/ˌpɔːtˈfəʊ.li.əʊ/', meaning: 'Danh mục đầu tư' }
    ],
    evaluationCriteria: {
      pronunciationWeight: 0.4,
      fluencyWeight: 0.3,
      taskCompletionWeight: 0.3,
      targetLengthWords: { min: 30, max: 60 },
      rubricNotes: 'Đánh giá phát âm chuẩn xác trọng âm, ngữ điệu lên xuống tự nhiên.'
    }
  },
  {
    id: 'toeic_sp_2',
    part: 'speaking_read',
    skill: 'speaking',
    difficulty: 'hard',
    topic: 'Remote Working & Productivity',
    subSkill: 'opinion_argumentation',
    questionType: 'speaking_express_opinion',
    vocabularyTags: ['productivity', 'flexibility', 'advantage'],
    grammarTags: ['opinion_connectors'],
    estimatedDifficulty: 700,
    questionText: 'Task 2 (Express an opinion): Nhấn Micro và phát biểu quan điểm của bạn (khoảng 30 - 45 giây) về lợi ích của việc làm việc từ xa (remote working) đối với năng suất nhân viên.',
    passage: 'Topic: In your opinion, what is the greatest advantage of remote working for modern companies? State your opinion and provide at least two supporting reasons with examples.',
    explanation: 'Tiêu chí đánh giá: Trình bày quan điểm mạch lạc (Stance), đưa ra 2 luận cứ hỗ trợ rõ ràng (Reasons & Examples), từ vựng phong phú và tốc độ nói trôi chảy.',
    vietnameseTranslation: 'Chủ đề: Theo bạn, lợi thế lớn nhất của làm việc từ xa đối với các công ty hiện đại là gì? Hãy nêu quan điểm và đưa ra ít nhất hai lý do hỗ trợ kèm ví dụ.',
    keyVocabulary: [
      { word: 'Productivity', ipa: '/ˌprɒd.ʌkˈtɪv.ə.ti/', meaning: 'Năng suất lao động' },
      { word: 'Flexibility', ipa: '/ˌflek.səˈbɪl.ə.ti/', meaning: 'Sự linh hoạt trong công việc' }
    ],
    evaluationCriteria: {
      pronunciationWeight: 0.3,
      fluencyWeight: 0.3,
      grammarWeight: 0.2,
      vocabularyWeight: 0.2,
      targetLengthWords: { min: 40, max: 80 },
      rubricNotes: 'Đánh giá cấu trúc luận điểm (Point-Reason-Example) và độ trôi chảy.'
    }
  },
  {
    id: 'toeic_sp_3',
    part: 'speaking_read',
    skill: 'speaking',
    difficulty: 'easy',
    topic: 'Customer Store Announcement',
    subSkill: 'pronunciation_clarity',
    questionType: 'speaking_read_aloud',
    vocabularyTags: ['shoppers', 'clearance', 'register'],
    grammarTags: ['imperative_polite'],
    estimatedDifficulty: 420,
    questionText: 'Task 3 (Read a text aloud): Nhấn Micro và đọc to đoạn thông báo cửa hàng bách hóa sau.',
    passage: 'Attention valued shoppers. For the next two hours only, all seasonal clothing and home electronics on the third floor are eligible for an additional twenty percent clearance discount. Please take your selected items to any main checkout counter to claim your savings.',
    explanation: 'Tiêu chí đánh giá: Giọng đọc to, rõ ràng, ngắt nghỉ đúng nhịp ở các vế câu ngắn, phát âm chuẩn các số từ và cụm danh từ.',
    vietnameseTranslation: 'Xin quý khách chú ý. Chỉ trong hai giờ tới, tất cả quần áo theo mùa và thiết bị điện tử gia dụng tại tầng 3 đều được giảm giá thêm 20%...',
    keyVocabulary: [
      { word: 'Clearance', ipa: '/ˈklɪə.rəns/', meaning: 'Xả hàng, thanh lý' },
      { word: 'Checkout counter', ipa: '/ˈtʃek.aʊt ˈkaʊn.tər/', meaning: 'Quầy thu ngân thanh toán' }
    ],
    evaluationCriteria: {
      pronunciationWeight: 0.4,
      fluencyWeight: 0.3,
      taskCompletionWeight: 0.3,
      targetLengthWords: { min: 30, max: 55 },
      rubricNotes: 'Đánh giá phát âm phụ âm cuối và nối âm.'
    }
  },
  {
    id: 'toeic_sp_4',
    part: 'speaking_read',
    skill: 'speaking',
    difficulty: 'hard',
    topic: 'Artificial Intelligence in Workplace',
    subSkill: 'persuasive_speaking',
    questionType: 'speaking_express_opinion',
    vocabularyTags: ['automation', 'efficiency', 'workforce'],
    grammarTags: ['modal_hypothetical'],
    estimatedDifficulty: 750,
    questionText: 'Task 4 (Express an opinion): Phát biểu quan điểm của bạn về việc các doanh nghiệp ứng dụng trí tuệ nhân tạo (AI) để tự động hóa các tác vụ văn phòng.',
    passage: 'Topic: Some managers believe automating routine administrative tasks with AI will boost overall company innovation, while others worry it diminishes employee engagement. Which perspective do you agree with, and why?',
    explanation: 'Tiêu chí đánh giá: Trình bày lập trường rõ ràng, sử dụng các từ vựng học thuật về công nghệ và quản trị doanh nghiệp, đưa ra ví dụ thực tế thuyết phục.',
    vietnameseTranslation: 'Chủ đề: Một số nhà quản lý tin rằng tự động hóa tác vụ văn phòng bằng AI sẽ thúc đẩy đổi mới, trong khi số khác lo ngại giảm gắn kết nhân viên. Bạn đồng ý với quan điểm nào?',
    keyVocabulary: [
      { word: 'Automation', ipa: '/ˌɔː.təˈmeɪ.ʃən/', meaning: 'Sự tự động hóa' },
      { word: 'Engagement', ipa: '/ɪnˈɡeɪdʒ.mənt/', meaning: 'Sự gắn kết của nhân viên' }
    ],
    evaluationCriteria: {
      pronunciationWeight: 0.3,
      fluencyWeight: 0.3,
      grammarWeight: 0.2,
      vocabularyWeight: 0.2,
      targetLengthWords: { min: 45, max: 90 },
      rubricNotes: 'Đánh giá tính thuyết phục của dẫn chứng và tính đa dạng của cấu trúc câu phức.'
    }
  },

  // ===========================================================================
  // WRITING PART (TOEIC 4 SKILLS - 4 TASKS)
  // ===========================================================================
  {
    id: 'toeic_wr_1',
    part: 'writing_email',
    skill: 'writing',
    difficulty: 'medium',
    topic: 'Customer Service & Delay Compensation',
    subSkill: 'apology_solution',
    questionType: 'writing_email_response',
    vocabularyTags: ['apologize', 'compensation', 'inconvenience'],
    grammarTags: ['email_etiquette'],
    estimatedDifficulty: 550,
    questionText: 'Task 1 (Write an email response): Viết một email ngắn (50 - 100 từ) phản hồi cho khách hàng Mr. David Miller về việc giao hàng bị chậm trễ do thời tiết và đề xuất giải pháp bồi thường thỏa đáng.',
    passage: `From: David Miller <david.miller@clientcorp.com>
Subject: Urgent: Order #89201 Delivery Delay
Dear Customer Support,
I was expecting my shipment of server components yesterday, but the tracking status still shows "In Transit". Could you please clarify when my order will arrive?
Sincerely, David Miller`,
    explanation: 'Tiêu chí chấm điểm: Cấu trúc email công sở chuẩn (Salutation, Sincere Apology, Logical Explanation, Concrete Compensation Solution, Professional Closing).',
    vietnameseTranslation: 'Viết email phản hồi khách hàng: Xin lỗi chân thành vì sự chậm trễ, giải thích nguyên nhân khách quan do bão và cam kết giao hàng vào sáng mai kèm miễn phí cước vận chuyển.',
    keyVocabulary: [
      { word: 'Apologize', ipa: '/əˈpɒl.ə.dʒaɪz/', meaning: 'Xin lỗi chân thành' },
      { word: 'Compensation', ipa: '/ˌkɒm.penˈseɪ.ʃən/', meaning: 'Sự bồi thường thỏa đáng' }
    ],
    evaluationCriteria: {
      grammarWeight: 0.3,
      vocabularyWeight: 0.3,
      taskCompletionWeight: 0.4,
      targetLengthWords: { min: 50, max: 100 },
      rubricNotes: 'Đáp ứng đủ 4 phần: Lời chào, Xin lỗi và giải thích, Phương án xử lý, Lời kết.'
    }
  },
  {
    id: 'toeic_wr_2',
    part: 'writing_email',
    skill: 'writing',
    difficulty: 'hard',
    topic: 'Training & Development Proposal',
    subSkill: 'proposal_justification',
    questionType: 'writing_opinion_essay',
    vocabularyTags: ['stakeholders', 'workshop', 'communication'],
    grammarTags: ['persuasive_formal'],
    estimatedDifficulty: 750,
    questionText: 'Task 2 (Write an opinion email): Viết một email (60 - 120 từ) gửi cho Trưởng phòng Đào tạo (Training Manager) đề xuất tổ chức một buổi workshop về kỹ năng thuyết trình bằng tiếng Anh cho các thành viên trong nhóm.',
    passage: `Context: Your department members frequently present project updates to foreign stakeholders but lack confidence in their business English communication. Write an email to propose a practical weekend workshop with specific learning goals.`,
    explanation: 'Tiêu chí chấm điểm: Đề xuất rõ ràng (Proposal Statement), giải thích lợi ích cụ thể (Benefits for the team), đưa ra khung thời gian và đề nghị phê duyệt lịch sự.',
    vietnameseTranslation: 'Bối cảnh: Các thành viên trong nhóm của bạn thường xuyên thuyết trình dự án cho các bên liên quan nước ngoài nhưng còn thiếu tự tin trong giao tiếp tiếng Anh thương mại. Hãy viết email đề xuất một buổi workshop cuối tuần.',
    keyVocabulary: [
      { word: 'Stakeholders', ipa: '/ˈsteɪkˌhəʊl.dərz/', meaning: 'Các bên liên quan, đối tác dự án' },
      { word: 'Workshop', ipa: '/ˈwɜːk.ʃɒp/', meaning: 'Hội thảo thực hành chuyên đề' }
    ],
    evaluationCriteria: {
      grammarWeight: 0.3,
      vocabularyWeight: 0.3,
      taskCompletionWeight: 0.4,
      targetLengthWords: { min: 60, max: 120 },
      rubricNotes: 'Nêu mục tiêu đào tạo cụ thể, phương pháp thực hành và kỳ vọng kết quả.'
    }
  },
  {
    id: 'toeic_wr_3',
    part: 'writing_email',
    skill: 'writing',
    difficulty: 'medium',
    topic: 'Product Defect & Replacement Request',
    subSkill: 'customer_claim',
    questionType: 'writing_email_response',
    vocabularyTags: ['replacement', 'defect', 'warranty'],
    grammarTags: ['formal_business_tone'],
    estimatedDifficulty: 580,
    questionText: 'Task 3 (Write an email): Viết email (50 - 100 từ) gửi cho nhà cung cấp thiết bị văn phòng Apex Supplies khiếu nại về 5 máy tính xách tay bị lỗi màn hình và yêu cầu đổi mới ngay trong tuần.',
    passage: `Context: Your company received a shipment of 20 laptops yesterday, but during IT setup, 5 units were found to have cracked display screens. Write an email to Apex Supplies requesting expedited replacement under the commercial guarantee.`,
    explanation: 'Tiêu chí chấm điểm: Nêu rõ mã đơn hàng và số lượng máy hỏng, mô tả sự cố chính xác, đề nghị giao bù khẩn cấp và đính kèm biên bản giao nhận.',
    vietnameseTranslation: 'Viết email khiếu nại nhà cung cấp về 5 máy tính bị nứt màn hình và yêu cầu đổi mới theo bảo hành thương mại.',
    keyVocabulary: [
      { word: 'Expedited', ipa: '/ˈek.spə.daɪ.tɪd/', meaning: 'Được xúc tiến nhanh' },
      { word: 'Guarantee', ipa: '/ˌɡær.ənˈtiː/', meaning: 'Cam kết bảo hành' }
    ],
    evaluationCriteria: {
      grammarWeight: 0.3,
      vocabularyWeight: 0.3,
      taskCompletionWeight: 0.4,
      targetLengthWords: { min: 50, max: 100 },
      rubricNotes: 'Văn phong thương mại lịch sự nhưng dứt khoát về thời hạn đổi trả.'
    }
  },
  {
    id: 'toeic_wr_4',
    part: 'writing_email',
    skill: 'writing',
    difficulty: 'hard',
    topic: 'Environmental Sustainability Policy',
    subSkill: 'proposal_argumentation',
    questionType: 'writing_opinion_essay',
    vocabularyTags: ['sustainability', 'conservation', 'initiatives'],
    grammarTags: ['formal_connectors', 'modal_recommendations'],
    estimatedDifficulty: 780,
    questionText: 'Task 4 (Write an opinion email): Viết email (70 - 130 từ) gửi cho Giám đốc Điều hành (CEO) đề xuất 2 sáng kiến xanh nhằm giảm thiểu rác thải nhựa và tiêu thụ điện năng tại văn phòng.',
    passage: `Context: Your company is aiming to qualify for a green corporate certification next year. Write an email to the CEO recommending two concrete workplace initiatives (e.g., eliminating single-use plastic bottles, automated lighting sensors) and explaining their positive financial and environmental impact.`,
    explanation: 'Tiêu chí chấm điểm: Đưa ra 2 giải pháp cụ thể có tính khả thi, phân tích lợi ích kép về môi trường và tiết kiệm ngân sách hoạt động, kết thư đề nghị một buổi họp thảo luận chi tiết.',
    vietnameseTranslation: 'Viết email gửi CEO đề xuất 2 sáng kiến xanh (như loại bỏ chai nhựa dùng một lần, lắp cảm biến đèn tự động) kèm phân tích tác động tài chính và môi trường.',
    keyVocabulary: [
      { word: 'Sustainability', ipa: '/səˌsteɪ.nəˈbɪl.ə.ti/', meaning: 'Sự phát triển bền vững' },
      { word: 'Initiatives', ipa: '/ɪˈnɪʃ.ə.tɪvz/', meaning: 'Các sáng kiến, dự án cải tiến' }
    ],
    evaluationCriteria: {
      grammarWeight: 0.3,
      vocabularyWeight: 0.3,
      taskCompletionWeight: 0.4,
      targetLengthWords: { min: 70, max: 130 },
      rubricNotes: 'Bố cục chặt chẽ gồm mở đầu, 2 luận điểm kèm lợi ích, và lời kêu gọi hành động.'
    }
  },

  // ---------------------------------------------------------------------------
  // ADDITIONAL SPEAKING TASKS (toeic_sp_5 -> toeic_sp_10: Diversity Expansion)
  // ---------------------------------------------------------------------------
  {
    id: 'toeic_sp_5',
    part: 'speaking_read',
    skill: 'speaking',
    difficulty: 'medium',
    topic: 'Corporate Project Team Meeting',
    subSkill: 'picture_description',
    questionType: 'speaking_describe_picture',
    vocabularyTags: ['presentation', 'collaboration', 'whiteboard'],
    grammarTags: ['present_continuous', 'spatial_prepositions'],
    estimatedDifficulty: 540,
    questionText: 'Task 5 (Describe a picture): Hãy quan sát ngữ cảnh phòng họp dự án và miêu tả chi tiết trong 30-45 giây (vị trí nhân vật, hoạt động chính, bầu không khí làm việc).',
    passage: 'Context: An office meeting room where a female project lead is presenting a bar chart on a digital screen while two colleagues take notes on their laptops and a third asks a question.',
    explanation: 'Tiêu chí đánh giá: Mô tả bao quát không gian (Overall setting), chi tiết hành động trung tâm (Core actions using present continuous), các chi tiết nền (Background objects) và kết luận cảm nhận chung.',
    vietnameseTranslation: 'Miêu tả bức ảnh phòng họp: Trưởng nhóm đang trình bày biểu đồ cột trên màn hình điện tử, hai đồng nghiệp ghi chép trên máy tính xách tay và một người đang giơ tay đặt câu hỏi.',
    keyVocabulary: [
      { word: 'Collaborative', ipa: '/kəˈlæb.ər.ə.tɪv/', meaning: 'Có tính hợp tác, tương tác nhóm' },
      { word: 'Presentation', ipa: '/ˌprez.ənˈteɪ.ʃən/', meaning: 'Bài thuyết trình, trình bày' }
    ],
    evaluationCriteria: {
      pronunciationWeight: 0.35,
      fluencyWeight: 0.35,
      grammarWeight: 0.15,
      vocabularyWeight: 0.15,
      targetLengthWords: { min: 40, max: 75 },
      rubricNotes: 'Ưu tiên thì hiện tại tiếp diễn, giới từ chỉ vị trí và sự liên kết mượt mà.'
    }
  },
  {
    id: 'toeic_sp_6',
    part: 'speaking_read',
    skill: 'speaking',
    difficulty: 'medium',
    topic: 'Consumer Habits Survey',
    subSkill: 'survey_response',
    questionType: 'speaking_respond_questions',
    vocabularyTags: ['convenience', 'e-commerce', 'preference'],
    grammarTags: ['past_simple', 'present_perfect', 'reason_clauses'],
    estimatedDifficulty: 580,
    questionText: 'Task 6 (Respond to questions): Trả lời cuộc khảo sát người tiêu dùng: "Bạn thường mua sắm trực tuyến hay đến trực tiếp cửa hàng, và yếu tố nào quan trọng nhất khi bạn chọn mua sản phẩm công nghệ?"',
    passage: 'Interviewer Prompt: Imagine you are participating in a telephone market research survey about consumer electronics shopping habits. Please answer both parts of the question directly with clear reasons.',
    explanation: 'Tiêu chí đánh giá: Phản hồi trực tiếp không ngập ngừng, đưa ra lý do xác đáng (ví dụ: giao hàng nhanh, xem thử sản phẩm thực tế, chính sách đổi trả).',
    vietnameseTranslation: 'Trả lời phỏng vấn khảo sát tiêu dùng: Nêu rõ xu hướng mua sắm của bạn (online hay offline), lý do lựa chọn và tiêu chí quan trọng nhất khi mua đồ công nghệ.',
    keyVocabulary: [
      { word: 'Convenience', ipa: '/kənˈviː.ni.əns/', meaning: 'Sự tiện lợi, thuận tiện' },
      { word: 'Warranty policy', ipa: '/ˈwɒr.ən.ti ˈpɒl.ə.si/', meaning: 'Chính sách bảo hành' }
    ],
    evaluationCriteria: {
      pronunciationWeight: 0.3,
      fluencyWeight: 0.3,
      grammarWeight: 0.2,
      vocabularyWeight: 0.2,
      targetLengthWords: { min: 45, max: 80 },
      rubricNotes: 'Đánh giá khả năng phản hồi trực tiếp, phát triển ý mạch lạc và từ vựng mua sắm.'
    }
  },
  {
    id: 'toeic_sp_7',
    part: 'speaking_read',
    skill: 'speaking',
    difficulty: 'medium',
    topic: 'International Tech Summit Schedule',
    subSkill: 'schedule_synthesis',
    questionType: 'speaking_respond_info',
    vocabularyTags: ['keynote', 'registration', 'session'],
    grammarTags: ['future_schedule', 'prepositional_time'],
    estimatedDifficulty: 620,
    questionText: 'Task 7 (Respond using information provided): Dựa vào lịch trình Hội nghị Công nghệ được cung cấp dưới đây, hãy trả lời câu hỏi của người tham dự về thời gian đăng ký và diễn giả bài phát biểu chính (Keynote Speech).',
    passage: `Annual Tech Innovators Summit 2026 Schedule:\n- 08:30 AM - 09:30 AM: Registration & Welcome Coffee (Lobby A)\n- 09:30 AM - 10:45 AM: Keynote Speech: "AI and Clean Energy" by Dr. Elena Rostova (Main Auditorium)\n- 11:00 AM - 12:30 PM: Panel Discussion: Cybersecurity in Cloud Computing\nParticipant Question: "Could you tell me when registration starts and who is delivering the morning keynote speech?"`,
    explanation: 'Tiêu chí đánh giá: Trích xuất thông tin chính xác từ lịch trình, sử dụng cấu trúc câu chuẩn thời gian và địa điểm mà không đọc nguyên văn rời rạc.',
    vietnameseTranslation: 'Dựa vào lịch trình: Trả lời thời gian đăng ký (8:30 sáng tại Lobby A) và diễn giả phát biểu chính (Tiến sĩ Elena Rostova lúc 9:30 sáng tại Main Auditorium).',
    keyVocabulary: [
      { word: 'Keynote speech', ipa: '/ˈkiː.nəʊt spiːtʃ/', meaning: 'Bài phát biểu chủ đạo, định hướng' },
      { word: 'Auditorium', ipa: '/ˌɔː.dɪˈtɔː.ri.əm/', meaning: 'Hội trường lớn, khán phòng' }
    ],
    evaluationCriteria: {
      pronunciationWeight: 0.3,
      fluencyWeight: 0.35,
      taskCompletionWeight: 0.35,
      targetLengthWords: { min: 40, max: 70 },
      rubricNotes: 'Đúng thời gian, địa điểm, tên diễn giả và diễn đạt tự nhiên.'
    }
  },
  {
    id: 'toeic_sp_8',
    part: 'speaking_read',
    skill: 'speaking',
    difficulty: 'hard',
    topic: 'Hybrid Work vs Full Office Presence',
    subSkill: 'opinion_argumentation',
    questionType: 'speaking_express_opinion',
    vocabularyTags: ['flexibility', 'productivity', 'cohesion'],
    grammarTags: ['contrastive_connectors', 'conditional_structures'],
    estimatedDifficulty: 760,
    questionText: 'Task 8 (Express an opinion): Bạn ủng hộ mô hình làm việc kết hợp linh hoạt (Hybrid Work) hay làm việc tập trung 100% tại văn phòng? Hãy giải thích lý do và đưa ra ví dụ cụ thể trong 60 giây.',
    passage: 'Debate Topic: Many tech corporations now mandate a 5-day in-office return policy to foster team cohesion, while other firms report higher productivity and employee retention with hybrid flexible models. What is your stance on this issue?',
    explanation: 'Tiêu chí đánh giá: Khẳng định quan điểm rõ ràng ngay câu mở đầu, đưa ra ít nhất 2 luận cứ hỗ trợ (ví dụ: cân bằng cuộc sống và năng suất, hoặc hiệu quả trao đổi trực tiếp), kết luận súc tích.',
    vietnameseTranslation: 'Trình bày quan điểm về Hybrid Work: Nêu lập trường rõ ràng, phân tích ưu điểm/nhược điểm và đưa ra ví dụ thực tế về năng suất và tinh thần làm việc.',
    keyVocabulary: [
      { word: 'Productivity', ipa: '/ˌprɒd.ʌkˈtɪv.ə.ti/', meaning: 'Năng suất làm việc' },
      { word: 'Work-life balance', ipa: '/wɜːk laɪf ˈbæl.əns/', meaning: 'Sự cân bằng công việc và cuộc sống' }
    ],
    evaluationCriteria: {
      pronunciationWeight: 0.25,
      fluencyWeight: 0.3,
      grammarWeight: 0.25,
      vocabularyWeight: 0.2,
      targetLengthWords: { min: 55, max: 100 },
      rubricNotes: 'Đánh giá tính thuyết phục của dẫn chứng, cấu trúc câu phức và vốn từ kinh doanh.'
    }
  },
  {
    id: 'toeic_sp_9',
    part: 'speaking_read',
    skill: 'speaking',
    difficulty: 'easy',
    topic: 'Airport Flight Departure Broadcast',
    subSkill: 'announcement_intonation',
    questionType: 'speaking_read_aloud',
    vocabularyTags: ['boarding', 'boarding_pass', 'gate'],
    grammarTags: ['announcement_passive', 'polite_request'],
    estimatedDifficulty: 450,
    questionText: 'Task 9 (Read a text aloud): Đọc to và chuẩn xác đoạn phát thanh thông báo lên máy bay tại sân bay quốc tế.',
    passage: 'Good afternoon, passengers on Skylink Flight 402 with non-stop service to Tokyo Narita. We are now ready to begin general boarding through Gate 14. Please have your government-issued passport and boarding pass ready for inspection by our gate agents.',
    explanation: 'Tiêu chí đánh giá: Đọc lưu loát, ngắt nhịp đúng dấu câu, phát âm chuẩn tên chuyến bay (Flight 402) và số cổng lên máy bay (Gate 14).',
    vietnameseTranslation: 'Đọc đoạn phát thanh sân bay: Kính chào quý hành khách trên chuyến bay Skylink 402 đi thẳng đến Tokyo Narita. Chúng tôi sẵn sàng mời quý khách lên máy bay qua Cửa số 14...',
    keyVocabulary: [
      { word: 'Boarding pass', ipa: '/ˈbɔː.dɪŋ ˌpɑːs/', meaning: 'Thẻ lên máy bay' },
      { word: 'Inspection', ipa: '/ɪnˈspek.ʃən/', meaning: 'Sự kiểm tra, đối chiếu' }
    ],
    evaluationCriteria: {
      pronunciationWeight: 0.45,
      fluencyWeight: 0.35,
      taskCompletionWeight: 0.2,
      targetLengthWords: { min: 35, max: 55 },
      rubricNotes: 'Kiểm tra trọng âm từ và ngữ điệu thông báo trang trọng.'
    }
  },
  {
    id: 'toeic_sp_10',
    part: 'speaking_read',
    skill: 'speaking',
    difficulty: 'medium',
    topic: 'Logistics Warehouse Operations',
    subSkill: 'workplace_description',
    questionType: 'speaking_describe_picture',
    vocabularyTags: ['warehouse', 'forklift', 'inventory'],
    grammarTags: ['passive_state', 'spatial_orientation'],
    estimatedDifficulty: 590,
    questionText: 'Task 10 (Describe a picture): Hãy quan sát ngữ cảnh kho bãi phân phối vận tải và mô tả hoạt động vận hành, sắp xếp hàng hóa trong 30-45 giây.',
    passage: 'Context: A modern distribution warehouse where two logistics technicians wearing yellow safety helmets and high-visibility vests inspect barcodes on stacked wooden pallets while an automated forklift transports boxes in the background.',
    explanation: 'Tiêu chí đánh giá: Mô tả đồ bảo hộ an toàn lao động, thao tác kiểm tra mã vạch hàng hóa trên pallet, và phương tiện vận chuyển ở hậu cảnh.',
    vietnameseTranslation: 'Miêu tả bức ảnh kho hàng: Hai kỹ thuật viên hậu cần đội mũ bảo hộ vàng và áo phản quang đang quét mã vạch trên kiện hàng gỗ, phía sau là xe nâng đang di chuyển kiện hàng.',
    keyVocabulary: [
      { word: 'Pallet', ipa: '/ˈpæl.ət/', meaning: 'Kệ kê hàng, tấm nâng hàng bằng gỗ' },
      { word: 'Inventory', ipa: '/ˈɪn.vən.tər.i/', meaning: 'Hàng tồn kho, kiểm kê hàng hóa' }
    ],
    evaluationCriteria: {
      pronunciationWeight: 0.35,
      fluencyWeight: 0.35,
      grammarWeight: 0.15,
      vocabularyWeight: 0.15,
      targetLengthWords: { min: 40, max: 75 },
      rubricNotes: 'Đánh giá từ vựng chuyên ngành kho vận và ngữ pháp miêu tả tranh.'
    }
  },
  {
    id: 'toeic_sp_11',
    part: 'speaking_read',
    skill: 'speaking',
    difficulty: 'easy',
    estimatedDifficulty: 390,
    topic: 'Public Transit Subway System',
    subSkill: 'announcement_intonation',
    questionType: 'speaking_read_aloud',
    vocabularyTags: ['commuters', 'express_track', 'shuttle_bus'],
    grammarTags: ['announcement_passive', 'polite_directive'],
    questionText: 'Task 11 (Read a text aloud): Đọc to và rõ ràng thông báo điều chỉnh tuyến tàu điện ngầm công cộng sau đây.',
    passage: 'Attention passengers on the Green Line. Due to scheduled electrical track upgrades at Central Station, all southbound express trains will terminate at Oak Ridge. Complimentary transfer shuttle buses are waiting at the street-level concourse to carry passengers to their destination.',
    explanation: 'Tiêu chí đánh giá: Phát âm chuẩn xác danh từ riêng, ngắt nghỉ đúng nhịp ở dấu câu, ngữ điệu thông báo phát thanh rõ ràng, dứt khoát.',
    vietnameseTranslation: 'Đọc to thông báo tàu điện ngầm: Xin hành khách chú ý. Do bảo trì đường ray tại Ga Trung tâm, các chuyến tàu hướng nam sẽ dừng tại Oak Ridge. Xe buýt trung chuyển miễn phí đang đợi ở sảnh tầng trệt...',
    keyVocabulary: [
      { word: 'Concourse', ipa: '/ˈkɒŋ.kɔːs/', meaning: 'Sảnh lớn đón khách' },
      { word: 'Complimentary', ipa: '/ˌkɒm.plɪˈmen.tər.i/', meaning: 'Miễn phí kèm theo' }
    ],
    evaluationCriteria: {
      pronunciationWeight: 0.45,
      fluencyWeight: 0.35,
      taskCompletionWeight: 0.2,
      targetLengthWords: { min: 35, max: 60 },
      rubricNotes: 'Ngắt giọng tự nhiên ở các mệnh đề chỉ nguyên nhân và phương án thay thế.'
    }
  },
  {
    id: 'toeic_sp_12',
    part: 'speaking_read',
    skill: 'speaking',
    difficulty: 'easy',
    estimatedDifficulty: 420,
    topic: 'Hospitality Hotel Amenities',
    subSkill: 'welcome_greeting_intonation',
    questionType: 'speaking_read_aloud',
    vocabularyTags: ['amenities', 'complimentary', 'fitness_center'],
    grammarTags: ['welcome_greeting', 'polite_invitation'],
    questionText: 'Task 12 (Read a text aloud): Đọc to lời chào mừng và giới thiệu tiện ích khách sạn trên kênh truyền hình phòng nghỉ.',
    passage: 'Welcome to the Grand Horizon Resort and Conference Center. We invite you to enjoy our complimentary breakfast buffet served on the rooftop terrace from six thirty until ten each morning. Our state-of-the-art wellness pavilion and heated indoor swimming pool are open twenty-four hours a day for registered guests.',
    explanation: 'Tiêu chí đánh giá: Giọng điệu thân thiện, ấm áp và chuyên nghiệp của ngành khách sạn, phát âm chuẩn các khung giờ và cụm danh từ tiện ích.',
    vietnameseTranslation: 'Đọc to lời chào khách sạn: Chào mừng quý khách đến Grand Horizon Resort. Kính mời quý khách thưởng thức bữa sáng buffet miễn phí trên sân thượng từ 6:30 đến 10:00 sáng. Khu thể thao và bể bơi nước ấm mở cửa 24/7...',
    keyVocabulary: [
      { word: 'Resort', ipa: '/rɪˈzɔːt/', meaning: 'Khu nghỉ dưỡng' },
      { word: 'Pavilion', ipa: '/pəˈvɪl.jən/', meaning: 'Khu gian nhà tiện ích' }
    ],
    evaluationCriteria: {
      pronunciationWeight: 0.45,
      fluencyWeight: 0.35,
      taskCompletionWeight: 0.2,
      targetLengthWords: { min: 40, max: 65 },
      rubricNotes: 'Ngữ điệu chào đón niềm nở và phát âm đúng các số từ giờ giấc.'
    }
  },
  {
    id: 'toeic_sp_13',
    part: 'speaking_read',
    skill: 'speaking',
    difficulty: 'easy',
    estimatedDifficulty: 440,
    topic: 'Corporate Dining Facilities',
    subSkill: 'cafeteria_scene_description',
    questionType: 'speaking_describe_picture',
    vocabularyTags: ['cafeteria', 'salad_bar', 'beverage_dispenser'],
    grammarTags: ['present_continuous', 'prepositional_phrases'],
    questionText: 'Task 13 (Describe a picture): Quan sát bức ảnh căng tin văn phòng và mô tả không gian, hành động của nhân viên và các quầy thực phẩm trong 30-45 giây.',
    passage: 'Context: A bright corporate cafeteria where employees are standing in line along a fresh salad bar counter, selecting fresh vegetables while a cashier rings up lunches near an automated beverage dispenser.',
    explanation: 'Tiêu chí đánh giá: Miêu tả toàn cảnh (Overall atmosphere), hành động chính của các nhân vật (chọn món, đứng chờ, tính tiền), chi tiết hậu cảnh (khay đựng, máy rót nước).',
    vietnameseTranslation: 'Miêu tả bức ảnh căng tin: Nhân viên đang xếp hàng dọc quầy salad tươi, lựa chọn món ăn trong khi thu ngân thanh toán tiền bữa trưa cạnh máy rót đồ uống tự động.',
    keyVocabulary: [
      { word: 'Cafeteria', ipa: '/ˌkæf.əˈtɪə.ri.ə/', meaning: 'Nhà ăn, căng tin tự phục vụ' },
      { word: 'Dispenser', ipa: '/dɪˈspen.sər/', meaning: 'Máy phân phối, máy rót tự động' }
    ],
    evaluationCriteria: {
      pronunciationWeight: 0.35,
      fluencyWeight: 0.35,
      grammarWeight: 0.15,
      vocabularyWeight: 0.15,
      targetLengthWords: { min: 40, max: 75 },
      rubricNotes: 'Sử dụng thì hiện tại tiếp diễn và giới từ chỉ vị trí chính xác.'
    }
  },
  {
    id: 'toeic_sp_14',
    part: 'speaking_read',
    skill: 'speaking',
    difficulty: 'easy',
    estimatedDifficulty: 450,
    topic: 'Community Media Habits',
    subSkill: 'survey_response',
    questionType: 'speaking_respond_questions',
    vocabularyTags: ['audiobooks', 'convenience', 'commute'],
    grammarTags: ['present_habits', 'reason_clauses'],
    questionText: 'Task 14 (Respond to questions): Trả lời cuộc khảo sát về thói quen đọc sách: Bạn thích nghe sách nói điện tử hay đọc sách in giấy hơn, và bạn thường dành thời gian đọc vào lúc nào?',
    passage: 'Interviewer Prompt: Imagine that you are participating in a local cultural survey about reading habits. Question: "Do you prefer listening to digital audiobooks or reading printed paperback books, and when do you usually find time to read?"',
    explanation: 'Tiêu chí đánh giá: Trả lời trực tiếp cả 2 phần của câu hỏi, đưa ra lý do rõ ràng (ví dụ: nghe sách nói khi lái xe đi làm, đọc sách giấy trước khi ngủ).',
    vietnameseTranslation: 'Trả lời câu hỏi khảo sát: Nêu sở thích giữa sách in và sách nói điện tử, giải thích lý do cụ thể và thời điểm thường đọc sách trong ngày.',
    keyVocabulary: [
      { word: 'Paperback', ipa: '/ˈpeɪ.pə.bæk/', meaning: 'Sách bìa mềm' },
      { word: 'Commute', ipa: '/kəˈmjuːt/', meaning: 'Quãng đường đi lại hàng ngày' }
    ],
    evaluationCriteria: {
      pronunciationWeight: 0.3,
      fluencyWeight: 0.35,
      grammarWeight: 0.15,
      vocabularyWeight: 0.2,
      targetLengthWords: { min: 40, max: 75 },
      rubricNotes: 'Phản hồi mạch lạc, trả lời đầy đủ cả 2 vế của câu hỏi.'
    }
  },
  {
    id: 'toeic_sp_15',
    part: 'speaking_read',
    skill: 'speaking',
    difficulty: 'medium',
    estimatedDifficulty: 540,
    topic: 'Civil Engineering & Construction',
    subSkill: 'construction_site_description',
    questionType: 'speaking_describe_picture',
    vocabularyTags: ['foreman', 'blueprints', 'scaffolding'],
    grammarTags: ['present_continuous', 'passive_construction'],
    questionText: 'Task 15 (Describe a picture): Quan sát công trường xây dựng và miêu tả chi tiết người kỹ sư, người quản đốc và các thiết bị xung quanh trong 30-45 giây.',
    passage: 'Context: A busy building construction site where a female structural engineer wearing a white hardhat unrolls large architectural blueprints on the hood of a pickup truck while discussing project specs with a site foreman pointing toward steel scaffolding.',
    explanation: 'Tiêu chí đánh giá: Miêu tả nhân vật trung tâm (kỹ sư và đốc công), hành động cụ thể (mở bản vẽ, chỉ tay về hướng giàn giáo), trang phục bảo hộ (mũ bảo hộ, áo phản quang).',
    vietnameseTranslation: 'Miêu tả bức ảnh công trường: Kỹ sư kết cấu đội mũ bảo hộ đang mở bản vẽ kiến trúc trên nắp ca-pô xe bán tải, thảo luận thông số kỹ thuật với người quản đốc đang chỉ về phía giàn giáo thép.',
    keyVocabulary: [
      { word: 'Foreman', ipa: '/ˈfɔː.mən/', meaning: 'Quản đốc, đội trưởng công trường' },
      { word: 'Scaffolding', ipa: '/ˈskæf.əl.dɪŋ/', meaning: 'Giàn giáo xây dựng' }
    ],
    evaluationCriteria: {
      pronunciationWeight: 0.35,
      fluencyWeight: 0.35,
      grammarWeight: 0.15,
      vocabularyWeight: 0.15,
      targetLengthWords: { min: 45, max: 80 },
      rubricNotes: 'Đánh giá vốn từ vựng kỹ thuật công trường và câu phức miêu tả hành động.'
    }
  },
  {
    id: 'toeic_sp_16',
    part: 'speaking_read',
    skill: 'speaking',
    difficulty: 'medium',
    estimatedDifficulty: 580,
    topic: 'Professional Development Seminar',
    subSkill: 'agenda_information_synthesis',
    questionType: 'speaking_respond_info',
    vocabularyTags: ['breakout_session', 'luncheon', 'registration'],
    grammarTags: ['schedule_present', 'modal_can'],
    questionText: 'Task 16 (Respond using information provided): Dựa vào thời khóa biểu hội thảo đào tạo, hãy trả lời câu hỏi của học viên về giờ bắt đầu phiên thảo luận nhóm và địa điểm tổ chức ăn trưa.',
    passage: `Midwest Leadership Training Seminar Timetable:\n- 09:00 AM - 10:30 AM: Executive Workshop: "Conflict Resolution" (Room 201)\n- 10:45 AM - 12:15 PM: Breakout Session: "Financial Planning for Team Leads" (Maple Hall)\n- 12:15 PM - 01:30 PM: Networking Luncheon & Certificate Pickup (Dining Lounge)\nParticipant Inquiry: "Could you tell me what time the breakout session begins and where the networking lunch will be held?"`,
    explanation: 'Tiêu chí đánh giá: Trích xuất đúng giờ bắt đầu của Breakout Session (10:45 AM tại Maple Hall) và địa điểm Networking Luncheon (Dining Lounge lúc 12:15 PM).',
    vietnameseTranslation: 'Dựa vào bảng lịch trình: Trả lời chính xác thời gian bắt đầu phiên thảo luận chuyên đề lúc 10:45 tại Maple Hall và bữa trưa kết nối tổ chức tại Dining Lounge lúc 12:15.',
    keyVocabulary: [
      { word: 'Breakout session', ipa: '/ˈbreɪk.aʊt ˈseʃ.ən/', meaning: 'Phiên thảo luận nhóm nhỏ chuyên đề' },
      { word: 'Luncheon', ipa: '/ˈlʌn.tʃən/', meaning: 'Bữa tiệc trưa trang trọng' }
    ],
    evaluationCriteria: {
      pronunciationWeight: 0.3,
      fluencyWeight: 0.35,
      taskCompletionWeight: 0.35,
      targetLengthWords: { min: 40, max: 70 },
      rubricNotes: 'Trả lời đúng thông tin, diễn đạt câu hoàn chỉnh trôi chảy.'
    }
  },
  {
    id: 'toeic_sp_17',
    part: 'speaking_read',
    skill: 'speaking',
    difficulty: 'medium',
    estimatedDifficulty: 610,
    topic: 'Financial Services & Banking',
    subSkill: 'consumer_preference_response',
    questionType: 'speaking_respond_questions',
    vocabularyTags: ['mobile_banking', 'teller', 'transactions'],
    grammarTags: ['present_simple', 'comparison_structures'],
    questionText: 'Task 17 (Respond to questions): Trả lời phỏng vấn nghiên cứu ngân hàng: Bạn thường đến phòng giao dịch ngân hàng trực tiếp với tần suất thế nào so với dùng ứng dụng di động, và lý do tại sao?'
,
    passage: 'Interviewer Prompt: Imagine that you are being interviewed for a commercial banking study. Question: "How often do you visit a physical bank branch compared to using mobile banking applications, and why?"',
    explanation: 'Tiêu chí đánh giá: So sánh tần suất rõ ràng (hầu như dùng app hàng ngày, chỉ ra quầy khi cần giao dịch giấy tờ lớn), nêu rõ ưu điểm tiện lợi hoặc bảo mật.',
    vietnameseTranslation: 'Trả lời phỏng vấn ngân hàng: Nêu rõ tần suất sử dụng ngân hàng số so với đến quầy giao dịch truyền thống, đưa ra lý do thuyết phục về tốc độ và sự tiện lợi.',
    keyVocabulary: [
      { word: 'Teller', ipa: '/ˈtel.ər/', meaning: 'Giao dịch viên ngân hàng' },
      { word: 'Transactions', ipa: '/trænˈzæk.ʃənz/', meaning: 'Các giao dịch tài chính' }
    ],
    evaluationCriteria: {
      pronunciationWeight: 0.3,
      fluencyWeight: 0.35,
      grammarWeight: 0.15,
      vocabularyWeight: 0.2,
      targetLengthWords: { min: 45, max: 80 },
      rubricNotes: 'Đánh giá cấu trúc so sánh hơn và từ vựng tài chính tiêu dùng.'
    }
  },
  {
    id: 'toeic_sp_18',
    part: 'speaking_read',
    skill: 'speaking',
    difficulty: 'hard',
    estimatedDifficulty: 710,
    topic: 'Medical Conference Schedule',
    subSkill: 'complex_schedule_conflict_resolution',
    questionType: 'speaking_respond_info',
    vocabularyTags: ['symposium', 'concurrent', 'cardiology'],
    grammarTags: ['contrastive_connectors', 'conditional_clarification'],
    questionText: 'Task 18 (Respond using information provided): Dựa vào lịch trình diễn đàn y khoa, giải thích cho người gọi liệu họ có thể tham dự cả hai bài giảng của Tiến sĩ Thorne và Tiến sĩ Wu không, và phiên tiếp theo buổi chiều là gì.',
    passage: `International Cardiology Forum Schedule:\n- 01:30 PM - 03:00 PM: Session A: "Non-Invasive Diagnostic Tools" by Dr. Aris Thorne (Auditorium 1)\n- 01:30 PM - 03:00 PM: Session B: "Pediatric Heart Surgery Protocols" by Dr. Clara Wu (Auditorium 2)\n- 03:15 PM - 04:30 PM: Plenary Q&A on Clinical Trials (Grand Amphitheater)\nCaller Question: "I am interested in Dr. Thorne's lecture and Dr. Wu's presentation. Can I attend both sessions, and what follows them in the afternoon?"`,
    explanation: 'Tiêu chí đánh giá: Nhận diện xung đột lịch trình (cả hai phiên diễn ra cùng lúc 1:30 PM - 3:00 PM nên không thể dự cả hai), giải thích rõ ràng và thông báo phiên họp toàn thể Plenary Q&A lúc 3:15 PM.',
    vietnameseTranslation: 'Dựa vào lịch hội nghị: Giải thích rằng hai bài giảng diễn ra đồng thời nên không thể tham gia cả hai, và hướng dẫn phiên hỏi đáp chung tiếp theo lúc 3:15 chiều tại Grand Amphitheater.',
    keyVocabulary: [
      { word: 'Concurrent', ipa: '/kənˈkʌr.ənt/', meaning: 'Xảy ra đồng thời, diễn ra cùng lúc' },
      { word: 'Plenary', ipa: '/ˈpliː.nər.i/', meaning: 'Phiên họp toàn thể' }
    ],
    evaluationCriteria: {
      pronunciationWeight: 0.3,
      fluencyWeight: 0.35,
      taskCompletionWeight: 0.35,
      targetLengthWords: { min: 45, max: 85 },
      rubricNotes: 'Xử lý lịch trùng mượt mà và chuyển tiếp mạch lạc sang sự kiện kế tiếp.'
    }
  },
  {
    id: 'toeic_sp_19',
    part: 'speaking_read',
    skill: 'speaking',
    difficulty: 'hard',
    estimatedDifficulty: 750,
    topic: 'Environmental Corporate Policy',
    subSkill: 'persuasive_argumentation',
    questionType: 'speaking_express_opinion',
    vocabularyTags: ['subsidies', 'emissions', 'carbon_footprint'],
    grammarTags: ['conditional_hypothetical', 'formal_transitions'],
    questionText: 'Task 19 (Express an opinion): Bày tỏ quan điểm trong 60 giây: Chính phủ nên áp đặt thuế carbon nặng đối với các nhà máy gây ô nhiễm hay trợ cấp thuế cho đổi mới công nghệ sạch?',
    passage: 'Debate Topic: Some environmental economists advocate imposing heavy statutory carbon tax penalties on industrial polluters, whereas others maintain that offering financial tax credits and clean technology subsidies produces faster green transformation. Which approach do you believe is more effective, and why?',
    explanation: 'Tiêu chí đánh giá: Nêu rõ lập trường chọn phương án nào, phát triển 2 luận cứ chặt chẽ (tính răn đe của hình phạt hoặc động lực kinh tế từ trợ cấp), dùng từ nối học thuật.',
    vietnameseTranslation: 'Trình bày quan điểm: Lựa chọn giữa đánh thuế phạt carbon nặng và trợ cấp khuyến khích công nghệ sạch, đưa ra dẫn chứng về tính khả thi và tác động kinh tế lâu dài.',
    keyVocabulary: [
      { word: 'Subsidies', ipa: '/ˈsʌb.sɪ.diz/', meaning: 'Khoản trợ cấp, tài trợ tài chính' },
      { word: 'Statutory', ipa: '/ˈstætʃ.ə.tər.i/', meaning: 'Theo luật định, có tính pháp lý bắt buộc' }
    ],
    evaluationCriteria: {
      pronunciationWeight: 0.25,
      fluencyWeight: 0.3,
      grammarWeight: 0.25,
      vocabularyWeight: 0.2,
      targetLengthWords: { min: 55, max: 105 },
      rubricNotes: 'Đánh giá tính thuyết phục, logic phản biện và vốn từ vựng kinh tế vĩ mô.'
    }
  },
  {
    id: 'toeic_sp_20',
    part: 'speaking_read',
    skill: 'speaking',
    difficulty: 'hard',
    estimatedDifficulty: 790,
    topic: 'Human Resources & Performance Evaluation',
    subSkill: 'executive_opinion_argumentation',
    questionType: 'speaking_express_opinion',
    vocabularyTags: ['incentives', 'accountability', 'collaboration'],
    grammarTags: ['complex_conditionals', 'discourse_markers'],
    questionText: 'Task 20 (Express an opinion): Trình bày quan điểm của bạn: Tiền thưởng đánh giá nhân sự nên dựa trên KPI định lượng cá nhân hay kết quả thành tích chung của toàn bộ tổ chức?',
    passage: 'Corporate Debate: Should corporate executive bonuses be determined strictly by individual quantifiable sales metrics, or should they be tied directly to overall organizational cross-functional achievements? State your opinion with supporting rationale in 60 seconds.',
    explanation: 'Tiêu chí đánh giá: Luận điểm mở đầu rõ ràng, phân tích sâu về động lực làm việc (khuyến khích cá nhân nỗ lực so với tinh thần đoàn kết tránh cạnh tranh nội bộ tiêu cực), ví dụ thực tế.',
    vietnameseTranslation: 'Trình bày quan điểm: Nêu rõ lập trường về tiêu chí thưởng theo thành tích cá nhân hay tập thể, phân tích mặt lợi/hại đối với văn hóa doanh nghiệp và hiệu quả kinh doanh.',
    keyVocabulary: [
      { word: 'Quantifiable', ipa: '/ˈkwɒn.tɪ.faɪ.ə.bəl/', meaning: 'Có thể định lượng, đo đếm được' },
      { word: 'Cross-functional', ipa: '/krɒs ˈfʌŋk.ʃən.əl/', meaning: 'Liên phòng ban, phối hợp đa chức năng' }
    ],
    evaluationCriteria: {
      pronunciationWeight: 0.25,
      fluencyWeight: 0.3,
      grammarWeight: 0.25,
      vocabularyWeight: 0.2,
      targetLengthWords: { min: 60, max: 110 },
      rubricNotes: 'Đánh giá tính chặt chẽ trong cấu trúc Point-Explanation-Example-Conclusion.'
    }
  },

  // ---------------------------------------------------------------------------
  // ADDITIONAL WRITING TASKS (toeic_wr_5 -> toeic_wr_10: Diversity Expansion)
  // ---------------------------------------------------------------------------
  {
    id: 'toeic_wr_5',
    part: 'writing_email',
    skill: 'writing',
    difficulty: 'easy',
    topic: 'Office Document Scanning',
    subSkill: 'sentence_construction',
    questionType: 'writing_write_sentence',
    vocabularyTags: ['scanner', 'instructions', 'assistant'],
    grammarTags: ['subordinating_conjunctions', 'subject_verb_agreement'],
    estimatedDifficulty: 420,
    questionText: 'Task 5 (Write a sentence based on a picture): Viết MỘT câu hoàn chỉnh miêu tả nhân viên văn phòng đang sử dụng máy scan, bắt buộc sử dụng hai từ cho trước: "assistant" và "while".',
    passage: 'Context: An administrative assistant is feeding multi-page contract sheets into an office multifunction scanner while reading the user manual.',
    explanation: 'Tiêu chí chấm điểm: Tạo câu đơn hoặc phức có nghĩa chuẩn xác, chứa cả 2 từ "assistant" và "while", chia đúng thì và ngữ pháp không có lỗi cơ bản.',
    vietnameseTranslation: 'Viết một câu có nghĩa chứa từ "assistant" và liên từ "while" miêu tả trợ lý văn phòng scan tài liệu.',
    keyVocabulary: [
      { word: 'Multifunction', ipa: '/ˌmʌl.tiˈfʌŋk.ʃən/', meaning: 'Đa chức năng' },
      { word: 'Administrative', ipa: '/ədˈmɪn.ɪ.strə.tɪv/', meaning: 'Thuộc về hành chính' }
    ],
    evaluationCriteria: {
      grammarWeight: 0.5,
      vocabularyWeight: 0.3,
      taskCompletionWeight: 0.2,
      targetLengthWords: { min: 10, max: 25 },
      rubricNotes: 'Bắt buộc sử dụng đúng 2 từ cho trước trong 1 câu duy nhất.'
    }
  },
  {
    id: 'toeic_wr_6',
    part: 'writing_email',
    skill: 'writing',
    difficulty: 'easy',
    topic: 'Conference Room Preparation',
    subSkill: 'sentence_construction',
    questionType: 'writing_write_sentence',
    vocabularyTags: ['projector', 'arranged', 'chairs'],
    grammarTags: ['passive_voice', 'correlative_conjunctions'],
    estimatedDifficulty: 460,
    questionText: 'Task 6 (Write a sentence based on a picture): Viết MỘT câu hoàn chỉnh về phòng hội thảo sẵn sàng đón khách, bắt buộc sử dụng hai từ cho trước: "arranged" và "because".',
    passage: 'Context: Chairs in the large conference hall are neatly arranged in curved rows because an executive presentation is scheduled for 2:00 PM.',
    explanation: 'Tiêu chí chấm điểm: Sử dụng từ "arranged" và "because" trong một câu hợp nghĩa, đúng cấu trúc nguyên nhân kết quả.',
    vietnameseTranslation: 'Viết một câu hoàn chỉnh dùng "arranged" và "because" để miêu tả các dãy ghế trong phòng họp đã được sắp xếp ngay ngắn.',
    keyVocabulary: [
      { word: 'Arranged', ipa: '/əˈreɪndʒd/', meaning: 'Được sắp xếp, bố trí' },
      { word: 'Auditorium', ipa: '/ˌɔː.dɪˈtɔː.ri.əm/', meaning: 'Hội trường lớn' }
    ],
    evaluationCriteria: {
      grammarWeight: 0.5,
      vocabularyWeight: 0.3,
      taskCompletionWeight: 0.2,
      targetLengthWords: { min: 10, max: 25 },
      rubricNotes: 'Đúng ngữ pháp thì bị động hoặc hoàn thành, liên từ because nối hai mệnh đề.'
    }
  },
  {
    id: 'toeic_wr_7',
    part: 'writing_email',
    skill: 'writing',
    difficulty: 'medium',
    topic: 'Staff Relocation Announcement Response',
    subSkill: 'short_inquiry_response',
    questionType: 'writing_short_response',
    vocabularyTags: ['relocation', 'reimbursement', 'timeline'],
    grammarTags: ['modal_inquiry', 'indirect_questions'],
    estimatedDifficulty: 560,
    questionText: 'Task 7 (Respond to a written request): Viết phản hồi ngắn (40 - 70 từ) gửi phòng Nhân sự (HR) để hỏi về chính sách hỗ trợ chi phí chuyển chỗ ở và thời hạn chốt ngày chuyển văn phòng sang chi nhánh mới.',
    passage: `Internal Memo: Next month, our software engineering division will relocate to the new Riverfront Tech Park campus. Please review the transition handbook and submit any logistical questions to HR.\nWrite a response asking two specific questions regarding moving reimbursement and the exact effective date.`,
    explanation: 'Tiêu chí chấm điểm: Nêu rõ 2 câu hỏi cụ thể (chi phí hỗ trợ vận chuyển và mốc ngày chính thức), văn phong công sở lịch sự, ngắn gọn.',
    vietnameseTranslation: 'Viết phản hồi ngắn gửi HR hỏi 2 vấn đề: mức hỗ trợ chi phí chuyển dời và thời hạn cụ thể bắt đầu làm việc tại địa điểm mới.',
    keyVocabulary: [
      { word: 'Relocation', ipa: '/ˌriː.ləʊˈkeɪ.ʃən/', meaning: 'Việc chuyển địa điểm, dời trụ sở' },
      { word: 'Reimbursement', ipa: '/ˌriː.ɪmˈbɜːs.mənt/', meaning: 'Khoản thanh toán lại chi phí' }
    ],
    evaluationCriteria: {
      grammarWeight: 0.3,
      vocabularyWeight: 0.3,
      taskCompletionWeight: 0.4,
      targetLengthWords: { min: 40, max: 70 },
      rubricNotes: 'Đặt đủ 2 câu hỏi thông tin theo đúng yêu cầu đề bài.'
    }
  },
  {
    id: 'toeic_wr_8',
    part: 'writing_email',
    skill: 'writing',
    difficulty: 'hard',
    topic: 'Vendor Software SLA Dispute',
    subSkill: 'contract_dispute_resolution',
    questionType: 'writing_formal_response',
    vocabularyTags: ['discrepancy', 'sla', 'compensation', 'downtime'],
    grammarTags: ['formal_legal_tone', 'conditional_clause'],
    estimatedDifficulty: 720,
    questionText: 'Task 8 (Write a formal business response): Viết thư giải quyết khiếu nại trang trọng (70 - 120 từ) gửi đối tác Cloud Services phản hồi về sự cố máy chủ ngừng hoạt động vi phạm hợp đồng SLA và đề nghị khấu trừ phí dịch vụ.',
    passage: `Context: Your enterprise cloud hosting provider experienced an unannounced 6-hour outage on Tuesday during peak trading hours, directly breaching the 99.9% uptime Service Level Agreement (SLA). Write a formal letter stating the business impact, demanding a root-cause incident report, and requesting a 15% billing credit.`,
    explanation: 'Tiêu chí chấm điểm: Văn phong thương mại chuẩn mực, viện dẫn điều khoản vi phạm SLA, yêu cầu biên bản phân tích nguyên nhân gốc rễ và đề xuất giảm trừ hóa đơn rõ ràng.',
    vietnameseTranslation: 'Viết thư chính thức gửi nhà cung cấp dịch vụ máy chủ đám mây khiếu nại sự cố ngừng hoạt động vi phạm cam kết SLA, yêu cầu báo cáo nguyên nhân và khấu trừ 15% cước tháng.',
    keyVocabulary: [
      { word: 'Breach of contract', ipa: '/briːtʃ əv ˈkɒn.trækt/', meaning: 'Vi phạm hợp đồng' },
      { word: 'Downtime', ipa: '/ˈdaʊn.taɪm/', meaning: 'Thời gian hệ thống ngừng hoạt động' }
    ],
    evaluationCriteria: {
      grammarWeight: 0.3,
      vocabularyWeight: 0.3,
      taskCompletionWeight: 0.4,
      targetLengthWords: { min: 70, max: 120 },
      rubricNotes: 'Văn phong trang trọng, lập luận pháp lý và thương mại chặt chẽ.'
    }
  },
  {
    id: 'toeic_wr_9',
    part: 'writing_email',
    skill: 'writing',
    difficulty: 'medium',
    topic: 'Client Conference Catering Adjustment',
    subSkill: 'email_customer_service',
    questionType: 'writing_email_response',
    vocabularyTags: ['dietary', 'adjustments', 'confirmation', 'banquet'],
    grammarTags: ['polite_confirmation', 'bullet_format'],
    estimatedDifficulty: 600,
    questionText: 'Task 9 (Write an email response): Viết email phản hồi (50 - 90 từ) cho khách hàng bà Sophia Chen xác nhận việc thay đổi thực đơn tiệc trưa cho hội nghị bao gồm 15 suất ăn chay và không chứa gluten.',
    passage: `From: Sophia Chen <sophia.chen@summitcorp.com>\nSubject: Menu modifications for Friday Luncheon (Event #442)\nDear Catering Manager,\nWe have updated our attendee dietary list. We now require 15 vegetarian and 10 gluten-free meals for the lunch buffet. Could you confirm if your kitchen can accommodate this without extra fees?\nKind regards, Sophia Chen`,
    explanation: 'Tiêu chí chấm điểm: Xác nhận khả năng đáp ứng khẩu phần ăn chay và gluten-free, nêu rõ chi phí (miễn phí điều chỉnh nếu báo trước 48h), và gửi lời chúc sự kiện thành công.',
    vietnameseTranslation: 'Viết email xác nhận thay đổi thực đơn: Xác nhận đáp ứng 15 suất ăn chay và 10 suất không gluten cho tiệc trưa thứ Sáu, giải đáp thắc mắc về chi phí và gửi lời chào chuyên nghiệp.',
    keyVocabulary: [
      { word: 'Accommodate', ipa: '/əˈkɒm.ə.deɪt/', meaning: 'Đáp ứng, thu xếp phù hợp' },
      { word: 'Dietary requirements', ipa: '/ˈdaɪ.ə.tər.i rɪˈkwaɪə.mənts/', meaning: 'Yêu cầu chế độ ăn uống' }
    ],
    evaluationCriteria: {
      grammarWeight: 0.3,
      vocabularyWeight: 0.3,
      taskCompletionWeight: 0.4,
      targetLengthWords: { min: 50, max: 90 },
      rubricNotes: 'Đầy đủ chào hỏi, xác nhận cụ thể số lượng suất ăn, giải đáp chi phí và kết thư lịch thiệp.'
    }
  },
  {
    id: 'toeic_wr_10',
    part: 'writing_email',
    skill: 'writing',
    difficulty: 'hard',
    topic: 'Core Working Hours vs Flexible Schedules',
    subSkill: 'opinion_essay_argument',
    questionType: 'writing_opinion_essay',
    vocabularyTags: ['synchronous', 'autonomy', 'accountability', 'efficiency'],
    grammarTags: ['cohesive_devices', 'complex_sentences', 'hedging'],
    estimatedDifficulty: 800,
    questionText: 'Task 10 (Write an opinion essay): Viết bài luận ngắn (100 - 160 từ) bày tỏ quan điểm: Doanh nghiệp nên áp dụng khung giờ làm việc cố định hay cho phép nhân viên tự do linh hoạt thời gian làm việc miễn hoàn thành chỉ tiêu?',
    passage: `Essay Prompt: Some corporate executives argue that strictly standardized working hours (9:00 AM - 5:00 PM) are essential for real-time collaboration and client service. Others contend that giving employees complete temporal autonomy improves morale and outcome quality. Write an essay presenting your position supported by specific reasons and examples.`,
    explanation: 'Tiêu chí chấm điểm: Bố cục 3 phần rõ ràng (Introduction with thesis, Body paragraph with 2 well-developed supporting arguments, Conclusion), sử dụng từ nối học thuật và từ vựng tổ chức doanh nghiệp.',
    vietnameseTranslation: 'Viết bài luận quan điểm: Nêu rõ lập trường về giờ làm việc cố định so với giờ làm việc linh hoạt, đưa ra luận điểm về tính tương tác đội nhóm và năng suất cá nhân.',
    keyVocabulary: [
      { word: 'Autonomy', ipa: '/ɔːˈtɒn.ə.mi/', meaning: 'Sự tự chủ, quyền tự quyết' },
      { word: 'Accountability', ipa: '/əˌkaʊn.təˈbɪl.ə.ti/', meaning: 'Trách nhiệm giải trình, tính cam kết' }
    ],
    evaluationCriteria: {
      grammarWeight: 0.3,
      vocabularyWeight: 0.3,
      taskCompletionWeight: 0.4,
      targetLengthWords: { min: 100, max: 160 },
      rubricNotes: 'Cấu trúc bài luận chặt chẽ, luận cứ thuyết phục và ngữ pháp câu phức đa dạng.'
    }
  },
  {
    id: 'toeic_wr_11',
    part: 'writing_email',
    skill: 'writing',
    difficulty: 'easy',
    estimatedDifficulty: 400,
    topic: 'Office Contract Review',
    subSkill: 'sentence_construction',
    questionType: 'writing_write_sentence',
    vocabularyTags: ['reviewing', 'because', 'contract'],
    grammarTags: ['causal_conjunction', 'present_continuous'],
    questionText: 'Task 11 (Write a sentence based on a picture): Viết MỘT câu hoàn chỉnh miêu tả hai luật sư đang rà soát hợp đồng, bắt buộc sử dụng hai từ cho trước: "reviewing" và "because".',
    passage: 'Context: Two legal associates in formal business suits are reviewing printed contract terms together at a conference desk because the final client closing meeting takes place tomorrow.',
    explanation: 'Tiêu chí chấm điểm: Viết một câu duy nhất có nghĩa hoàn chỉnh, sử dụng chính xác dạng từ "reviewing" và liên từ "because" chỉ nguyên nhân, ngữ pháp và chính tả chuẩn xác.',
    vietnameseTranslation: 'Viết một câu có nghĩa chứa từ "reviewing" và "because" miêu tả hai chuyên viên pháp lý đang xem lại hợp đồng vì cuộc họp chốt hợp đồng diễn ra vào ngày mai.',
    keyVocabulary: [
      { word: 'Associates', ipa: '/əˈsəʊ.si.eɪts/', meaning: 'Cộng sự, chuyên viên pháp lý' },
      { word: 'Reviewing', ipa: '/rɪˈvjuː.ɪŋ/', meaning: 'Đang xem xét, rà soát' }
    ],
    evaluationCriteria: {
      grammarWeight: 0.5,
      vocabularyWeight: 0.3,
      taskCompletionWeight: 0.2,
      targetLengthWords: { min: 10, max: 25 },
      rubricNotes: 'Bắt buộc sử dụng cả 2 từ cho trước trong 1 câu duy nhất.'
    }
  },
  {
    id: 'toeic_wr_12',
    part: 'writing_email',
    skill: 'writing',
    difficulty: 'easy',
    estimatedDifficulty: 430,
    topic: 'Package Logistics & Courier',
    subSkill: 'sentence_construction',
    questionType: 'writing_write_sentence',
    vocabularyTags: ['package', 'before', 'courier'],
    grammarTags: ['temporal_conjunction', 'modal_must'],
    questionText: 'Task 12 (Write a sentence based on a picture): Viết MỘT câu hoàn chỉnh miêu tả nhân viên giao hàng đang quét mã bưu kiện, bắt buộc sử dụng hai từ cho trước: "package" và "before".',
    passage: 'Context: A delivery courier in a company uniform is scanning a barcode on a cardboard parcel before loading it into his delivery van.',
    explanation: 'Tiêu chí chấm điểm: Tạo câu đơn hoặc câu phức chuẩn ngữ pháp chứa cả "package" và "before", mô tả hợp lý hành động nhân viên chuyển phát.',
    vietnameseTranslation: 'Viết một câu hoàn chỉnh dùng "package" và "before" miêu tả người giao hàng kiểm tra bưu kiện trước khi chất lên xe.',
    keyVocabulary: [
      { word: 'Courier', ipa: '/ˈkʊr.i.ər/', meaning: 'Người giao hàng, nhân viên chuyển phát' },
      { word: 'Barcode', ipa: '/ˈbɑː.kəʊd/', meaning: 'Mã vạch' }
    ],
    evaluationCriteria: {
      grammarWeight: 0.5,
      vocabularyWeight: 0.3,
      taskCompletionWeight: 0.2,
      targetLengthWords: { min: 10, max: 25 },
      rubricNotes: 'Câu đúng cấu trúc thì và nối mệnh đề thời gian.'
    }
  },
  {
    id: 'toeic_wr_13',
    part: 'writing_email',
    skill: 'writing',
    difficulty: 'easy',
    estimatedDifficulty: 450,
    topic: 'Commercial Coffee Shop Operations',
    subSkill: 'sentence_construction',
    questionType: 'writing_write_sentence',
    vocabularyTags: ['counter', 'while', 'espresso'],
    grammarTags: ['subordinating_while', 'action_simultaneous'],
    questionText: 'Task 13 (Write a sentence based on a picture): Viết MỘT câu hoàn chỉnh miêu tả nhân viên pha chế tại quầy quán cà phê, bắt buộc sử dụng hai từ cho trước: "counter" và "while".',
    passage: 'Context: A barista in a green apron is wiping the stainless-steel counter while an espresso machine brews coffee in the background.',
    explanation: 'Tiêu chí chấm điểm: Sử dụng chính xác danh từ "counter" và liên từ "while" diễn tả hai hành động đồng thời, chia đúng thì hiện tại tiếp diễn hoặc hiện tại đơn.',
    vietnameseTranslation: 'Viết một câu có nghĩa chứa "counter" và "while" miêu tả nhân viên lau quầy trong khi máy pha cà phê đang hoạt động.',
    keyVocabulary: [
      { word: 'Barista', ipa: '/bəˈriː.stə/', meaning: 'Nhân viên pha chế cà phê' },
      { word: 'Counter', ipa: '/ˈkaʊn.tər/', meaning: 'Quầy phục vụ' }
    ],
    evaluationCriteria: {
      grammarWeight: 0.5,
      vocabularyWeight: 0.3,
      taskCompletionWeight: 0.2,
      targetLengthWords: { min: 10, max: 25 },
      rubricNotes: 'Ngữ pháp chính xác cho cấu trúc câu phức với while.'
    }
  },
  {
    id: 'toeic_wr_14',
    part: 'writing_email',
    skill: 'writing',
    difficulty: 'easy',
    estimatedDifficulty: 460,
    topic: 'Workplace Environmental Policy',
    subSkill: 'short_inquiry_response',
    questionType: 'writing_short_response',
    vocabularyTags: ['recycling', 'guidelines', 'containers'],
    grammarTags: ['inquiry_questions', 'polite_request'],
    questionText: 'Task 14 (Respond to a written request): Viết phản hồi ngắn (35 - 65 từ) gửi Bộ phận Quản lý Tòa nhà đặt 2 câu hỏi về quy định hộp đựng thực phẩm và vị trí thùng gom rác thải điện tử.',
    passage: `Internal Facility Notice: Starting next Monday, our office building will implement a mandatory three-tier waste segregation system (Paper, Plastics, and Organic Compost). All old trash receptacles will be replaced by Friday.\nPrompt: Write a brief response (35 - 65 words) to the Facilities Department asking two questions about acceptable food containers and electronic e-waste recycling locations.`,
    explanation: 'Tiêu chí chấm điểm: Đặt đúng 2 câu hỏi thông tin theo yêu cầu đề bài, ngôn ngữ lịch sự, độ dài nằm trong khoảng 35 - 65 từ.',
    vietnameseTranslation: 'Viết phản hồi ngắn hỏi về: Loại hộp thức ăn nào được phép bỏ vào thùng rác tái chế và nơi thu gom rác điện tử trong văn phòng.',
    keyVocabulary: [
      { word: 'Segregation', ipa: '/ˌseɡ.rɪˈɡeɪ.ʃən/', meaning: 'Sự phân loại rác thải' },
      { word: 'Receptacles', ipa: '/rɪˈsep.tə.kəlz/', meaning: 'Thùng chứa, vật chứa rác' }
    ],
    evaluationCriteria: {
      grammarWeight: 0.35,
      vocabularyWeight: 0.35,
      taskCompletionWeight: 0.3,
      targetLengthWords: { min: 35, max: 65 },
      rubricNotes: 'Đầy đủ 2 câu hỏi trực tiếp hoặc gián tiếp lịch sự.'
    }
  },
  {
    id: 'toeic_wr_15',
    part: 'writing_email',
    skill: 'writing',
    difficulty: 'medium',
    estimatedDifficulty: 530,
    topic: 'Hospitality Reservation Adjustment',
    subSkill: 'apology_compensation_email',
    questionType: 'writing_email_response',
    vocabularyTags: ['downgraded', 'complimentary', 'upgrade', 'suite'],
    grammarTags: ['email_apology_etiquette', 'future_offer'],
    questionText: 'Task 15 (Write an email response): Viết email phản hồi (50 - 90 từ) xin lỗi ông Marcus Vance về sự cố phòng nghỉ, thông báo chuyển ông sang phòng Tổng thống (Presidential Suite) từ trưa nay và tặng voucher spa miễn phí.',
    passage: `From: Marcus Vance <m.vance@vancetech.com>\nSubject: Reservation #HL-8820 Downgrade Concern\nDear Guest Relations,\nI arrived late last night and was informed that my reserved Executive Suite was given away due to an overbooking glitch, leaving me in a standard double room. As a Diamond loyalty member, I find this service unacceptable. What remediation can you provide?\nRegards, Marcus Vance`,
    explanation: 'Tiêu chí chấm điểm: Lời xin lỗi chân thành, giải pháp khắc phục cụ thể (nâng cấp phòng Tổng thống và tặng voucher spa), thái độ phục vụ chuyên nghiệp của khách sạn cao cấp.',
    vietnameseTranslation: 'Viết email phản hồi khách hàng: Chân thành xin lỗi sự cố xếp nhầm phòng, đề xuất nâng hạng phòng Tổng thống miễn phí và tặng voucher dịch vụ chăm sóc sức khỏe.',
    keyVocabulary: [
      { word: 'Overbooking', ipa: '/ˌəʊ.vəˈbʊk.ɪŋ/', meaning: 'Tình trạng đặt phòng/vé quá số lượng' },
      { word: 'Remediation', ipa: '/rɪˌmiː.diˈeɪ.ʃən/', meaning: 'Biện pháp đền bù, khắc phục sai sót' }
    ],
    evaluationCriteria: {
      grammarWeight: 0.3,
      vocabularyWeight: 0.3,
      taskCompletionWeight: 0.4,
      targetLengthWords: { min: 50, max: 90 },
      rubricNotes: 'Đủ 4 phần: Lời chào, Xin lỗi và giải thích, Phương án bồi thường, Lời kết.'
    }
  },
  {
    id: 'toeic_wr_16',
    part: 'writing_email',
    skill: 'writing',
    difficulty: 'medium',
    estimatedDifficulty: 560,
    topic: 'Wholesale Retail Inquiries',
    subSkill: 'commercial_pricing_inquiry_response',
    questionType: 'writing_email_response',
    vocabularyTags: ['wholesale', 'discount_tiers', 'consignment'],
    grammarTags: ['commercial_formality', 'conditional_rates'],
    questionText: 'Task 16 (Write an email response): Viết email thương mại (55 - 95 từ) trả lời bà Chloe Dupont, nêu rõ số lượng đặt hàng tối thiểu (MOQ: 100 sản phẩm) và chiết khấu 15% cho đơn hàng trên 500 sản phẩm.',
    passage: `From: Chloe Dupont <c.dupont@atelierboutique.com>\nSubject: Wholesale Distribution Inquiry - Botanical Soaps\nDear Sales Director,\nOur boutique chain is interested in carrying your handmade botanical soap line across our five locations. Could you clarify your minimum order quantity (MOQ) and whether you offer tiered discounts for orders exceeding 500 units?\nBest regards, Chloe Dupont`,
    explanation: 'Tiêu chí chấm điểm: Xác nhận điều kiện bán buôn rõ ràng (MOQ 100 bánh, chiết khấu 15% cho đơn > 500 bánh), gửi kèm biểu giá và đề xuất một cuộc gọi tư vấn mẫu thử.',
    vietnameseTranslation: 'Viết email trả lời khách sỉ: Nêu số lượng đặt hàng tối thiểu (100 chiếc), chiết khấu theo số lượng (15% cho đơn trên 500 chiếc) và cam kết giao hàng nhanh.',
    keyVocabulary: [
      { word: 'Tiered discounts', ipa: '/tɪəd ˈdɪs.kaʊnts/', meaning: 'Mức chiết khấu bậc thang theo số lượng' },
      { word: 'Botanical', ipa: '/bəˈtæn.ɪ.kəl/', meaning: 'Có nguồn gốc từ thực vật' }
    ],
    evaluationCriteria: {
      grammarWeight: 0.3,
      vocabularyWeight: 0.3,
      taskCompletionWeight: 0.4,
      targetLengthWords: { min: 55, max: 95 },
      rubricNotes: 'Chính xác thông tin số liệu thương mại, văn phong lịch sự.'
    }
  },
  {
    id: 'toeic_wr_17',
    part: 'writing_email',
    skill: 'writing',
    difficulty: 'medium',
    estimatedDifficulty: 590,
    topic: 'Conference Audiovisual Technical Requirements',
    subSkill: 'technical_spec_inquiry',
    questionType: 'writing_short_response',
    vocabularyTags: ['audiovisual', 'projector', 'compatibility', 'microphones'],
    grammarTags: ['polite_inquiry', 'indirect_questions'],
    questionText: 'Task 17 (Write a short response): Viết email (45 - 80 từ) gửi Điều phối viên Kỹ thuật hỏi về độ phân giải máy chiếu HDMI và số lượng micro cài áo không dây cho 4 diễn giả.',
    passage: `Event Planning Memo: The Global Energy Symposium will be hosted in Grand Ballroom C next month. Keynote speakers will utilize multimedia slide decks and live software demos.\nPrompt: Write an email (45 - 80 words) to the hotel Technical Services Coordinator inquiring about HDMI projector resolution and the availability of wireless lapel microphones for four panel speakers.`,
    explanation: 'Tiêu chí chấm điểm: Hỏi đầy đủ 2 yêu cầu kỹ thuật (độ phân giải máy chiếu và 4 micro cài áo không dây), văn phong hợp tác chuyên nghiệp.',
    vietnameseTranslation: 'Viết email hỏi thông số kỹ thuật âm thanh ánh sáng: Hỏi về chuẩn kết nối máy chiếu và yêu cầu chuẩn bị 4 micro cài áo không dây cho phiên tọa đàm.',
    keyVocabulary: [
      { word: 'Lapel microphone', ipa: '/ləˈpel ˈmaɪ.krə.fəʊn/', meaning: 'Micro cài ve áo không dây' },
      { word: 'Slide deck', ipa: '/slaɪd dek/', meaning: 'Tập slide trình chiếu' }
    ],
    evaluationCriteria: {
      grammarWeight: 0.3,
      vocabularyWeight: 0.35,
      taskCompletionWeight: 0.35,
      targetLengthWords: { min: 45, max: 80 },
      rubricNotes: 'Đúng 2 câu hỏi kỹ thuật, từ vựng thiết bị hội nghị chuẩn.'
    }
  },
  {
    id: 'toeic_wr_18',
    part: 'writing_email',
    skill: 'writing',
    difficulty: 'medium',
    estimatedDifficulty: 610,
    topic: 'Business Contract Revision & Execution',
    subSkill: 'contract_execution_confirmation',
    questionType: 'writing_formal_response',
    vocabularyTags: ['counterparts', 'amendments', 'execution', 'signing'],
    grammarTags: ['formal_business_tone', 'future_arrangement'],
    questionText: 'Task 18 (Write a formal business response): Viết thư thương mại chính thức (50 - 90 từ) gửi ông Ronald Sterling xác nhận việc hoàn tất sửa đổi hợp đồng và hẹn buổi ký kết trực tiếp hoặc điện tử vào thứ Năm tuần này.',
    passage: `From: Ronald Sterling <r.sterling@sterlingpartners.com>\nSubject: Revised Consulting Service Agreement (Version 2.1)\nDear Partners,\nWe reviewed your proposed amendments to Section 4 regarding monthly retainer disbursement. We agree to the adjusted net-30 terms. Please confirm when your managing partner will be available to countersign the agreement.\nSincerely, Ronald Sterling`,
    explanation: 'Tiêu chí chấm điểm: Xác nhận đồng ý các điều khoản sửa đổi, đề xuất thời điểm ký kết hợp đồng cụ thể (thứ Năm lúc 2 giờ chiều), gửi lời cảm ơn tinh thần hợp tác.',
    vietnameseTranslation: 'Viết email xác nhận hợp đồng: Xác nhận đã cập nhật điều khoản thanh toán, hẹn ký hợp đồng vào chiều thứ Năm và đính kèm bản thảo cuối cùng.',
    keyVocabulary: [
      { word: 'Countersign', ipa: '/ˈkaʊn.tə.saɪn/', meaning: 'Ký cùng, ký xác nhận đối ứng' },
      { word: 'Retainer', ipa: '/rɪˈteɪ.nər/', meaning: 'Khoản phí duy trì dịch vụ định kỳ' }
    ],
    evaluationCriteria: {
      grammarWeight: 0.3,
      vocabularyWeight: 0.3,
      taskCompletionWeight: 0.4,
      targetLengthWords: { min: 50, max: 90 },
      rubricNotes: 'Văn phong pháp lý - thương mại trang trọng, thông tin cuộc hẹn rõ ràng.'
    }
  },
  {
    id: 'toeic_wr_19',
    part: 'writing_email',
    skill: 'writing',
    difficulty: 'medium',
    estimatedDifficulty: 620,
    topic: 'Employee Onboarding & Benefits',
    subSkill: 'internal_instruction_email',
    questionType: 'writing_email_response',
    vocabularyTags: ['onboarding', 'badge', 'enrollment', 'benefits'],
    grammarTags: ['instructional_imperatives', 'modal_must'],
    passage: `From: Alan Mercer <alan.mercer@newhire.com>\nSubject: First Day Orientation & Security Clearance Instructions\nDear HR Operations,\nI am looking forward to joining the cybersecurity engineering group next Monday. Could you please outline where I should report on my first morning and what documentation is required to receive my corporate building badge?\nWarm regards, Alan Mercer`,
    questionText: 'Task 19 (Write an email response): Viết email hướng dẫn (50 - 90 từ) cho nhân viên mới Alan Mercer về địa điểm tập trung ngày đầu tiên (Tầng 2, Phòng Nhân sự lúc 9h sáng) và giấy tờ tùy thân cần mang để cấp thẻ ra vào.',
    explanation: 'Tiêu chí chấm điểm: Hướng dẫn rõ ràng thời gian và địa điểm (9:00 AM tại tầng 2), danh mục giấy tờ cần mang (CMND/Hộ chiếu, hợp đồng lao động đã ký), lời chào đón nhiệt tình.',
    vietnameseTranslation: 'Viết email hướng dẫn nhân viên mới: Hướng dẫn có mặt lúc 9:00 sáng tại Phòng Nhân sự Tầng 2, mang theo căn cước/hộ chiếu để làm thẻ tòa nhà và hoàn tất bảo hiểm.',
    keyVocabulary: [
      { word: 'Orientation', ipa: '/ˌɔː.ri.enˈteɪ.ʃən/', meaning: 'Buổi định hướng, làm quen công việc' },
      { word: 'Security badge', ipa: '/sɪˈkjʊə.rə.ti bædʒ/', meaning: 'Thẻ an ninh ra vào toà nhà' }
    ],
    evaluationCriteria: {
      grammarWeight: 0.3,
      vocabularyWeight: 0.3,
      taskCompletionWeight: 0.4,
      targetLengthWords: { min: 50, max: 90 },
      rubricNotes: 'Cấu trúc thư chào đón, hướng dẫn từng bước mạch lạc.'
    }
  },
  {
    id: 'toeic_wr_20',
    part: 'writing_email',
    skill: 'writing',
    difficulty: 'hard',
    estimatedDifficulty: 780,
    topic: 'Workplace Design & Employee Well-Being',
    subSkill: 'opinion_essay_architectural_impact',
    questionType: 'writing_opinion_essay',
    vocabularyTags: ['open_plan', 'distraction', 'productivity', 'cubicle'],
    grammarTags: ['cohesive_connectors', 'thesis_statement', 'complex_clauses'],
    questionText: 'Task 20 (Write an opinion essay): Viết bài luận (100 - 160 từ) bày tỏ quan điểm: Mô hình văn phòng mở (open-plan) thực sự thúc đẩy sự đổi mới hay làm giảm năng suất do tiếng ồn và sự phân tâm?',
    passage: `Essay Prompt: Many modern technology firms have converted traditional private cubicles into completely open-plan shared workspaces to foster impromptu communication. However, critics claim open spaces increase acoustic distraction and harm deep focused productivity. Write an essay presenting your stance on whether open-plan office layouts genuinely benefit enterprise performance, supported by clear reasoning and workplace examples.`,
    explanation: 'Tiêu chí chấm điểm: Bố cục 3 phần học thuật (Mở bài nêu quan điểm rõ ràng, Thân bài gồm 2 luận cứ chặt chẽ có dẫn chứng thực tế về khả năng tập trung hoặc giao tiếp nhóm, Kết bài đúc kết súc tích).',
    vietnameseTranslation: 'Viết bài luận bày tỏ quan điểm: Phân tích ưu nhược điểm của mô hình văn phòng mở so với văn phòng cá nhân, đưa ra lập trường rõ ràng về tác động đối với năng suất và tinh thần làm việc.',
    keyVocabulary: [
      { word: 'Impromptu', ipa: '/ɪmˈprɒmp.tʃuː/', meaning: 'Tự phát, ngẫu hứng không chuẩn bị trước' },
      { word: 'Acoustic distraction', ipa: '/əˈkuː.stɪk dɪˈstræk.ʃən/', meaning: 'Sự phân tâm do tiếng ồn âm thanh' }
    ],
    evaluationCriteria: {
      grammarWeight: 0.3,
      vocabularyWeight: 0.3,
      taskCompletionWeight: 0.4,
      targetLengthWords: { min: 100, max: 160 },
      rubricNotes: 'Bố cục bài luận chặt chẽ, luận điểm sâu sắc và sử dụng từ nối học thuật.'
    }
  }
];

/**
 * Lấy danh sách câu hỏi phân bổ cân đối chuẩn cấu trúc theo từng chế độ thi
 * (Giữ 100% backward-compatibility với ToeicAssessmentView hiện tại)
 */
export function getExamQuestionsByMode(mode: '2skills_mini' | '2skills_full' | '4skills'): ToeicQuestion[] {
  const bank = TOEIC_QUESTION_BANK;

  if (mode === '2skills_mini') {
    // 10 câu đại diện cân bằng đủ cả 7 Part LR
    const p1 = bank.filter((q) => q.part === 'part1_photos').slice(0, 1);
    const p2 = bank.filter((q) => q.part === 'part2_qna').slice(0, 2);
    const p3 = bank.filter((q) => q.part === 'part3_conv').slice(0, 1);
    const p4 = bank.filter((q) => q.part === 'part4_talks').slice(0, 1);
    const p5 = bank.filter((q) => q.part === 'part5_grammar').slice(0, 3);
    const p6 = bank.filter((q) => q.part === 'part6_text').slice(0, 1);
    const p7 = bank.filter((q) => q.part === 'part7_reading').slice(0, 1);
    return [...p1, ...p2, ...p3, ...p4, ...p5, ...p6, ...p7];
  }

  if (mode === '2skills_full') {
    // 20 câu đầy đủ cân đối LR
    const p1 = bank.filter((q) => q.part === 'part1_photos').slice(0, 2);
    const p2 = bank.filter((q) => q.part === 'part2_qna').slice(0, 3);
    const p3 = bank.filter((q) => q.part === 'part3_conv').slice(0, 2);
    const p4 = bank.filter((q) => q.part === 'part4_talks').slice(0, 2);
    const p5 = bank.filter((q) => q.part === 'part5_grammar').slice(0, 5);
    const p6 = bank.filter((q) => q.part === 'part6_text').slice(0, 2);
    const p7 = bank.filter((q) => q.part === 'part7_reading').slice(0, 4);
    return [...p1, ...p2, ...p3, ...p4, ...p5, ...p6, ...p7];
  }

  // 4skills: 20 câu LR + 2 câu Speaking + 2 câu Writing = 24 câu
  const lrQuestions = getExamQuestionsByMode('2skills_full');
  const spQuestions = bank.filter((q) => q.skill === 'speaking').slice(0, 2);
  const wrQuestions = bank.filter((q) => q.skill === 'writing').slice(0, 2);
  return [...lrQuestions, ...spQuestions, ...wrQuestions];
}
