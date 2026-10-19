"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { interviewApi } from "@/lib/interview-api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  interviewPhases,
  INTERVIEW_PHASE_CONFIGS,
  MODE_CONFIGS,
  Mode,
  getExamTrack,
  InterviewPhase,
  PanelMember,
} from "@/lib/interview-types";
import { generateAdaptiveBoard } from "@/lib/interview-board";
import BackButton from "@/components/auth/back-button";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Send,
  Loader2,
  Users,
  Volume2,
  MessageSquare,
  Info,
  X,
  SkipForward,
  Trophy,
  CheckCircle2,
} from "lucide-react";

type Role = "user" | "assistant";

interface ChatMessage {
  role: Role;
  content: string;
  phase?: InterviewPhase;
  panelist?: PanelMember;
}

export default function MockInterviewSession() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const { isAuthenticated } = useAuth();

  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------

  const [sessionData, setSessionData] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [feedback, setFeedback] = useState<any>(null);

  const [busy, setBusy] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [startTime] = useState<number>(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [activeSpeakingPanelist, setActiveSpeakingPanelist] = useState<PanelMember | null>(null);

  const [canContinueInterview, setCanContinueInterview] = useState(true);

  const [ttsEnabled, setTtsEnabled] = useState(true);

  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraStream, setCameraStream] =
    useState<MediaStream | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  const [dictationEnabled, setDictationEnabled] = useState(false);
  const [panelSpeaking, setPanelSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  // Google Meet UI states
  const [activeTab, setActiveTab] = useState<"chat" | "people" | "info" | null>(null);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);

  // Meeting conclusion dialog after 5 questions
  const [showMeetingEndDialog, setShowMeetingEndDialog] = useState(false);
  const MAX_QUESTIONS = 5;

  // Auto-submit countdown state (when user finishes speaking)
  const [autoSubmitCountdown, setAutoSubmitCountdown] = useState<number | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const supported = !!(
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition
      );
      setSpeechSupported(supported);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // REFS
  // ---------------------------------------------------------------------------

  const videoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Prevent opening question from being requested multiple times.
  const openingLoadedRef = useRef(false);

  // Keep the accumulated speech-to-text answer.
  const speechTranscriptRef = useRef("");

  // ---------------------------------------------------------------------------
  // CURRENT PHASE
  // ---------------------------------------------------------------------------

  const currentPhase: InterviewPhase =
    interviewPhases[currentPhaseIndex] || "PROFILE_INCEPTION";

  const phaseConfig = INTERVIEW_PHASE_CONFIGS[currentPhase];

  // ---------------------------------------------------------------------------
  // LOAD SESSION
  // ---------------------------------------------------------------------------

  const {
    data: sessionDataQuery,
    isLoading: sessionLoading,
    error: sessionError,
  } = useQuery({
    queryKey: ["interview-session", sessionId],

    queryFn: async () => {
      const data = await interviewApi.getSession(sessionId);
      return data.data;
    },

    enabled: isAuthenticated && !!sessionId,
  });

  useEffect(() => {
    if (sessionDataQuery) {
      setSessionData(sessionDataQuery);
    }
  }, [sessionDataQuery]);

  useEffect(() => {
    if (sessionError) {
      setError("Failed to load session. Please try again.");
      toast.error("Failed to load session");
    }
  }, [sessionError]);

  // ---------------------------------------------------------------------------
  // TIMER
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedSeconds(
        Math.floor((Date.now() - startTime) / 1000)
      );
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [startTime]);

  // ---------------------------------------------------------------------------
  // AUTO-SCROLL CHAT
  // ---------------------------------------------------------------------------

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [chat]);

  // ---------------------------------------------------------------------------
  // STOP DICTATION
  // ---------------------------------------------------------------------------

  const stopDictation = useCallback(() => {
    const recognition = recognitionRef.current;

    if (recognition) {
      recognition.onend = null;

      try {
        recognition.stop();
      } catch {
        // Recognition may already be stopped.
      }

      recognitionRef.current = null;
    }

    setDictationEnabled(false);
  }, []);

  // ---------------------------------------------------------------------------
  // TEXT TO SPEECH (ADAPTIVE MALE / FEMALE VOICE MATCHING)
  // ---------------------------------------------------------------------------

  const speakText = useCallback(
    (
      text: string,
      locale = "en-IN",
      onEnd?: () => void,
      panelist?: PanelMember | null
    ) => {
      if (
        typeof window === "undefined" ||
        !("speechSynthesis" in window)
      ) {
        onEnd?.();
        return;
      }

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = locale;

      // Determine gender from panelist or name heuristics
      let isFemale = false;
      if (panelist?.gender) {
        isFemale = panelist.gender === "FEMALE";
      } else if (panelist?.name) {
        const lowerName = panelist.name.toLowerCase();
        isFemale =
          lowerName.includes("gayatri") ||
          lowerName.includes("suniti") ||
          lowerName.includes("meenakshi") ||
          lowerName.includes("ananya") ||
          lowerName.includes("dr. suniti") ||
          lowerName.includes("mrs.") ||
          lowerName.includes("ms.") ||
          lowerName.includes("smt");
      }

      const voices = window.speechSynthesis.getVoices();

      if (voices.length > 0) {
        const langPrefix = locale.split("-")[0] || "en";
        // Voices matching the language
        const matchingLangVoices = voices.filter(
          (v) =>
            v.lang.toLowerCase() === locale.toLowerCase() ||
            v.lang.toLowerCase().startsWith(langPrefix.toLowerCase())
        );
        const voicePool = matchingLangVoices.length > 0 ? matchingLangVoices : voices;

        if (isFemale) {
          const femaleVoice = voicePool.find((v) => {
            const n = v.name.toLowerCase();
            return (
              n.includes("female") ||
              n.includes("zira") ||
              n.includes("heera") ||
              n.includes("swara") ||
              n.includes("aditi") ||
              n.includes("samantha") ||
              n.includes("kavya") ||
              n.includes("priya") ||
              n.includes("veena") ||
              n.includes("susan") ||
              n.includes("victoria") ||
              n.includes("kalpana")
            );
          });
          if (femaleVoice) {
            utterance.voice = femaleVoice;
          }
          // Slightly higher pitch for distinct female vocal resonance
          utterance.pitch = 1.08;
          utterance.rate = 0.95;
        } else {
          const maleVoice = voicePool.find((v) => {
            const n = v.name.toLowerCase();
            return (
              n.includes("male") ||
              n.includes("david") ||
              n.includes("ravi") ||
              n.includes("prabhat") ||
              n.includes("madhav") ||
              n.includes("george") ||
              n.includes("alex") ||
              n.includes("mark") ||
              n.includes("daniel") ||
              n.includes("neerja") === false && n.includes("natural")
            );
          });
          if (maleVoice) {
            utterance.voice = maleVoice;
          }
          // Deeper pitch for dignified authoritative male vocal resonance
          utterance.pitch = 0.88;
          utterance.rate = 0.92;
        }
      } else {
        // Fallback pitch modulation if voices list hasn't loaded yet
        utterance.pitch = isFemale ? 1.15 : 0.85;
        utterance.rate = isFemale ? 0.95 : 0.92;
      }

      utterance.onstart = () => {
        setPanelSpeaking(true);
        // Turn off candidate mic immediately when reviewer starts speaking
        stopDictation();
      };

      utterance.onend = () => {
        setPanelSpeaking(false);
        onEnd?.();
      };

      utterance.onerror = () => {
        setPanelSpeaking(false);
        onEnd?.();
      };

      window.speechSynthesis.speak(utterance);
    },
    [stopDictation]
  );

  // Stop speech immediately when voice is disabled.
  useEffect(() => {
    if (!ttsEnabled && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setPanelSpeaking(false);
    }
  }, [ttsEnabled]);

  // Ensure mic is strictly OFF whenever reviewer/panel is speaking
  useEffect(() => {
    if (panelSpeaking && dictationEnabled) {
      stopDictation();
    }
  }, [panelSpeaking, dictationEnabled, stopDictation]);

  // ---------------------------------------------------------------------------
  // START DICTATION
  //
  // IMPORTANT:
  // There is ONLY ONE startDictation function now.
  // ---------------------------------------------------------------------------

  const startDictation = useCallback(
    (options: { silent?: boolean } = { silent: true }) => {
      if (typeof window === "undefined") {
        return;
      }

      // If reviewer / board member is currently speaking, mic MUST remain off
      if (panelSpeaking) {
        if (!options?.silent) {
          toast.warning("Please wait for the reviewer to finish speaking.");
        }
        stopDictation();
        return;
      }

      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        if (!options?.silent) {
          toast.info(
            "Speech-to-text is not supported in Firefox. You can type your responses in the input box below, or use Google Chrome or Microsoft Edge for voice dictation."
          );
        }
        return;
      }

      // Avoid creating multiple recognition instances.
      if (recognitionRef.current) {
        return;
      }

      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = sessionData?.locale || "en-IN";

      speechTranscriptRef.current = message;

      recognition.onresult = (event: any) => {
        let finalTranscript = "";
        let interimTranscript = "";

        for (
          let i = event.resultIndex;
          i < event.results.length;
          i++
        ) {
          const transcript =
            event.results[i][0]?.transcript || "";

          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          speechTranscriptRef.current =
            `${speechTranscriptRef.current} ${finalTranscript}`.trim();
        }

        const displayText =
          `${speechTranscriptRef.current} ${interimTranscript}`.trim();

        setMessage(displayText);

        // Auto-Submit: Reset timer on each utterance, then submit after user pauses speaking
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }

        // Only start auto-submit if candidate has spoken at least a few words
        if (displayText.split(/\s+/).filter(Boolean).length >= 3) {
          let secondsLeft = 3;
          setAutoSubmitCountdown(secondsLeft);

          countdownIntervalRef.current = setInterval(() => {
            secondsLeft -= 1;
            if (secondsLeft > 0) {
              setAutoSubmitCountdown(secondsLeft);
            } else {
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
              }
              setAutoSubmitCountdown(null);
            }
          }, 1000);

          silenceTimerRef.current = setTimeout(() => {
            handleSend(displayText);
          }, 3500);
        } else {
          setAutoSubmitCountdown(null);
        }
      };

      recognition.onerror = (event: any) => {
        const errType = event?.error;

        // "no-speech" and "aborted" are routine browser lifecycle events when silence occurs
        if (errType === "no-speech" || errType === "aborted") {
          return;
        }

        console.warn("Dictation notice:", errType);

        if (errType === "not-allowed") {
          toast.error(
            "Microphone permission denied for voice dictation. Please enable microphone access in your browser settings."
          );
        } else if (errType === "network") {
          // Web Speech API routes audio to cloud recognizers (e.g. Google speech servers).
          // If connectivity drops or the service limits requests, inform user politely.
          if (!options?.silent) {
            toast.error(
              "Speech recognition service unavailable (network timeout). You can continue typing your response directly."
            );
          }
        } else if (!options?.silent) {
          toast.error(`Voice dictation stopped (${errType}). You can continue by typing.`);
        }

        recognitionRef.current = null;
        setDictationEnabled(false);
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        setDictationEnabled(false);
      };

      recognitionRef.current = recognition;

      try {
        recognition.start();
        setDictationEnabled(true);
      } catch (error) {
        console.error("Could not start dictation:", error);

        recognitionRef.current = null;
        setDictationEnabled(false);

        if (!options?.silent) {
          toast.error("Could not start microphone dictation.");
        }
      }
    },
    [message, sessionData?.locale]
  );

  // ---------------------------------------------------------------------------
  // LOAD OPENING QUESTION
  //
  // IMPORTANT:
  // This effect runs once per session.
  // Changing TTS on/off no longer calls the API again.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    async function loadOpening() {
      if (!sessionData?.id) {
        return;
      }

      if (openingLoadedRef.current) {
        return;
      }

      openingLoadedRef.current = true;

      try {
        const opening = await interviewApi.tutorReply(
          sessionData.id,
          {
            message:
              "Good day. I am present for the interview and ready to begin.",
            currentPhase: "PROFILE_INCEPTION",
            turnNumber: 1,
            history: [],
          }
        );

        const replyText =
          opening?.data?.text || opening?.text;

        if (!replyText) {
          throw new Error(
            "Empty response from interview panel."
          );
        }

        const track = getExamTrack(sessionData?.examId);
        const adaptiveMembers = generateAdaptiveBoard(track, sessionData?.candidateProfile);
        const initialPanelist = adaptiveMembers[0];
        setActiveSpeakingPanelist(initialPanelist);

        setChat([
          {
            role: "assistant",
            content: replyText,
            phase: "PROFILE_INCEPTION",
            panelist: initialPanelist,
          },
        ]);

        if (ttsEnabled) {
          speakText(
            replyText,
            sessionData.locale,
            startDictation,
            initialPanelist
          );
        } else {
          startDictation();
        }

        await interviewApi
          .ingestEvent(sessionData.id, {
            type: "SESSION_JOINED",
            occurredAt: new Date().toISOString(),
            payload: {
              client: "WebStudio",
              phase: "PROFILE_INCEPTION",
            },
          })
          .catch(() => {
            // Telemetry failure should not break interview.
          });
      } catch (e) {
        console.warn(
          "Could not fetch opening question:",
          e
        );

        openingLoadedRef.current = false;

        toast.error(
          "Could not load the opening interview question."
        );
      }
    }

    loadOpening();
  }, [
    sessionData?.id,
    sessionData?.locale,
    speakText,
    startDictation,
    ttsEnabled,
  ]);

  // ---------------------------------------------------------------------------
  // TUTOR MUTATION
  // ---------------------------------------------------------------------------

  const tutorMutation = useMutation({
    mutationFn: ({
      sessionId,
      payload,
    }: {
      sessionId: string;
      payload: any;
    }) => {
      return interviewApi.tutorReply(
        sessionId,
        payload
      );
    },

    onSuccess: (response: any, variables) => {
      const replyText =
        response?.data?.text || response?.text;

      if (!replyText) {
        setError("Empty response from panel.");
        toast.error("Empty response from panel");
        setBusy(false);
        return;
      }

      /*
       * IMPORTANT:
       *
       * The response belongs to the phase that was actually
       * sent to the backend.
       *
       * We DO NOT immediately use currentPhaseIndex + 1 here
       * for the message itself.
       */

      const responsePhase =
        variables.payload.currentPhase as InterviewPhase;

      const shouldContinue =
        response?.data?.interviewState?.continueInterview !== false;

      setCanContinueInterview(shouldContinue);

      const track = getExamTrack(sessionData?.examId);
      const adaptiveMembers = generateAdaptiveBoard(track, sessionData?.candidateProfile);
      const nextIdx = Math.min(interviewPhases.length - 1, currentPhaseIndex + 1);
      const currentSpeakingMember = adaptiveMembers[nextIdx % adaptiveMembers.length] || adaptiveMembers[0];
      setActiveSpeakingPanelist(currentSpeakingMember);

      setChat((prev) => [
        ...prev,
        {
          role: "assistant",
          content: replyText,
          phase: responsePhase,
          panelist: currentSpeakingMember,
        },
      ]);

      if (shouldContinue) {
        setCurrentPhaseIndex((previousIndex) => {
          return Math.min(
            interviewPhases.length - 1,
            previousIndex + 1
          );
        });
      } else {
        setShowMeetingEndDialog(true);
      }

      if (ttsEnabled && sessionData?.locale) {
        speakText(replyText, sessionData.locale, startDictation, currentSpeakingMember);
      } else {
        startDictation();
      }

      setBusy(false);
    },

    onError: (err: any) => {
      setError(
        err?.message ||
        "Unable to receive response from panel."
      );

      toast.error(
        err?.message ||
        "Failed to get response"
      );

      setBusy(false);
    },
  });

  // ---------------------------------------------------------------------------
  // COMPLETE INTERVIEW MUTATION
  // ---------------------------------------------------------------------------

  const completeMutation = useMutation({
    mutationFn: () => {
      if (!sessionData?.id) {
        throw new Error("Interview session is not available.");
      }

      const transcript = chat
        .map((item) => item.content)
        .join(" ");

      const durationMinutes = Math.max(
        1,
        Math.round(elapsedSeconds / 60)
      );

      return interviewApi.completeSession(
        sessionData.id,
        {
          transcript,
          segments: chat,
          durationMinutes,
        }
      );
    },

    onSuccess: (result: any) => {
      setFeedback(result.data);
      setCompleting(false);

      toast.success(
        "Interview completed! Redirecting to your 360° evaluation report..."
      );

      // Redirect immediately to results page where candidates view their full score
      if (sessionData?.id) {
        router.push(`/personal-test/results/${sessionData.id}`);
      }
    },

    onError: (err: any) => {
      setError(
        err?.message ||
        "Failed to generate evaluation report."
      );

      toast.error(
        err?.message ||
        "Failed to complete interview"
      );

      setCompleting(false);
    },
  });

  // ---------------------------------------------------------------------------
  // CONNECT CAMERA STREAM TO VIDEO ELEMENT
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (!cameraStream) {
      video.srcObject = null;
      return;
    }

    video.srcObject = cameraStream;

    const attemptPlay = async () => {
      try {
        await video.play();
      } catch (playError) {
        console.error(
          "Video play failed:",
          playError
        );

        setDeviceError(
          "Camera started, but video playback failed."
        );
      }
    };

    attemptPlay();
  }, [cameraStream]);

  // ---------------------------------------------------------------------------
  // START CAMERA
  // ---------------------------------------------------------------------------

  const startCamera = useCallback(async () => {
    try {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        throw new Error(
          "Camera API is not supported in this browser."
        );
      }

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
          audio: true, // Capture candidate voice audio as well for session recording
        });

      streamRef.current = stream;

      setCameraStream(stream);
      setCameraEnabled(true);
      setDeviceError(null);

      // Initialize MediaRecorder for Utho Cloud storage
      try {
        const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
          ? "video/webm;codecs=vp8,opus"
          : MediaRecorder.isTypeSupported("video/mp4")
          ? "video/mp4"
          : "video/webm";

        recordedChunksRef.current = [];
        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 600000, // 600 kbps: crystal clear for webcam while compact
          audioBitsPerSecond: 64000,  // 64 kbps: clear voice audio
        });
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };
        recorder.start(1000); // 1s slice
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
      } catch (recErr) {
        console.warn("Could not start MediaRecorder for Utho recording:", recErr);
      }
    } catch (err: any) {
      console.error("Camera error:", err);

      let message =
        "Unable to access camera.";

      switch (err?.name) {
        case "NotAllowedError":
        case "PermissionDeniedError":
          message =
            "Camera permission was denied. Please allow camera access in your browser settings and reload the page.";
          break;

        case "NotFoundError":
          message =
            "No camera was found on this device.";
          break;

        case "NotReadableError":
          message =
            "Camera is already being used by another application.";
          break;

        case "OverconstrainedError":
          message =
            "The requested camera settings are not supported.";
          break;

        case "SecurityError":
          message =
            "Camera access is blocked for security reasons.";
          break;

        case "NotSupportedError":
          message =
            "Camera access is not supported in this context. Ensure the site is loaded over HTTPS.";
          break;

        default:
          if (err?.message) {
            message = err.message;
          }
      }

      setCameraEnabled(false);
      setCameraStream(null);
      streamRef.current = null;
      setDeviceError(message);

      toast.error(message);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // STOP CAMERA & FINALIZE MEDIA RECORDER
  // ---------------------------------------------------------------------------

  const stopCamera = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // recorder may already be stopped
      }
      setIsRecording(false);
    }

    const stream = streamRef.current;

    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
    }

    streamRef.current = null;

    setCameraStream(null);
    setCameraEnabled(false);

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // CAMERA TOGGLE
  // ---------------------------------------------------------------------------

  const toggleCamera = async () => {
    if (cameraEnabled) {
      stopCamera();
    } else {
      await startCamera();
    }
  };

  // ---------------------------------------------------------------------------
  // MICROPHONE TOGGLE
  // ---------------------------------------------------------------------------

  const toggleMic = async () => {
    if (panelSpeaking) {
      toast.error(
        "Please wait for the panel to finish speaking."
      );
      return;
    }

    if (!speechSupported) {
      toast.info(
        "Speech-to-text is not supported in Firefox. You can type your response directly in the text box below, or use Google Chrome / Microsoft Edge for voice dictation."
      );
      return;
    }

    if (dictationEnabled) {
      stopDictation();
    } else {
      startDictation({ silent: false });
    }
  };

  // ---------------------------------------------------------------------------
  // END SESSION
  // ---------------------------------------------------------------------------

  const endSession = () => {
    stopCamera();
    stopDictation();

    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
    }

    router.push("/personal-test");
  };

  // ---------------------------------------------------------------------------
  // CANCEL AUTO-SUBMIT TIMER
  // ---------------------------------------------------------------------------

  const clearAutoSubmitTimers = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setAutoSubmitCountdown(null);
  }, []);

  // ---------------------------------------------------------------------------
  // SEND USER ANSWER (WITH AUTO-SUBMIT AND SKIP SUPPORT)
  // ---------------------------------------------------------------------------

  const handleSend = useCallback((messageOverride?: string) => {
    clearAutoSubmitTimers();

    const textToSend = typeof messageOverride === "string" ? messageOverride : message;
    const trimmedMessage = textToSend.trim();

    if (!trimmedMessage) {
      return;
    }

    if (busy || tutorMutation.isPending) {
      return;
    }

    if (!sessionData?.id) {
      toast.error(
        "Interview session is not ready."
      );
      return;
    }

    if (panelSpeaking) {
      toast.error(
        "Please wait for the panel to finish speaking."
      );
      return;
    }

    setBusy(true);
    setError(null);

    const userMsg = trimmedMessage;

    /*
     * IMPORTANT:
     *
     * The answer belongs to CURRENT phase.
     *
     * Do NOT increment the phase here.
     */

    const updatedChat: ChatMessage[] = [
      ...chat,
      {
        role: "user",
        content: userMsg,
        phase: currentPhase,
      },
    ];

    setChat(updatedChat);
    setMessage("");

    speechTranscriptRef.current = "";

    stopDictation();

    /*
     * Turn number is based on user responses.
     *
     * Count user messages instead of using total chat length.
     * This avoids errors caused by assistant/user message pairing.
     */

    const userTurnCount =
      updatedChat.filter(
        (item) => item.role === "user"
      ).length;

    // Check if candidate has completed all 5 questions
    if (userTurnCount >= MAX_QUESTIONS) {
      setCanContinueInterview(false);
      setBusy(false);
      setShowMeetingEndDialog(true);
      toast.success("Meeting concluded! All 5 interview questions completed.");
      return;
    }

    const nextTurn = userTurnCount + 1;

    const isFinalPhase =
      currentPhaseIndex >= interviewPhases.length - 1;

    if (isFinalPhase) {
      setCanContinueInterview(false);
      setBusy(false);
      setShowMeetingEndDialog(true);
      toast.success("Meeting concluded! Interview phases complete.");
      return;
    }

    tutorMutation.mutate({
      sessionId: sessionData.id,

      payload: {
        message: userMsg,

        /*
         * Send the phase the user is currently answering.
         */
        currentPhase,

        turnNumber: nextTurn,

        history: updatedChat,
      },
    });
  }, [
    busy,
    chat,
    clearAutoSubmitTimers,
    currentPhase,
    currentPhaseIndex,
    message,
    panelSpeaking,
    sessionData?.id,
    stopDictation,
    tutorMutation,
  ]);

  // ---------------------------------------------------------------------------
  // SKIP TO NEXT QUESTION
  // ---------------------------------------------------------------------------

  const handleSkip = useCallback(() => {
    if (busy || tutorMutation.isPending || panelSpeaking) {
      return;
    }
    clearAutoSubmitTimers();
    toast.info("Moving to next question...");
    handleSend("Sir/Madam, I would prefer to move on to the next question.");
  }, [busy, clearAutoSubmitTimers, handleSend, panelSpeaking, tutorMutation.isPending]);

  // ---------------------------------------------------------------------------
  // FINISH INTERVIEW & UPLOAD TO UTHO CLOUD
  // ---------------------------------------------------------------------------

  const handleFinish = async () => {
    if (completing || completeMutation.isPending) {
      return;
    }

    if (chat.length === 0) {
      toast.error(
        "Please answer at least one interview question first."
      );
      return;
    }

    // Finalize recording if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        await new Promise<void>((resolve) => {
          if (!mediaRecorderRef.current) return resolve();
          mediaRecorderRef.current.onstop = () => resolve();
          mediaRecorderRef.current.stop();
          // Safety timeout in case onstop doesn't fire
          setTimeout(resolve, 600);
        });
      } catch {
        // recorder may already be stopped
      }
      setIsRecording(false);
    }

    stopCamera();
    stopDictation();

    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
    }

    setCompleting(true);
    setError(null);

    // If recording chunks exist and have actual content, upload them to Utho Cloud
    if (recordedChunksRef.current.length > 0 && sessionData?.id) {
      try {
        const mimeType = mediaRecorderRef.current?.mimeType || "video/webm";
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        if (blob.size > 0) {
          const formData = new FormData();
          formData.append("recording", blob, `session-${sessionData.id}.webm`);

          toast.loading("Saving session recording to Utho Cloud...", { id: "utho-upload" });
          await interviewApi.uploadRecording(sessionData.id, formData);
          toast.success("Recording secured in Utho Cloud", { id: "utho-upload" });
        }
      } catch (uploadErr) {
        console.warn("Could not upload recording to Utho Cloud:", uploadErr);
        toast.dismiss("utho-upload");
      }
    }

    completeMutation.mutate();
  };

  // ---------------------------------------------------------------------------
  // FORMAT TIMER
  // ---------------------------------------------------------------------------

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;

    return `${mins}:${remainingSecs < 10 ? "0" : ""}${remainingSecs}`;
  };

  // ---------------------------------------------------------------------------
  // CLEANUP ON UNMOUNT
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      const stream = streamRef.current;

      if (stream) {
        stream
          .getTracks()
          .forEach((track) => track.stop());

        streamRef.current = null;
      }

      const recognition =
        recognitionRef.current;

      if (recognition) {
        recognition.onend = null;

        try {
          recognition.stop();
        } catch {
          // Ignore cleanup errors.
        }

        recognitionRef.current = null;
      }

      if (typeof window !== "undefined") {
        window.speechSynthesis?.cancel();
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // AUTH
  // ---------------------------------------------------------------------------

  if (!isAuthenticated) {
    return null;
  }

  // ---------------------------------------------------------------------------
  // LOADING
  // ---------------------------------------------------------------------------

  if (sessionLoading) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20 font-[family-name:var(--font-poppins)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />

        <p className="mt-4 text-sm text-gray-600">
          Loading interview studio...
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // SESSION ERROR
  // ---------------------------------------------------------------------------

  if (error && !sessionData) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20 font-[family-name:var(--font-poppins)]">
        <Card className="w-full max-w-md rounded-[20px] border-[#E2E6EE] p-6 text-center">
          <h2 className="text-lg font-bold text-red-600">
            Failed to Load Studio
          </h2>

          <p className="mt-2 text-sm text-gray-600">
            {error}
          </p>

          <Button
            onClick={() =>
              router.push("/personal-test")
            }
            className="mt-4"
          >
            Return to Launchpad
          </Button>
        </Card>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // SESSION INITIALIZING
  // ---------------------------------------------------------------------------

  if (!sessionData) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20 font-[family-name:var(--font-poppins)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />

        <p className="mt-4 text-sm text-gray-600">
          Initializing interview studio...
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // CONFIG
  // ---------------------------------------------------------------------------

  const modeConfig =
    MODE_CONFIGS[
    sessionData.mode as Mode
    ] ||
    MODE_CONFIGS.MOCK_INTERVIEW;

    const examTrack = getExamTrack(sessionData?.examId);
    const boardMembers = generateAdaptiveBoard(examTrack, sessionData?.candidateProfile);
    // Display all 5 board members from the adaptive board
    const fiveBoardMembers = boardMembers.slice(0, 5);

    return (
      <div className="flex h-screen w-full flex-col bg-[#202124] text-white font-[family-name:var(--font-poppins)] overflow-hidden select-none">
        {/* Google Meet Top Header Bar */}
        <header className="flex h-14 items-center justify-between px-4 sm:px-6 border-b border-slate-800/80 bg-[#202124] shrink-0 z-20">
          <div className="flex items-center gap-3">
            <BackButton
              onClick={endSession}
              className="text-white hover:bg-white/10 rounded-full h-8 w-8"
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-semibold text-white tracking-tight">
                  {examTrack?.name || sessionData.examId}
                </span>
                <span className="rounded-md bg-teal-500/20 px-2 py-0.5 text-[10px] font-bold text-teal-300 border border-teal-500/30">
                  {sessionData.mode}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 line-clamp-1 max-w-xs sm:max-w-md">
                {sessionData.topic}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isRecording && (
              <div className="flex items-center gap-1.5 rounded-full bg-rose-500/20 px-2.5 py-1 text-[11px] font-semibold text-rose-300 border border-rose-500/40">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                <span>REC • Utho Cloud</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/60 px-3 py-1 rounded-full border border-slate-700/50">
              <span className="font-mono">{formatTime(elapsedSeconds)}</span>
              <span className="text-slate-500">•</span>
              <span className="text-teal-400 font-semibold">{INTERVIEW_PHASE_CONFIGS[currentPhase]?.name.split(":")[1]?.trim() || currentPhase}</span>
              <span className="text-slate-500">•</span>
              <span className="text-amber-400 font-bold">
                Q {Math.min(MAX_QUESTIONS, chat.filter((c) => c.role === "user").length + 1)}/{MAX_QUESTIONS}
              </span>
            </div>
          </div>
        </header>

        {/* Main Meeting Area & Video Grid */}
        <div className="relative flex flex-1 overflow-hidden">
          <main className="flex flex-1 flex-col p-2.5 sm:p-4 overflow-y-auto">
            {/* 5 Board Members + 1 Candidate Tile = 6 Tiles in Google Meet Grid */}
            <div className="flex flex-1 flex-col justify-center max-w-7xl mx-auto w-full">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3.5 flex-1 min-h-[360px]">
                {/* Render all 5 Board Members */}
                {fiveBoardMembers.map((member) => {
                  const isSpeaking = activeSpeakingPanelist?.id === member.id || activeSpeakingPanelist?.role === member.role;
                  const isFemale = member.gender === "FEMALE";

                  return (
                    <div
                      key={member.id}
                      onClick={() => {
                        setActiveSpeakingPanelist(member);
                        toast.info(`Addressing ${member.name} (${isFemale ? "Female Voice" : "Male Voice"})`);
                      }}
                      className={`relative flex flex-col justify-between rounded-2xl bg-[#3c4043] border p-3 sm:p-4 shadow-lg transition-all cursor-pointer min-h-[140px] sm:min-h-[170px] ${
                        isSpeaking
                          ? "border-teal-400 ring-2 ring-teal-400/80 shadow-teal-900/30 bg-[#34383c]"
                          : "border-transparent hover:border-slate-600"
                      }`}
                    >
                      {/* Top badges */}
                      <div className="flex items-center justify-between gap-1">
                        <span className="rounded-md bg-black/40 backdrop-blur-xs px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold text-slate-300 truncate max-w-[130px] sm:max-w-[170px]">
                          {member.title}
                        </span>
                        <span className={`rounded-md px-1.5 py-0.5 text-[8px] sm:text-[9px] font-bold shrink-0 ${
                          isFemale ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" : "bg-teal-500/20 text-teal-300 border border-teal-500/30"
                        }`}>
                          {isFemale ? "♀ Female" : "♂ Male"}
                        </span>
                      </div>

                      {/* Member Center Avatar */}
                      <div className="my-auto flex flex-col items-center justify-center text-center py-1 sm:py-2">
                        <div className="relative mb-1.5 sm:mb-2">
                          <div
                            className={`h-14 w-14 sm:h-20 sm:w-20 rounded-full flex items-center justify-center font-bold text-base sm:text-xl shadow-xl transition-all duration-300 ${
                              isFemale
                                ? "bg-gradient-to-tr from-rose-600 via-pink-600 to-amber-400 text-white"
                                : "bg-gradient-to-tr from-teal-700 via-emerald-600 to-cyan-500 text-white"
                            } ${isSpeaking && panelSpeaking ? "scale-105 ring-4 ring-emerald-400 shadow-emerald-500/50" : ""}`}
                          >
                            {member.name.replace(/^(Dr\.|Prof\.|Shri|Smt\.)\s+/i, "").slice(0, 2).toUpperCase()}
                          </div>

                          {isSpeaking && panelSpeaking && (
                            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md animate-bounce">
                              <Volume2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            </div>
                          )}
                        </div>

                        <h4 className="text-xs sm:text-sm font-bold text-white tracking-tight line-clamp-1">
                          {member.name}
                        </h4>
                        <p className="text-[10px] sm:text-[11px] text-slate-400 line-clamp-1 max-w-[200px] mt-0.5">
                          {member.assessmentFocus}
                        </p>
                      </div>

                      {/* Bottom Name & Mic status tag */}
                      <div className="flex items-center justify-between gap-1">
                        <span className="rounded-md bg-black/60 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-white truncate max-w-[140px]">
                          {member.name}
                        </span>
                        <div className="flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full bg-black/50 text-white">
                          {isSpeaking && panelSpeaking ? (
                            <Volume2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-400 animate-pulse" />
                          ) : (
                            <Mic className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Candidate Video Tile (6th Tile: You) */}
                <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-[#3c4043] border border-transparent shadow-lg min-h-[140px] sm:min-h-[170px]">
                  {cameraEnabled ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="absolute inset-0 h-full w-full object-cover"
                      style={{ transform: "scaleX(-1)" }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-slate-800 to-slate-900 text-slate-400">
                      <div className="flex h-14 w-14 sm:h-18 sm:w-18 items-center justify-center rounded-full bg-slate-700/80 text-white font-bold text-base sm:text-lg">
                        You
                      </div>
                      <p className="mt-1.5 text-xs font-medium text-slate-300">Camera Off</p>
                    </div>
                  )}

                  {/* Candidate top badge */}
                  <div className="relative z-10 flex items-center justify-between p-2.5 sm:p-3">
                    <span className="rounded-md bg-black/60 backdrop-blur-xs px-2 py-0.5 text-[9px] font-semibold text-white">
                      You (Candidate)
                    </span>
                    <div className="flex items-center gap-1.5">
                      {autoSubmitCountdown !== null && (
                        <span className="rounded-md bg-amber-500/90 px-2 py-0.5 text-[9px] font-bold text-slate-950 animate-pulse shadow-sm">
                          {autoSubmitCountdown}s
                        </span>
                      )}
                      <span className={`rounded-md px-1.5 py-0.5 text-[8px] sm:text-[9px] font-bold ${dictationEnabled ? "bg-rose-500 text-white animate-pulse" : "bg-black/60 text-slate-300"}`}>
                        {dictationEnabled ? "MIC ON" : "MIC OFF"}
                      </span>
                    </div>
                  </div>

                  {/* Candidate bottom label */}
                  <div className="relative z-10 flex items-center justify-between p-2.5 sm:p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                    <span className="rounded-md bg-black/60 px-2 py-0.5 text-[10px] sm:text-[11px] font-medium text-white">
                      You (Candidate)
                    </span>
                    <div className={`flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full ${dictationEnabled ? "bg-rose-500 text-white animate-bounce" : "bg-black/50 text-slate-400"}`}>
                      {dictationEnabled ? <Mic className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : <MicOff className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Disclaimer notice banner */}
            <div className="mt-2 mx-auto max-w-4xl w-full px-2 text-center">
              <p className="text-[10px] text-slate-400/80 leading-normal">
                <span className="text-amber-400/90 font-medium">Note:</span> The panelists and subject matter experts (SMEs) shown are included for demonstration purposes only (AI ENABLED). They are not members of our panel, and their inclusion does not imply affiliation or endorsement.
              </p>
            </div>

            {/* Live Subtitles / Speech-to-Text Overlay (Google Meet Style with Internal Scrolling for Large Captions) */}
            {message && dictationEnabled ? (
              <div className="mt-2.5 sm:mt-3 mx-auto max-w-4xl w-full">
                <div className="rounded-xl bg-slate-900/95 backdrop-blur-md px-4 py-2.5 border border-teal-500/50 shadow-xl flex items-center justify-between gap-3">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse shrink-0 mt-1.5" />
                    <span className="text-xs font-bold text-teal-400 shrink-0 mt-0.5">You:</span>
                    <div className="max-h-24 sm:max-h-28 overflow-y-auto pr-1 text-xs sm:text-sm text-white leading-relaxed">
                      {message}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {autoSubmitCountdown !== null ? (
                      <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/40 rounded-full px-2.5 py-1 text-[11px] font-bold text-amber-300">
                        <span>Auto in {autoSubmitCountdown}s</span>
                        <button
                          type="button"
                          onClick={clearAutoSubmitTimers}
                          className="ml-1 text-slate-400 hover:text-white underline text-[10px]"
                          title="Keep speaking"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : null}

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleSend(message)}
                      disabled={busy || tutorMutation.isPending}
                      className="h-7 px-3 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-lg shadow-sm"
                    >
                      Submit Now
                    </Button>
                  </div>
                </div>
              </div>
            ) : captionsEnabled && chat.length > 0 ? (
              <div className="mt-2.5 sm:mt-3 mx-auto max-w-4xl w-full">
                {(() => {
                  const lastMessage = chat[chat.length - 1];
                  const isAssistant = lastMessage.role === "assistant";
                  return (
                    <div className="rounded-xl bg-black/85 backdrop-blur-md px-4 py-2.5 text-xs sm:text-sm text-slate-200 border border-slate-700/60 shadow-lg">
                      <div className="max-h-24 sm:max-h-28 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                        <span className="font-bold text-teal-400 mr-2 shrink-0">
                          {isAssistant ? (lastMessage.panelist?.name || "Board Member") : "You"}:
                        </span>
                        <span className="leading-relaxed text-slate-200">{lastMessage.content}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : null}
          </main>

          {/* Google Meet Slide-Over Side Drawer (Chat / People / Info) */}
          {activeTab && (
            <aside className="w-80 sm:w-96 flex flex-col bg-[#2d3033] border-l border-slate-700/80 shadow-2xl z-30 animate-in slide-in-from-right duration-200">
              {/* Drawer Header */}
              <div className="flex h-14 items-center justify-between px-4 border-b border-slate-700">
                <h3 className="text-sm font-bold text-white capitalize">
                  {activeTab === "chat" ? "In-Call Messages" : activeTab === "people" ? `Board Members (${boardMembers.length})` : "Meeting Details"}
                </h3>
                <button
                  onClick={() => setActiveTab(null)}
                  className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {activeTab === "chat" && (
                  <div className="flex flex-col h-full justify-between">
                    <div className="space-y-3 overflow-y-auto pr-1 max-h-[calc(100vh-250px)]">
                      {chat.map((item, index) => (
                        <div key={index} className={`flex flex-col ${item.role === "user" ? "items-end" : "items-start"}`}>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1">
                            <span className="font-semibold text-slate-300">
                              {item.role === "user" ? "You" : item.panelist?.name || "Panel Reviewer"}
                            </span>
                          </div>
                          <div className={`max-w-[90%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                            item.role === "user"
                              ? "bg-teal-600 text-white rounded-br-xs"
                              : "bg-[#3c4043] text-slate-200 rounded-bl-xs border border-slate-600/50"
                          }`}>
                            {item.content}
                          </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Chat Input */}
                    <div className="mt-3 pt-3 border-t border-slate-700">
                      <div className="flex gap-2">
                        <Textarea
                          ref={textareaRef}
                          value={message}
                          onFocus={() => {
                            clearAutoSubmitTimers();
                            if (dictationEnabled) {
                              stopDictation();
                            }
                          }}
                          onChange={(e) => {
                            clearAutoSubmitTimers();
                            if (dictationEnabled) {
                              stopDictation();
                            }
                            setMessage(e.target.value);
                            speechTranscriptRef.current = e.target.value;
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSend();
                            }
                          }}
                          placeholder="Send a response..."
                          rows={2}
                          className="bg-[#3c4043] border-slate-600 text-xs text-white resize-none rounded-xl focus:border-teal-400"
                        />
                        <Button
                          onClick={() => handleSend()}
                          disabled={!message.trim() || busy || tutorMutation.isPending || completing || panelSpeaking}
                          size="icon"
                          className="h-10 w-10 shrink-0 rounded-xl bg-teal-600 text-white hover:bg-teal-700"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "people" && (
                  <div className="space-y-2">
                    {boardMembers.map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[#3c4043] border border-slate-600/50">
                        <div>
                          <div className="text-xs font-bold text-white">{m.name}</div>
                          <div className="text-[10px] text-teal-400">{m.title}</div>
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                          m.gender === "FEMALE" ? "bg-rose-500/20 text-rose-300" : "bg-teal-500/20 text-teal-300"
                        }`}>
                          {m.gender === "FEMALE" ? "♀ Female" : "♂ Male"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "info" && (
                  <div className="space-y-3 text-xs text-slate-300">
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-[11px] leading-relaxed">
                      <div className="font-semibold text-amber-300 mb-1 flex items-center gap-1.5">
                        <Info className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                        <span>Disclaimer</span>
                      </div>
                      <p>
                        <strong>Note:</strong> The panelists and subject matter experts (SMEs) shown are included for demonstration purposes only (AI ENABLED). They are not members of our panel, and their inclusion does not imply affiliation or endorsement.
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#3c4043] border border-slate-600/50">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Exam Track</div>
                      <div className="font-semibold text-white mt-0.5">{examTrack?.name || sessionData.examId}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#3c4043] border border-slate-600/50">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Current Phase</div>
                      <div className="font-semibold text-white mt-0.5">{INTERVIEW_PHASE_CONFIGS[currentPhase]?.name}</div>
                      <div className="text-[11px] text-teal-400 mt-1">{phaseConfig.focus}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-[#3c4043] border border-slate-600/50">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Storage Destination</div>
                      <div className="font-semibold text-emerald-400 mt-0.5">Utho Cloud (innoida.utho.io)</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">PostgreSQL Table: interview_recordings</div>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>

        {/* Google Meet Floating Control Bar (Docked at Bottom) */}
        <footer className="flex h-20 items-center justify-between px-4 sm:px-8 border-t border-slate-800/80 bg-[#202124] shrink-0 z-20">
          {/* Left: Meeting Time & Status */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400">
            <span className="font-semibold text-white tracking-wide">
              {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span>|</span>
            <span className="line-clamp-1">{sessionData.topic}</span>
          </div>

          {/* Center: Meeting Controls matching Google Meet UI */}
          <div className="flex items-center gap-2 sm:gap-3 mx-auto sm:mx-0">
            {/* Mic Toggle */}
            <Button
              type="button"
              variant={dictationEnabled ? "destructive" : "secondary"}
              size="icon"
              onClick={toggleMic}
              disabled={panelSpeaking}
              className={`h-11 w-11 rounded-full transition-all ${
                dictationEnabled
                  ? "bg-rose-600 hover:bg-rose-700 text-white"
                  : "bg-[#3c4043] hover:bg-[#4a4e52] text-white"
              }`}
              title={dictationEnabled ? "Turn off microphone" : "Turn on microphone"}
            >
              {dictationEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </Button>

            {/* Camera Toggle */}
            <Button
              type="button"
              variant={cameraEnabled ? "default" : "secondary"}
              size="icon"
              onClick={toggleCamera}
              className={`h-11 w-11 rounded-full transition-all ${
                cameraEnabled
                  ? "bg-teal-600 hover:bg-teal-700 text-white"
                  : "bg-[#3c4043] hover:bg-[#4a4e52] text-white"
              }`}
              title={cameraEnabled ? "Turn off camera" : "Turn on camera"}
            >
              {cameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>

            {/* Captions / Subtitles Toggle (CC) */}
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => setCaptionsEnabled((prev) => !prev)}
              className={`h-11 w-11 rounded-full font-bold text-xs transition-all ${
                captionsEnabled
                  ? "bg-teal-500/30 text-teal-300 border border-teal-500/50"
                  : "bg-[#3c4043] hover:bg-[#4a4e52] text-white"
              }`}
              title="Turn on/off captions"
            >
              CC
            </Button>

            {/* Voice Audio synthesis toggle */}
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => setTtsEnabled((prev) => !prev)}
              className={`h-11 w-11 rounded-full transition-all ${
                ttsEnabled
                  ? "bg-teal-600 text-white hover:bg-teal-700"
                  : "bg-[#3c4043] hover:bg-[#4a4e52] text-slate-400"
              }`}
              title={ttsEnabled ? "Board voices enabled" : "Board voices muted"}
            >
              <Volume2 className="h-5 w-5" />
            </Button>

            {/* Skip / Next Question Button */}
            <Button
              type="button"
              variant="secondary"
              onClick={handleSkip}
              disabled={busy || tutorMutation.isPending || panelSpeaking}
              className="h-11 px-3 sm:px-4 rounded-full bg-[#3c4043] hover:bg-[#4a4e52] text-slate-200 hover:text-white text-xs font-medium border border-slate-600/60 transition-all flex items-center gap-1.5"
              title="Pass / Move to next question"
            >
              <SkipForward className="h-4 w-4 text-amber-400" />
              <span className="hidden sm:inline">Skip Question</span>
            </Button>

            {/* Conclude / End Call Button (Red pill button) */}
            <Button
              type="button"
              variant="destructive"
              onClick={handleFinish}
              disabled={completing || completeMutation.isPending}
              className="h-11 px-5 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-md transition-all ml-1 sm:ml-2 flex items-center gap-2"
              title="End Interview & Evaluate"
            >
              {completing || completeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PhoneOff className="h-4 w-4" />
              )}
              <span>{completing ? "Saving..." : "End Call & Result"}</span>
            </Button>
          </div>

          {/* Right: Drawer Tab Toggles (Info, People, Chat) */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setActiveTab(activeTab === "info" ? null : "info")}
              className={`h-10 w-10 rounded-full text-slate-300 hover:text-white hover:bg-white/10 ${
                activeTab === "info" ? "bg-white/20 text-white" : ""
              }`}
              title="Meeting details"
            >
              <Info className="h-5 w-5" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setActiveTab(activeTab === "people" ? null : "people")}
              className={`h-10 w-10 rounded-full text-slate-300 hover:text-white hover:bg-white/10 ${
                activeTab === "people" ? "bg-white/20 text-white" : ""
              }`}
              title="Board members"
            >
              <Users className="h-5 w-5" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setActiveTab(activeTab === "chat" ? null : "chat")}
              className={`h-10 w-10 rounded-full text-slate-300 hover:text-white hover:bg-white/10 relative ${
                activeTab === "chat" ? "bg-white/20 text-white" : ""
              }`}
              title="In-call messages"
            >
              <MessageSquare className="h-5 w-5" />
              {chat.length > 0 && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-teal-400" />
              )}
            </Button>
          </div>
        </footer>

        {/* Meeting End Conclusion Modal Dialog */}
        {showMeetingEndDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in-0 duration-200">
            <div className="relative w-full max-w-lg rounded-3xl bg-[#2d3033] border border-slate-700/80 p-6 sm:p-8 shadow-2xl text-center space-y-5 animate-in zoom-in-95 duration-200">
              {/* Header Icon */}
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-inner">
                <Trophy className="h-8 w-8 text-teal-400" />
              </div>

              {/* Title & Description */}
              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Meeting Concluded
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
                  You have successfully answered all <span className="font-semibold text-teal-400">5 interview questions</span> with the Board. Your session recording and responses have been secured.
                </p>
              </div>

              {/* Summary Checklist */}
              <div className="rounded-2xl bg-[#202124] border border-slate-700/60 p-4 text-left space-y-2.5 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>5 Board Interview Questions Completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Audio & Video Session Stored in Utho Cloud</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Comprehensive 360° Evaluation & Scorecard Ready</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <Button
                  type="button"
                  onClick={handleFinish}
                  disabled={completing || completeMutation.isPending}
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-bold text-sm shadow-lg shadow-teal-900/40 transition-all flex items-center justify-center gap-2"
                >
                  {completing || completeMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Generating Scorecard...</span>
                    </>
                  ) : (
                    <>
                      <Trophy className="h-4 w-4" />
                      <span>Conclude & View Full Score</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

