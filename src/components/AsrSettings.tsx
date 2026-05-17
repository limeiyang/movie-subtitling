import { useState } from "react";
import { Button, Card, Radio, Select, Typography, Space, Input, Divider, Progress, Alert } from "antd";
import { useAppStore } from "../store/useAppStore";
import { invoke } from "@tauri-apps/api/core";

const { Title, Text } = Typography;
const { Option } = Select;

interface AsrSettingsProps {
  onNext: () => void;
  onBack: () => void;
}

type AsrMode = "local" | "cloud";
type WhisperModel = "tiny" | "base" | "small" | "medium";

function AsrSettings({ onNext, onBack }: AsrSettingsProps) {
  const { originalSegments, setOriginalSegments, videoPath, setAudioPath } = useAppStore();
  const [mode, setMode] = useState<AsrMode>("local");
  const [model, setModel] = useState<WhisperModel>("base");
  const [apiKey, setApiKey] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<"idle" | "extracting" | "transcribing">("idle");

  const modelSpeedInfo: Record<WhisperModel, { factor: string; estimate: string }> = {
    tiny: { factor: "~10x", estimate: "约 6 秒/分钟" },
    base: { factor: "~6x", estimate: "约 10 秒/分钟" },
    small: { factor: "~2x", estimate: "约 30 秒/分钟" },
    medium: { factor: "~0.5x", estimate: "约 2 分钟/分钟" }
  };

  const handleProcess = async () => {
    if (!videoPath) {
      return;
    }

    setIsProcessing(true);
    setStep("extracting");
    setProgress(0);

    try {
      // 第一步：提取音频
      const audioPath = await invoke<string>("extract_audio", { videoPath });
      setAudioPath(audioPath);
      setProgress(50);

      // 第二步：ASR 转写
      setStep("transcribing");
      
      const segments = await invoke<Array<{
        index: number;
        start: number;
        end: number;
        original_text: string;
        translated_text: string | null;
      }>>("transcribe_audio", {
        audioPath,
        model,
        useCloud: mode === "cloud",
        apiKey: mode === "cloud" ? apiKey : null,
      });

      // 转换数据格式
      const formattedSegments = segments.map((s) => ({
        index: s.index,
        start: s.start,
        end: s.end,
        originalText: s.original_text,
        translatedText: s.translated_text,
      }));

      setOriginalSegments(formattedSegments);
      setProgress(100);

      setTimeout(() => {
        setIsProcessing(false);
      }, 500);
    } catch (error) {
      console.error("Processing failed:", error);
      setIsProcessing(false);
      setStep("idle");
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <Card>
        <Title level={3} style={{ marginBottom: 24 }}>语音转文字 (ASR)</Title>

        <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)} style={{ marginBottom: 24, display: "block" }}>
          <Space direction="vertical">
            <Radio value="local">本地模式 (使用 Whisper)</Radio>
            <Radio value="cloud">云服务模式 (OpenAI Whisper API)</Radio>
          </Space>
        </Radio.Group>

        {mode === "local" && (
          <Card type="inner" style={{ marginBottom: 24 }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Text strong>选择模型：</Text>
              <Select
                value={model}
                onChange={setModel}
                style={{ width: 200 }}
              >
                <Option value="tiny">Tiny (最快，精度较低)</Option>
                <Option value="base">Base (推荐，速度精度平衡)</Option>
                <Option value="small">Small (精度较高，较慢)</Option>
                <Option value="medium">Medium (最高精度，很慢)</Option>
              </Select>
              <Alert
                message={`预估速度：${modelSpeedInfo[model].factor} 实时，${modelSpeedInfo[model].estimate}`}
                type="info"
                showIcon
              />
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

        {isProcessing && (
          <div style={{ marginBottom: 24 }}>
            <Progress percent={progress} status="active" />
            <Text type="secondary">
              {step === "extracting" ? "正在提取音频..." : "正在转写文字..."}
            </Text>
          </div>
        )}

        {originalSegments.length > 0 && !isProcessing && (
          <Alert
            message={`已生成 ${originalSegments.length} 条字幕片段`}
            type="success"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Divider />

        <Space>
          <Button onClick={onBack}>返回</Button>
          <Button
            type="primary"
            onClick={handleProcess}
            disabled={isProcessing || (mode === "cloud" && !apiKey) || !videoPath}
            loading={isProcessing}
          >
            {originalSegments.length > 0 ? "重新开始" : "开始转写"}
          </Button>
          {originalSegments.length > 0 && !isProcessing && (
            <Button type="primary" onClick={onNext}>
              下一步：翻译字幕
            </Button>
          )}
        </Space>
      </Card>
    </div>
  );
}

export default AsrSettings;
