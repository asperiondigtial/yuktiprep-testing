import {
  ExamTrack,
  CandidateProfile,
  EXAM_CATALOG,
  SUB_TRACKS_CATALOG,
  PanelMember,
  SubTrack,
  ExamStreamKey,
  INTERVIEW_PHASE_CONFIGS,
  InterviewPhase,
  interviewPhases,
} from "./interview-types";

/**
 * Dynamically synthesizes an authentic, tailored 3 to 8 member board panel
 * customized specifically to the aspirant's chosen subject, background, home state,
 * target sub-track/service, and difficulty settings.
 */
export function generateAdaptiveBoard(
  examTrackOrProfile: any,
  profileOrTrack?: any,
  subTrackIdParam?: string
): PanelMember[] {
  let examTrack: ExamTrack | undefined;
  let profile: Partial<CandidateProfile> | undefined;
  let subTrackId: string | undefined = subTrackIdParam;

  if (
    examTrackOrProfile &&
    (examTrackOrProfile.stream || examTrackOrProfile.panelMembers || examTrackOrProfile.keyFocusAreas)
  ) {
    examTrack = examTrackOrProfile;
    profile = profileOrTrack;
  } else if (
    profileOrTrack &&
    (profileOrTrack.stream || profileOrTrack.panelMembers || profileOrTrack.keyFocusAreas)
  ) {
    examTrack = profileOrTrack;
    profile = examTrackOrProfile;
  } else {
    profile = examTrackOrProfile || {};
    examTrack = profileOrTrack || EXAM_CATALOG[0];
  }

  if (!examTrack) {
    examTrack = EXAM_CATALOG[0];
  }

  if (profile?.customPanelMembers && profile.customPanelMembers.length >= 2) {
    return profile.customPanelMembers;
  }

  const targetSize = profile?.panelSize || 5;
  subTrackId = subTrackId || profile?.subTrackId;
  const subTrack = subTrackId
    ? SUB_TRACKS_CATALOG.find((s) => s.id === subTrackId)
    : undefined;
  const selectedSubject =
    profile?.selectedSubject ||
    profile?.specialization ||
    (examTrack?.subjects ? examTrack.subjects[0] : "Core Domain Fundamentals");
  const homeState = profile?.homeState || "Cadre Specialization";
  const intensity = profile?.examBehaviorOverrides?.counterProbingIntensity || "HIGH";

  let board: PanelMember[] = [];

  if (examTrack.panelMembers && examTrack.panelMembers.length > 0) {
    const base = examTrack.panelMembers;
    board = base.map((member) => {
      if (member.role === "CHAIRPERSON") {
        return {
          ...member,
          title: subTrack ? `${member.title} - ${subTrack.name}` : member.title,
          assessmentFocus: `${member.assessmentFocus}${
            profile?.targetRole ? ` [Target: ${profile.targetRole}]` : ""
          }`,
          scoringWeight: 0.25,
        };
      }
      if (member.role === "DOMAIN_EXPERT") {
        return {
          ...member,
          title: `Domain Chair & Senior Specialist (${selectedSubject})`,
          background: `Eminent Professor & Policy Advisor in ${selectedSubject}`,
          assessmentFocus: `First-principles rigor, statutory precision, and real-world policy in ${selectedSubject}`,
          scoringWeight: 0.25,
        };
      }
      if (
        member.role === "SITUATIONAL_SPECIALIST" ||
        member.role === "DEFENSE_INTERVIEWING_OFFICER"
      ) {
        return {
          ...member,
          title:
            member.role === "SITUATIONAL_SPECIALIST"
              ? `Regional & Field Governance Specialist (${homeState})`
              : member.title,
          assessmentFocus: `${member.assessmentFocus} (${homeState} socio-economic context and crisis response)`,
          scoringWeight: 0.25,
        };
      }
      if (
        member.role === "PSYCHOLOGY_OBSERVER" ||
        member.role === "INDUSTRY_BAR_RAISER"
      ) {
        return {
          ...member,
          probingStyle:
            intensity === "INTENSE" || intensity === "HIGH"
              ? "STRESS_INQUISITIVE"
              : "PRAGMATIC_CRITICAL",
          scoringWeight: 0.25,
        };
      }
      return { ...member, scoringWeight: 0.25 };
    });
  } else {
    board = [
      {
        id: "adaptive-chair",
        name: "Dr. Arvind Saxena, IAS (Retd.)",
        title: subTrack
          ? `Board Chairperson - ${subTrack.name}`
          : "Board Chairperson (Retd. UPSC / Secretary to Govt. of India)",
        role: "CHAIRPERSON",
        avatarIcon: "Award",
        background: "Senior Civil Service Selection Board Chairperson with 35+ years leadership.",
        assessmentFocus: `Constitutional Morality, Public Interest & Administrative Poise${
          profile?.targetRole ? ` [Target: ${profile.targetRole}]` : ""
        }`,
        probingStyle: "DIPLOMATIC_AUTHORITATIVE",
        scoringWeight: 0.25,
        gender: "MALE",
      },
      {
        id: "adaptive-sme",
        name: "Prof. Gayatri Sen, Ph.D.",
        title: `Domain Chair & Senior Specialist (${selectedSubject})`,
        role: "DOMAIN_EXPERT",
        avatarIcon: "BookOpen",
        background: `Senior Research Chair & Policy Advisor in ${selectedSubject}`,
        assessmentFocus: `Theoretical Depth, Conceptual Precision & First Principles in ${selectedSubject}`,
        probingStyle: "ACADEMIC_FIRST_PRINCIPLES",
        scoringWeight: 0.25,
        gender: "FEMALE",
      },
      {
        id: "adaptive-situational",
        name: "Shri Rajeshwar Rao, IAS",
        title: `Regional & Field Governance Specialist (${homeState})`,
        role: "SITUATIONAL_SPECIALIST",
        avatarIcon: "ShieldAlert",
        background: "30+ Years District Magistrate & Field Crisis Management Leader",
        assessmentFocus: `Crisis Triage, STAR Framework & ${homeState} Administrative Realities`,
        probingStyle: "PRAGMATIC_CRITICAL",
        scoringWeight: 0.25,
        gender: "MALE",
      },
      {
        id: "adaptive-psych",
        name: "Dr. Meenakshi Sundaram",
        title: "Director of Applied Behavioral Sciences & Personality Assessment",
        role: "PSYCHOLOGY_OBSERVER",
        avatarIcon: "Compass",
        background: "Executive Psychology Assessor for High-Stakes Public Selection Boards",
        assessmentFocus:
          "Emotional Resilience, Non-Defensiveness & Composure under Cross-Examination",
        probingStyle:
          intensity === "INTENSE" || intensity === "HIGH"
            ? "STRESS_INQUISITIVE"
            : "SOCRATIC_ENCOURAGING",
        scoringWeight: 0.25,
        gender: "FEMALE",
      },
    ];
  }

  // 5th Member: Cadre Ethics Specialist
  const cadreEthicsMember: PanelMember = {
    id: "adaptive-cadre-ethics",
    name: "Shri K. Ramanathan, IAS (Retd.)",
    title: `Ethics & State Cadre Specialist (${homeState})`,
    role: "CADRE_ETHICS_SPECIALIST",
    avatarIcon: "Scale",
    background: `Former Chief Secretary & State Vigilance Commissioner with 35+ years leadership in ${homeState}`,
    assessmentFocus:
      "Constitutional Morality, Anti-Corruption Norms, Cadre Allocation & Public Trust",
    probingStyle: "ETHICAL_DILEMMA_CHALLENGE",
    scoringWeight: 0.15,
    gender: "MALE",
  };

  // 6th Member: Methodology & Innovation Expert
  const innovationMember: PanelMember = {
    id: "adaptive-innovation-quant",
    name: "Dr. Ananya Mukherjee",
    title: "Senior Public Systems, Tech & Analytics Consultant",
    role: "METHODOLOGY_INNOVATION_EXPERT",
    avatarIcon: "Cpu",
    background:
      "Advisor on Digital Public Infrastructure, Systems Architecture & Policy Innovation",
    assessmentFocus:
      "Quantitative Modeling, Systems Architecture, Digital Governance & Scalable Reforms",
    probingStyle: "ANALYTICAL_DERIVATIONAL",
    scoringWeight: 0.15,
    gender: "FEMALE",
  };

  if (targetSize === 3) {
    return board.slice(0, 3);
  }
  if (targetSize === 4) {
    return board.slice(0, 4);
  }
  if (targetSize === 5) {
    return [...board.slice(0, 4), cadreEthicsMember];
  }
  if (targetSize >= 6) {
    return [...board.slice(0, 4), cadreEthicsMember, innovationMember];
  }

  return [...board.slice(0, 4), cadreEthicsMember];
}

/**
 * Returns the currently active speaking panel member for a given interview phase
 */
export function getActivePanelistForPhase(
  examTrack: ExamTrack | undefined,
  phase: InterviewPhase | string,
  profile?: Partial<CandidateProfile>
): PanelMember {
  const members = generateAdaptiveBoard(examTrack, profile);
  const phaseConfig =
    (INTERVIEW_PHASE_CONFIGS as any)[phase] ||
    INTERVIEW_PHASE_CONFIGS.PROFILE_INCEPTION;

  if (phaseConfig?.assignedRole) {
    const match = members.find((m) => m.role === phaseConfig.assignedRole);
    if (match) return match;
  }

  const phaseIndex = (interviewPhases as readonly string[]).indexOf(phase);
  const safeIdx = phaseIndex >= 0 ? phaseIndex : 0;
  return members[safeIdx % members.length] || members[0];
}

export function getSubTracksForExam(examId: string | undefined | null): SubTrack[] {
  if (!examId || typeof examId !== "string") return [];
  const target = examId.trim().toLowerCase();
  return SUB_TRACKS_CATALOG.filter(
    (st) => st.parentTrackId.toLowerCase() === target
  );
}
