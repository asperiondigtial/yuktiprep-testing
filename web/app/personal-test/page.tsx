"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { interviewApi } from "@/lib/interview-api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  levels,
  modes,
  locales,
  EXAM_CATALOG,
  EXAM_STREAMS,
  examStreamKeys,
  ExamStreamKey,
  CandidateProfile,
  MODE_CONFIGS,
  LEVEL_POLICY,
  Mode,
  Level,
  Locale,
  PanelMember,
} from "@/lib/interview-types";
import { generateAdaptiveBoard, getSubTracksForExam } from "@/lib/interview-board";
import { toast } from "sonner";
import BackButton from "@/components/auth/back-button";
import { Users, Award, BookOpen, ShieldAlert, Scale, Sparkles, UserCheck } from "lucide-react";

export default function MockInterview() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const [selectedStream, setSelectedStream] = useState<ExamStreamKey>("CIVIL_SERVICES");
  const filteredExams = EXAM_CATALOG.filter((e) => e.stream === selectedStream);
  const [selectedExamId, setSelectedExamId] = useState<string>(filteredExams[0]?.id || "UPSC_CSE");
  const currentExam = EXAM_CATALOG.find((e) => e.id === selectedExamId) || EXAM_CATALOG[0];

  const [topic, setTopic] = useState<string>(currentExam.defaultTopic);
  const [selectedMode, setSelectedMode] = useState<Mode>("MOCK_INTERVIEW");
  const [selectedLevel, setSelectedLevel] = useState<Level>("HIGH");
  const [selectedLocale, setSelectedLocale] = useState<Locale>("en-IN");
  const [selectedMedia, setSelectedMedia] = useState<"VIDEO" | "AUDIO" | "TEXT">("VIDEO");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableSubTracks = getSubTracksForExam(selectedExamId);
  const [selectedSubTrackId, setSelectedSubTrackId] = useState<string>(availableSubTracks[0]?.id || "");
  const [selectedSubject, setSelectedSubject] = useState<string>(
    currentExam.subjects?.[0] || "Public Administration & Governance"
  );
  const [panelSize, setPanelSize] = useState<number>(5);

  const [counterProbingIntensity, setCounterProbingIntensity] = useState<
    "LOW" | "MEDIUM" | "HIGH" | "INTENSE"
  >("HIGH");

  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile>({
    fullName: user?.name || "",
    education: "",
    currentRole: "",
    experienceYears: 2,
    specialization: currentExam.subjects?.[0] || "Public Administration & Governance",
    selectedSubject: currentExam.subjects?.[0] || "Public Administration & Governance",
    subTrackId: availableSubTracks[0]?.id || "",
    panelSize: 5,
    homeState: "",
    targetRole: "",
    keyAccomplishments: "",
  });

  const adaptiveBoard = generateAdaptiveBoard(
    currentExam,
    {
      ...candidateProfile,
      selectedSubject,
      subTrackId: selectedSubTrackId,
      panelSize,
      examBehaviorOverrides: {
        counterProbingIntensity,
      },
    },
    selectedSubTrackId
  );

  // Sync user name if auth profile loads after initial render
  useEffect(() => {
    if (user?.name && !candidateProfile.fullName) {
      setCandidateProfile((prev) => ({ ...prev, fullName: user.name || "" }));
    }
  }, [user?.name]);

  const [showDafEditor, setShowDafEditor] = useState(true);

  const handleStreamChange = (stream: ExamStreamKey) => {
    setSelectedStream(stream);
    const exams = EXAM_CATALOG.filter((e) => e.stream === stream);
    if (exams.length > 0) {
      setSelectedExamId(exams[0].id);
      const subTracks = getSubTracksForExam(exams[0].id);
      setSelectedSubTrackId(subTracks[0]?.id || "");
      setSelectedSubject(exams[0].subjects?.[0] || "Core Domain");
      setTopic(exams[0].defaultTopic);
    }
  };

  const handleExamChange = (examId: string) => {
    setSelectedExamId(examId);
    const ex = EXAM_CATALOG.find((e) => e.id === examId);
    if (ex) {
      const subTracks = getSubTracksForExam(examId);
      setSelectedSubTrackId(subTracks[0]?.id || "");
      setSelectedSubject(ex.subjects?.[0] || "Core Domain");
      setTopic(ex.defaultTopic);
    }
  };

  const createSessionMutation = useMutation({
    mutationFn: interviewApi.createSession,
    onSuccess: (response) => {
      router.push(`/personal-test/session/${response.data.id}`);
    },
    onError: (err: any) => {
      const message = err?.message || "Failed to start interview session";
      setError(message);
      toast.error(message);
      setBusy(false);
    },
  });

  const handleStartSession = () => {
    if (busy) return;
    setBusy(true);
    setError(null);

    createSessionMutation.mutate({
      mode: selectedMode,
      level: selectedLevel,
      locale: selectedLocale,
      examId: selectedExamId,
      topic,
      media: selectedMedia,
      candidateProfile: {
        ...candidateProfile,
        selectedSubject,
        subTrackId: selectedSubTrackId,
        panelSize,
        customPanelMembers: adaptiveBoard,
        examBehaviorOverrides: {
          counterProbingIntensity,
        },
      },
    });
  };

  const currentModeConfig = MODE_CONFIGS[selectedMode] || MODE_CONFIGS.MOCK_INTERVIEW;
  const policy = LEVEL_POLICY[selectedLevel];

  return (
    <div className="min-h-screen bg-[#F4F6FA] px-4 py-6 font-[family-name:var(--font-poppins)] md:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-4">
          <BackButton onClick={() => router.push("/")} />
        </div>

        {/* Header Banner */}
        <div className="mb-6 flex flex-col justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-700">
              <Sparkles className="h-4 w-4" />
              <span>Executive Simulation Studio</span>
            </div>
            <h1 className="mt-1 text-2xl font-black text-[#1F314D] md:text-3xl">Personality Test Studio</h1>
            <p className="mt-1 text-sm text-slate-500">
              Configure your interview examination, customized DAF profile, and enter the live 5-reviewer board room.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleStartSession}
              disabled={busy || createSessionMutation.isPending}
              className="h-11 rounded-xl bg-[#0f172a] px-6 text-sm font-semibold text-white shadow-md hover:bg-[#1e293b]"
            >
              {busy || createSessionMutation.isPending ? "Connecting..." : `Launch Board Viva ➔`}
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="font-bold text-red-600 hover:text-red-800"
            >
              ✕
            </button>
          </div>
        )}

        {/* 2-Column Responsive Grid View */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Left Column (7 cols): Examination Track, Specialization & DAF Configuration */}
          <div className="space-y-6 lg:col-span-7">
            {/* Exam & Specialization Card */}
            <Card className="rounded-2xl border-[#E2E6EE] shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-[#1F314D]">
                  1. Examination Track & Service Cadre
                </CardTitle>
                <CardDescription className="text-xs">
                  Choose your targeted discipline, board, and specialized sub-track.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Discipline / Career Stream</Label>
                  <div className="flex flex-wrap gap-2">
                    {examStreamKeys.map((key) => {
                      const active = selectedStream === key;
                      return (
                        <Button
                          key={key}
                          type="button"
                          variant={active ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleStreamChange(key)}
                          className="rounded-full text-xs font-semibold"
                        >
                          {EXAM_STREAMS[key].name}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="exam" className="text-xs font-semibold text-slate-700">Target Board / Exam</Label>
                    <select
                      id="exam"
                      value={selectedExamId}
                      onChange={(e) => handleExamChange(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-sm outline-none focus:border-teal-500 focus:bg-white"
                    >
                      {filteredExams.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {availableSubTracks.length > 0 && (
                    <div className="space-y-1.5">
                      <Label htmlFor="subtrack" className="text-xs font-semibold text-slate-700">Specialized Sub-Track</Label>
                      <select
                        id="subtrack"
                        value={selectedSubTrackId}
                        onChange={(e) => {
                          setSelectedSubTrackId(e.target.value);
                          const st = availableSubTracks.find((s) => s.id === e.target.value);
                          if (st) {
                            setCandidateProfile((prev) => ({
                              ...prev,
                              subTrackId: st.id,
                              targetRole: st.name,
                            }));
                          }
                        }}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-sm outline-none focus:border-teal-500 focus:bg-white"
                      >
                        {availableSubTracks.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Subject Specialization */}
                {currentExam.subjects && currentExam.subjects.length > 0 && (
                  <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3.5">
                    <Label htmlFor="subject" className="text-xs font-bold text-teal-900">
                      🎯 Subject / Optional Specialization (Deep-Dive Focus)
                    </Label>
                    <select
                      id="subject"
                      value={selectedSubject}
                      onChange={(e) => {
                        setSelectedSubject(e.target.value);
                        setCandidateProfile((prev) => ({
                          ...prev,
                          selectedSubject: e.target.value,
                          specialization: e.target.value,
                        }));
                      }}
                      className="mt-1.5 w-full rounded-xl border border-teal-300 bg-white px-3.5 py-2 text-sm outline-none focus:border-teal-600"
                    >
                      {currentExam.subjects.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-[11px] text-teal-700">
                      The Domain Expert on your board will ask rigorous theoretical and empirical questions tailored to this specialization.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Candidate DAF Profile Card */}
            <Card className="rounded-2xl border-[#E2E6EE] shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-[#1F314D]">
                      2. Detailed Application Form (DAF / Profile)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      The board analyzes your background to challenge your tenure, degree, and motivations.
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDafEditor(!showDafEditor)}
                    className="text-xs font-semibold text-slate-600"
                  >
                    {showDafEditor ? "Hide" : "Edit"}
                  </Button>
                </div>
              </CardHeader>
              {showDafEditor && (
                <CardContent className="space-y-3 pt-0">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="fullName" className="text-xs text-slate-600">Full Name</Label>
                      <Input
                        id="fullName"
                        value={candidateProfile.fullName}
                        onChange={(e) => setCandidateProfile((prev) => ({ ...prev, fullName: e.target.value }))}
                        className="h-9 rounded-lg text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="education" className="text-xs text-slate-600">Degree & Alma Mater</Label>
                      <Input
                        id="education"
                        placeholder="e.g. B.Tech (IIT Delhi)"
                        value={candidateProfile.education}
                        onChange={(e) => setCandidateProfile((prev) => ({ ...prev, education: e.target.value }))}
                        className="h-9 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="currentRole" className="text-xs text-slate-600">Current Role / Past Work</Label>
                      <Input
                        id="currentRole"
                        placeholder="e.g. Software Consultant"
                        value={candidateProfile.currentRole}
                        onChange={(e) => setCandidateProfile((prev) => ({ ...prev, currentRole: e.target.value }))}
                        className="h-9 rounded-lg text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="homeState" className="text-xs text-slate-600">Home State / Domicile</Label>
                      <Input
                        id="homeState"
                        placeholder="e.g. Uttar Pradesh"
                        value={candidateProfile.homeState}
                        onChange={(e) => setCandidateProfile((prev) => ({ ...prev, homeState: e.target.value }))}
                        className="h-9 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="targetRole" className="text-xs text-slate-600">Target Cadre / Service Preference</Label>
                    <Input
                      id="targetRole"
                      placeholder="e.g. Indian Administrative Service (IAS)"
                      value={candidateProfile.targetRole}
                      onChange={(e) => setCandidateProfile((prev) => ({ ...prev, targetRole: e.target.value }))}
                      className="h-9 rounded-lg text-xs"
                    />
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Simulation Parameters Grid */}
            <Card className="rounded-2xl border-[#E2E6EE] shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-[#1F314D]">
                  3. Simulation Environment & Evaluation Tier
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="mode" className="text-xs font-semibold text-slate-700">Mode</Label>
                  <select
                    id="mode"
                    value={selectedMode}
                    onChange={(e) => setSelectedMode(e.target.value as Mode)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs outline-none focus:border-teal-500"
                  >
                    {modes.map((m) => (
                      <option key={m} value={m}>
                        {MODE_CONFIGS[m]?.title || m}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="level" className="text-xs font-semibold text-slate-700">Tier</Label>
                  <select
                    id="level"
                    value={selectedLevel}
                    onChange={(e) => setSelectedLevel(e.target.value as Level)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs outline-none focus:border-teal-500"
                  >
                    {levels.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="locale" className="text-xs font-semibold text-slate-700">Language</Label>
                  <select
                    id="locale"
                    value={selectedLocale}
                    onChange={(e) => setSelectedLocale(e.target.value as Locale)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs outline-none focus:border-teal-500"
                  >
                    <option value="en-IN">English (en-IN)</option>
                    <option value="hi-IN">Hindi (hi-IN)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="media" className="text-xs font-semibold text-slate-700">Media</Label>
                  <select
                    id="media"
                    value={selectedMedia}
                    onChange={(e) => setSelectedMedia(e.target.value as "VIDEO" | "AUDIO" | "TEXT")}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs outline-none focus:border-teal-500"
                  >
                    <option value="VIDEO">Video + Audio</option>
                    <option value="AUDIO">Audio Only</option>
                    <option value="TEXT">Text Only</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column (5 cols): Live 5-Reviewer Board Preview & Topic Launchpad */}
          <div className="space-y-6 lg:col-span-5">
            {/* Topic Selection Card */}
            <Card className="rounded-2xl border-[#E2E6EE] shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-[#1F314D]">
                  Case / Anchor Topic
                </CardTitle>
                <CardDescription className="text-xs">
                  Your board will anchor the viva around this core administrative problem.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  required
                  className="h-11 rounded-xl text-xs font-medium"
                />
                <div className="flex flex-wrap gap-1.5">
                  {currentExam.sampleTopics.map((st, i) => (
                    <Button
                      key={i}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTopic(st)}
                      className="rounded-full px-2.5 py-1 text-[11px] text-slate-600 hover:text-slate-900"
                    >
                      {st.length > 34 ? st.substring(0, 31) + "..." : st}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 5-Member Reviewer Board Grid */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-teal-600" />
                  <span className="text-sm font-bold text-slate-800">
                    5-Member Interview Board
                  </span>
                </div>
                <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-bold text-teal-700 border border-teal-200">
                  Standard Board
                </span>
              </div>

              {/* Grid of the 5 board members */}
              <div className="grid grid-cols-1 gap-2.5">
                {adaptiveBoard.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 transition hover:border-teal-300 hover:bg-white hover:shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-900">{member.name}</div>
                        <div className="text-[11px] font-semibold text-teal-700">{member.title}</div>
                      </div>
                      <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[9px] font-bold text-slate-700">
                        {member.role.replace(/_/g, " ")}
                      </span>
                    </div>

                    <p className="mt-1 line-clamp-1 text-[11px] text-slate-500">
                      {member.background}
                    </p>

                    <div className="mt-1.5 rounded-md bg-white p-1.5 text-[10px] text-slate-600 border border-slate-100">
                      <span className="font-semibold text-slate-700">Focus: </span>
                      {member.assessmentFocus}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Launch Action Button */}
            <div className="space-y-3 rounded-2xl border border-teal-100 bg-teal-50/40 p-4">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <UserCheck className="h-4 w-4 text-teal-600" />
                <span>Non-biometric, purely verbal & logical evaluation standards</span>
              </div>

              <Button
                onClick={handleStartSession}
                disabled={busy || createSessionMutation.isPending}
                className="h-12 w-full rounded-xl bg-[#0f172a] text-sm font-bold text-white shadow-md hover:bg-[#1e293b]"
              >
                {busy || createSessionMutation.isPending
                  ? "Connecting to Panel..."
                  : `Enter Board Room Viva ➔`}
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-gray-400">
          Interview sessions are evaluated by AI against standardized civil service rubrics.
        </div>
      </div>
    </div>
  );
}
