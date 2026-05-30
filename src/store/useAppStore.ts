import { create } from "zustand";

export interface SubtitleSegment {
  index: number;
  start: number;
  end: number;
  originalText: string;
  translatedText?: string;
}

export interface TranslationResult {
  id: string;
  promptId: string;
  promptName: string;
  result: SubtitleSegment[];
  timestamp: number;
}

interface AppState {
  // 视频文件
  videoFile: File | null;
  videoPath: string | null;
  audioPath: string | null;
  
  // Whisper 模型配置
  whisperModelsPath: string | null;
  
  // ASR 配置
  asrLanguage: string | null;  // 用户选择的 ASR 语言
  
  // ASR 结果
  originalSegments: SubtitleSegment[];
  detectedLanguage: string | null;
  
  // 翻译历史
  translationHistory: TranslationResult[];
  
  // 当前视图状态
  currentStep: number;
  currentLeftHistoryIndex: number;
  currentRightHistoryIndex: number;
  
  // 方法
  setVideoFile: (file: File | null, path: string | null) => void;
  setAudioPath: (path: string | null) => void;
  setWhisperModelsPath: (path: string | null) => void;
  setAsrLanguage: (lang: string | null) => void;
  setOriginalSegments: (segments: SubtitleSegment[]) => void;
  setDetectedLanguage: (lang: string | null) => void;
  addTranslation: (result: TranslationResult) => void;
  updateTranslation: (index: number, result: SubtitleSegment[]) => void;
  setCurrentStep: (step: number) => void;
  setLeftHistoryIndex: (index: number) => void;
  setRightHistoryIndex: (index: number) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  videoFile: null,
  videoPath: null,
  audioPath: null,
  whisperModelsPath: null,
  asrLanguage: null,
  originalSegments: [],
  detectedLanguage: null,
  translationHistory: [],
  currentStep: 0,
  currentLeftHistoryIndex: -1,
  currentRightHistoryIndex: -1,
  
  setVideoFile: (file, path) => set({ videoFile: file, videoPath: path }),
  setAudioPath: (path) => set({ audioPath: path }),
  setWhisperModelsPath: (path) => set({ whisperModelsPath: path }),
  setAsrLanguage: (lang) => set({ asrLanguage: lang }),
  setOriginalSegments: (segments) => set({ originalSegments: segments }),
  setDetectedLanguage: (lang) => set({ detectedLanguage: lang }),
  addTranslation: (result) => set((state) => ({ 
    translationHistory: [...state.translationHistory, result],
    currentLeftHistoryIndex: -1,
    currentRightHistoryIndex: state.translationHistory.length
  })),
  updateTranslation: (index, result) => set((state) => {
    const newHistory = [...state.translationHistory];
    newHistory[index] = { ...newHistory[index], result };
    return { translationHistory: newHistory };
  }),
  setCurrentStep: (step) => set({ currentStep: step }),
  setLeftHistoryIndex: (index) => set({ currentLeftHistoryIndex: index }),
  setRightHistoryIndex: (index) => set({ currentRightHistoryIndex: index }),
  reset: () => set({
    videoFile: null,
    videoPath: null,
    audioPath: null,
    whisperModelsPath: null,
    asrLanguage: null,
    originalSegments: [],
    detectedLanguage: null,
    translationHistory: [],
    currentStep: 0,
    currentLeftHistoryIndex: -1,
    currentRightHistoryIndex: -1
  })
}));
