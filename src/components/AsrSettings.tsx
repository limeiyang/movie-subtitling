import { useState, useEffect } from "react";
import { Button, Card, Radio, Select, Typography, Space, Input, Divider, Alert, Modal, Tag, Progress, message } from "antd";
import { FolderOpenOutlined, DownloadOutlined, WarningOutlined, InfoCircleOutlined, PlayCircleOutlined, ClockCircleOutlined, ThunderboltOutlined, SaveOutlined } from "@ant-design/icons";
import { useAppStore } from "../store/useAppStore";

const { Title, Text } = Typography;
const { Option } = Select;

interface AsrSettingsProps {
  onNext: () => void;
  onBack: () => void;
}

type AsrMode = "local" | "cloud";

function AsrSettings({ onNext, onBack }: AsrSettingsProps) {
  const { originalSegments, audioPath, whisperModelsPath, detectedLanguage, videoPath, setWhisperModelsPath, setOriginalSegments, setDetectedLanguage } = useAppStore();
  
  const loadSettings = () => {
    const savedMode = localStorage.getItem("asr_mode") as AsrMode || "local";
    const savedModelPath = localStorage.getItem("asr_model_path") || null;
    const savedModelFile = localStorage.getItem("asr_model_file") || "";
    const savedApiKey = localStorage.getItem("asr_api_key") || "";
    return { savedMode, savedModelPath, savedModelFile, savedApiKey };
  };

  const loadSpeedStats = () => {
    const totalProcessed = parseFloat(localStorage.getItem("asr_total_processed_seconds") || "0");
    const totalProcessing = parseFloat(localStorage.getItem("asr_total_processing_seconds") || "0");
    const numRuns = parseInt(localStorage.getItem("asr_num_runs") || "0");
    return { totalProcessed, totalProcessing, numRuns };
  };

  const saveSpeedStats = (audioDuration: number, processingTime: number) => {
    const { totalProcessed, totalProcessing, numRuns } = loadSpeedStats();
    const newTotalProcessed = totalProcessed + audioDuration;
    const newTotalProcessing = totalProcessing + processingTime;
    const newNumRuns = numRuns + 1;
    localStorage.setItem("asr_total_processed_seconds", newTotalProcessed.toString());
    localStorage.setItem("asr_total_processing_seconds", newTotalProcessing.toString());
    localStorage.setItem("asr_num_runs", newNumRuns.toString());
    return { totalProcessed: newTotalProcessed, totalProcessing: newTotalProcessing, numRuns: newNumRuns };
  };

  const calculateAverageSpeed = () => {
    const { totalProcessed, totalProcessing, numRuns } = loadSpeedStats();
    if (numRuns === 0 || totalProcessing === 0) {
      return { speed: 0, totalProcessed: 0, totalProcessing: 0, numRuns: 0 };
    }
    const speed = totalProcessed / totalProcessing; // 每秒处理的音频时长
    return { speed, totalProcessed, totalProcessing, numRuns };
  };

  const { savedMode, savedModelPath, savedModelFile, savedApiKey } = loadSettings();

  const [mode, setMode] = useState<AsrMode>(savedMode);
  const [selectedModelFile, setSelectedModelFile] = useState<string>(savedModelFile);
  const [apiKey, setApiKey] = useState(savedApiKey);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [showPathModal, setShowPathModal] = useState(false);
  const [manualPath, setManualPath] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [transcribeStep, setTranscribeStep] = useState("");
  const [progressDots, setProgressDots] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(0);
  const [subtitleSavePath, setSubtitleSavePath] = useState<string>("");
  const [isTauriAvailable, setIsTauriAvailable] = useState(false);

  useEffect(() => {
    // 检测是否在 Tauri 环境中
    try {
      import("@tauri-apps/api/core").then(() => {
        setIsTauriAvailable(true);
      }).catch(() => {
        setIsTauriAvailable(false);
      });
    } catch {
      setIsTauriAvailable(false);
    }
  }, []);

  useEffect(() => {
    const savedPath = localStorage.getItem("subtitle_save_path");
    if (savedPath) {
      setSubtitleSavePath(savedPath);
    }
  }, []);

  useEffect(() => {
    if (savedModelPath && !whisperModelsPath) {
      setWhisperModelsPath(savedModelPath);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("asr_mode", mode);
  }, [mode]);

  useEffect(() => {
    if (whisperModelsPath) {
      localStorage.setItem("asr_model_path", whisperModelsPath);
    }
  }, [whisperModelsPath]);

  useEffect(() => {
    localStorage.setItem("asr_model_file", selectedModelFile);
  }, [selectedModelFile]);

  useEffect(() => {
    localStorage.setItem("asr_api_key", apiKey);
  }, [apiKey]);

  useEffect(() => {
    const getDuration = async () => {
      if (!audioPath || !isTauriAvailable) return;
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const duration = await invoke<number>("get_audio_duration", { audioPath: audioPath });
        setAudioDuration(duration);
        
        const { speed, numRuns } = calculateAverageSpeed();
        if (speed > 0 && numRuns > 0) {
          const estimated = duration / speed;
          setEstimatedTime(estimated);
        } else {
          // 如果没有统计数据，使用默认估计
          setEstimatedTime(duration * 0.5);
        }
      } catch (error) {
        console.log("Failed to get audio duration:", error);
        setEstimatedTime(0);
      }
    };
    getDuration();
  }, [audioPath]);

  const getLanguageName = (code: string): string => {
    const langMap: Record<string, string> = {
      "en": "英语",
      "zh": "中文",
      "ja": "日语",
      "ko": "韩语",
      "fr": "法语",
      "de": "德语",
      "es": "西班牙语",
      "ru": "俄语",
      "pt": "葡萄牙语",
      "ar": "阿拉伯语",
      "hi": "印地语",
      "th": "泰语",
      "vi": "越南语",
      "id": "印尼语",
      "ms": "马来语",
      "tl": "他加禄语",
      "it": "意大利语",
      "nl": "荷兰语",
      "pl": "波兰语",
      "uk": "乌克兰语",
      "el": "希腊语",
      "tr": "土耳其语",
      "fa": "波斯语",
      "ur": "乌尔都语",
      "bn": "孟加拉语",
      "gu": "古吉拉特语",
      "mr": "马拉地语",
      "ta": "泰米尔语",
      "te": "泰卢固语",
      "kn": "卡纳达语",
      "ml": "马拉雅拉姆语",
      "pa": "旁遮普语",
      "or": "奥里雅语",
      "si": "僧伽罗语",
      "my": "缅甸语",
      "km": "高棉语",
      "lo": "老挝语",
      "ne": "尼泊尔语",
      "ps": "普什图语",
      "sd": "信德语",
      "bal": "俾路支语",
      "ks": "克什米尔语",
      "brx": "博多语",
      "mni": "曼尼普尔语",
      "san": "梵语",
      "und": "未知",
    };
    return langMap[code] || code;
  };

  useEffect(() => {
    if (whisperModelsPath) {
      checkModelFiles();
    }
  }, [whisperModelsPath]);

  const checkModelFiles = async () => {
    if (!whisperModelsPath || !isTauriAvailable) return;
    
    setIsChecking(true);
    
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const status = await invoke<Record<string, string>>("check_model_files", {
        modelsPath: whisperModelsPath,
        models: []
      });
      
      const hasSafetensors = status["_safetensors_detected"] === "true";
      const modelList = Object.keys(status).filter(k => k !== "_safetensors_detected");
      
      setAvailableModels(modelList);
      
      if (hasSafetensors && modelList.length === 0) {
        message.warning("检测到 safetensors 格式的模型文件，但本应用需要 ggml 格式的 .bin 文件！请下载 Whisper.cpp 格式的模型。");
      }
      
      if (modelList.length > 0 && !selectedModelFile) {
        setSelectedModelFile(modelList[0]);
      }
    } catch (error) {
      console.log("Cannot check model files in web mode");
      setAvailableModels(["ggml-base.bin", "ggml-small.bin"]);
      setSelectedModelFile("ggml-base.bin");
    }
    
    setIsChecking(false);
  };

  const handleSelectModelsPath = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const path = await invoke<string>("select_models_directory");
      setWhisperModelsPath(path);
    } catch (error) {
      console.log("Tauri dialog not available, showing manual input");
      setShowPathModal(true);
    }
  };

  const handleSaveManualPath = () => {
    setWhisperModelsPath(manualPath);
    setShowPathModal(false);
  };

  const handleTranscribe = async () => {
    if (!audioPath) {
      message.error("请先提取音频！");
      return;
    }

    if (mode === "local" && !whisperModelsPath) {
      message.error("请先选择模型目录！");
      return;
    }

    if (mode === "local" && !selectedModelFile) {
      message.error("请先选择模型文件！");
      return;
    }

    if (mode === "cloud" && !apiKey) {
      message.error("请输入 API Key！");
      return;
    }

    setIsTranscribing(true);
    setTranscribeProgress(0);
    setTranscribeStep("正在加载模型");
    setProgressDots(1);

    let dotInterval: ReturnType<typeof setInterval>;
    dotInterval = setInterval(() => {
      setProgressDots(prev => (prev % 4) + 1);
    }, 500);

    const updateProgress = (step: string, progress: number) => {
      setTranscribeStep(step);
      setTranscribeProgress(progress);
    };

    const transcribeStartTime = Date.now();
    const initialSetupTime = 1.5; // 预估的初始加载时间（秒）
    const totalEstimatedTime = estimatedTime > 0 ? estimatedTime + initialSetupTime : 30;
    
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      
      await new Promise(resolve => setTimeout(resolve, 200));
      updateProgress("正在读取音频文件", 5);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      updateProgress("正在加载模型文件", 10);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      updateProgress("正在初始化模型", 15);

      const resultPromise = invoke<{
        segments: Array<{
          index: number;
          start: number;
          end: number;
          originalText: string;
          translatedText: string | null;
        }>;
        detected_language: string;
        processing_duration: number;
      }>("transcribe_audio", {
        audioPath: audioPath,
        model: selectedModelFile,
        modelsPath: mode === "local" ? whisperModelsPath : null,
        useCloud: mode === "cloud",
        apiKey: mode === "cloud" ? apiKey : null
      });

      // 基于时间的进度条，前15%是初始化阶段，后85%是转写阶段
      const progressInterval = setInterval(() => {
        const elapsed = (Date.now() - transcribeStartTime) / 1000;
        const progress = Math.min(
          90, 
          15 + Math.min(75, (elapsed / totalEstimatedTime) * 85)
        );
        setTranscribeProgress(progress);
      }, 100);

      const result = await resultPromise;
      clearInterval(progressInterval);

      updateProgress("正在处理结果", 95);

      await new Promise(resolve => setTimeout(resolve, 300));

      const formattedSegments = result.segments.map((s, idx) => ({
        index: idx,
        start: s.start,
        end: s.end,
        originalText: s.originalText,
        translatedText: s.translatedText || undefined,
      }));

      setOriginalSegments(formattedSegments);
      setDetectedLanguage(result.detected_language);
      updateProgress("转写完成", 100);
      
      // 保存处理速度数据
      const { totalProcessed, totalProcessing, numRuns } = saveSpeedStats(
        audioDuration || 0, 
        result.processing_duration
      );
      
      // 自动保存字幕文件
      if (subtitleSavePath && isTauriAvailable) {
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          const defaultFileName = `subtitles_${Date.now()}.srt`;
          const fullPath = subtitleSavePath + "/" + defaultFileName;
          
          await invoke("export_srt", {
            segments: formattedSegments.map(s => ({
              index: s.index,
              start: s.start,
              end: s.end,
              originalText: s.originalText,
              translatedText: s.translatedText || null
            })),
            outputPath: fullPath,
            mode: "original"
          });
          
          console.log("字幕已自动保存到:", fullPath);
        } catch (saveError) {
          console.error("自动保存字幕失败:", saveError);
        }
      }
      
      const langName = getLanguageName(result.detected_language);
      const actualSpeed = audioDuration > 0 ? (audioDuration / result.processing_duration).toFixed(2) : "-";
      const avgSpeed = totalProcessed > 0 && totalProcessing > 0 ? (totalProcessed / totalProcessing).toFixed(2) : "-";
      message.success(`成功转写 ${formattedSegments.length} 条字幕！检测到语言：${langName} (${result.detected_language}) | 本次速度: ${actualSpeed}x | 平均: ${avgSpeed}x (${numRuns}次)`);

    } catch (error) {
      console.error("Transcription failed:", error);
      const errorMsg = (error as any).message || (error as any).toString() || JSON.stringify(error);
      message.error("转写失败：" + errorMsg);
    } finally {
      clearInterval(dotInterval);
      setTimeout(() => {
        setIsTranscribing(false);
        setTranscribeProgress(0);
        setTranscribeStep("");
        setProgressDots(0);
      }, 1000);
    }
  };

  const handleSaveOriginalSrt = async () => {
    if (originalSegments.length === 0 || !isTauriAvailable) {
      return;
    }

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      
      let defaultPath = "";
      if (videoPath && !videoPath.startsWith("web-mode")) {
        const dir = videoPath.substring(0, videoPath.lastIndexOf("/"));
        const name = videoPath.substring(videoPath.lastIndexOf("/") + 1).replace(/\.[^/.]+$/, "");
        defaultPath = dir + "/" + name + "_original.srt";
      }

      const savePath = await invoke<string>("select_save_path", {
        defaultPath: defaultPath,
        filterName: "SRT Files",
        filterExt: "srt"
      });

      if (!savePath) {
        return;
      }

      const segmentsToExport = originalSegments.map(s => ({
        index: s.index,
        start: s.start,
        end: s.end,
        originalText: s.originalText,
        translatedText: s.translatedText || null
      }));

      await invoke("export_srt", {
        segments: segmentsToExport,
        outputPath: savePath,
        mode: "original"
      });

      message.success("原始字幕已保存！");
    } catch (error) {
      console.error("Failed to save SRT:", error);
      message.error("保存失败：" + (error as any).message);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <Card>
        <Title level={3} style={{ marginBottom: 24 }}>ASR 设置（可选）</Title>

        {isTranscribing && (
          <Card type="inner" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Text strong>{transcribeStep}</Text>
              <span style={{ fontSize: 18, color: "#1890ff" }}>
                {".".repeat(progressDots)}
                {" ".repeat(4 - progressDots)}
              </span>
            </div>
            {estimatedTime > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#8c8c8c" }}>
                预估时间: {estimatedTime.toFixed(1)}s | 音频时长: {audioDuration > 0 ? (audioDuration / 60).toFixed(2) + "分钟" : "-"}
              </div>
            )}
            {!estimatedTime && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#8c8c8c" }}>
                请稍候，正在处理中...
              </div>
            )}
            <Progress 
              percent={Math.round(transcribeProgress)} 
              style={{ marginTop: 16 }}
              strokeColor={{
                '0%': '#10b981',
                '50%': '#3b82f6',
                '100%': '#8b5cf6',
              }}
              showInfo
            />
          </Card>
        )}

        {originalSegments.length > 0 && !isTranscribing && (
          <Alert
            message={`已准备好 ${originalSegments.length} 条字幕片段`}
            description={detectedLanguage ? `检测到语言：${getLanguageName(detectedLanguage)} (${detectedLanguage})` : undefined}
            type="success"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)} style={{ marginBottom: 24, display: "block" }}>
          <Space direction="vertical">
            <Radio value="local">本地模式 (使用 Whisper)</Radio>
            <Radio value="cloud">云服务模式 (OpenAI Whisper API)</Radio>
          </Space>
        </Radio.Group>

        {mode === "local" && (
          <Card type="inner" style={{ marginBottom: 24 }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Text strong>模型文件目录：</Text>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Input
                  value={whisperModelsPath || "未选择"}
                  style={{ flex: 1 }}
                  disabled
                  placeholder="请选择模型文件所在目录"
                  prefix={isChecking ? <InfoCircleOutlined spin /> : null}
                />
                <Button
                  type="default"
                  icon={<FolderOpenOutlined />}
                  onClick={handleSelectModelsPath}
                >
                  选择目录
                </Button>
                {whisperModelsPath && (
                  <Button onClick={checkModelFiles}>刷新检测</Button>
                )}
              </div>
              
              {!whisperModelsPath && (
                <Alert
                  message="请先选择包含 Whisper 模型文件的目录"
                  type="warning"
                  showIcon
                  description="如果是浏览器环境，请手动输入模型文件路径"
                />
              )}

              {whisperModelsPath && availableModels.length > 0 && (
                <Alert
                  message={`已检测到 ${availableModels.length} 个模型`}
                  type="success"
                  showIcon
                  description={
                    <Space wrap>
                      {availableModels.map(key => (
                        <Tag color="green" key={key}>
                          {key}
                        </Tag>
                      ))}
                    </Space>
                  }
                />
              )}

              {whisperModelsPath && availableModels.length === 0 && !isChecking && (
                <Alert
                  message="目录中未检测到模型文件"
                  type="warning"
                  showIcon
                />
              )}

              {whisperModelsPath && (
                <>
                  <Text strong>选择模型：</Text>
                  <Select
                    value={selectedModelFile}
                    onChange={(value) => setSelectedModelFile(value)}
                    style={{ width: "100%" }}
                    loading={isChecking}
                  >
                    {availableModels.map(modelFile => (
                      <Option value={modelFile} key={modelFile}>
                        {modelFile}
                      </Option>
                    ))}
                  </Select>

                  {audioDuration > 0 && (
                    <Card type="inner" title="预估信息" size="small" style={{ marginTop: 16 }}>
                      <Text type="secondary">
                        <ClockCircleOutlined /> 音频时长: {(audioDuration / 60).toFixed(2)} 分钟
                      </Text>
                      <br />
                      {(() => {
                        const { speed, numRuns } = calculateAverageSpeed();
                        if (numRuns > 0 && speed > 0) {
                          const estTime = audioDuration / speed;
                          return (
                            <>
                              <Text type="secondary">
                                <ThunderboltOutlined /> 平均速度: {speed.toFixed(2)}x ({numRuns} 次历史数据)
                              </Text>
                              <br />
                              <Text type="secondary">
                                <ClockCircleOutlined /> 预估转写时间: {estTime.toFixed(1)} 秒
                              </Text>
                            </>
                          );
                        } else if (audioDuration > 0) {
                          const defaultEstimate = audioDuration * 0.5;
                          return (
                            <Text type="secondary">
                              <ThunderboltOutlined /> 预估转写时间: ~{defaultEstimate.toFixed(1)} 秒 (初次运行，无历史数据)
                            </Text>
                          );
                        }
                        return null;
                      })()}
                    </Card>
                  )}

                  {availableModels.length === 0 && (
                    <Card type="inner" title="模型下载" size="small">
                      <Text type="secondary">
                        模型文件需要单独下载。请下载 <strong>Whisper.cpp 格式</strong> 的模型（.bin 文件），推荐先下载 base 模型（约 150 MB）：
                      </Text>
                      <br />
                      <a
                        href="https://huggingface.co/ggerganov/whisper.cpp/tree/main"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8 }}
                      >
                        <DownloadOutlined />
                        从 Hugging Face 下载 Whisper.cpp 模型
                      </a>
                      <Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                        <WarningOutlined /> 注意：本应用不支持 Hugging Face 的 .safetensors 格式模型
                      </Text>
                      <Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                        下载后点击"刷新检测"按钮
                      </Text>
                    </Card>
                  )}
                </>
              )}
            </Space>
          </Card>
        )}

        {mode === "cloud" && (
          <Card type="inner" style={{ marginBottom: 24 }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Text strong>OpenAI API Key：</Text>
              <Input.Password
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{ width: "100%" }}
              />
              <Text type="secondary">
                使用云服务可以获得最高精度，但需要网络连接并产生费用
              </Text>
            </Space>
          </Card>
        )}

        <Divider />

        <Space>
          <Button onClick={onBack}>返回</Button>
          {originalSegments.length === 0 ? (
            <Button
              type="primary"
              onClick={handleTranscribe}
              loading={isTranscribing}
              icon={<PlayCircleOutlined />}
              disabled={isTranscribing || (mode === "local" && !whisperModelsPath) || (mode === "cloud" && !apiKey)}
            >
              开始转写
            </Button>
          ) : (
            <Button
              onClick={handleSaveOriginalSrt}
              icon={<SaveOutlined />}
              disabled={!isTauriAvailable}
            >
              保存原始字幕
            </Button>
          )}
          <Button type="primary" onClick={onNext}>
            下一步：翻译字幕
          </Button>
        </Space>
      </Card>

      <Modal
        title="手动输入模型目录"
        open={showPathModal}
        onOk={handleSaveManualPath}
        onCancel={() => setShowPathModal(false)}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Text type="secondary">
            由于是浏览器环境，请手动输入模型文件的完整路径：
          </Text>
          <Input
            placeholder="/Users/xxx/models"
            value={manualPath}
            onChange={(e) => setManualPath(e.target.value)}
          />
        </Space>
      </Modal>
    </div>
  );
}

export default AsrSettings;
