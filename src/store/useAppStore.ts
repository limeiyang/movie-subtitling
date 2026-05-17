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
  
  // ASR 结果
  originalSegments: SubtitleSegment[];
  
  // 翻译历史
  translationHistory: TranslationResult[];
  
  // 当前视图状态
  currentStep: number;
  currentLeftHistoryIndex: number;
  currentRightHistoryIndex: number;
  
  // 方法
  setVideoFile: (file: File | null, path: string | null) => void;
  setAudioPath: (path: string | null) => void;
  setOriginalSegments: (segments: SubtitleSegment[]) => void;
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
  originalSegments: [],
  translationHistory: [],
  currentStep: 0,
  currentLeftHistoryIndex: -1,
  currentRightHistoryIndex: -1,
  
  setVideoFile: (file, path) => set({ videoFile: file, videoPath: path }),
  setAudioPath: (path) => set({ audioPath: path }),
  setOriginalSegments: (segments) => set({ originalSegments: segments }),
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
    originalSegments: [],
    translationHistory: [],
    currentStep: 0,
    currentLeftHistoryIndex: -1,
    currentRightHistoryIndex: -1
  })
}));
