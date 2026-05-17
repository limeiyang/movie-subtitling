import { useState } from "react";
import { Button, Card, Select, Typography, Space, Radio, Divider, Alert, Input } from "antd";
import { useAppStore, SubtitleSegment as StoreSubtitleSegment } from "../store/useAppStore";
import { invoke } from "@tauri-apps/api/core";

const { Title, Text } = Typography;
const { Option } = Select;

interface ExportDialogProps {
  onBack: () => void;
}

type ExportMode = "translated" | "original" | "bilingual-top-bottom" | "bilingual-left-right";

function ExportDialog({ onBack }: ExportDialogProps) {
  const { translationHistory, originalSegments, currentRightHistoryIndex } = useAppStore();
  const [mode, setMode] = useState<ExportMode>("translated");
  const [outputPath, setOutputPath] = useState("");
  const [exported, setExported] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const getSelectedSegments = (): StoreSubtitleSegment[] => {
    if (translationHistory.length === 0) return originalSegments;
    if (currentRightHistoryIndex === -1) return translationHistory[translationHistory.length - 1].result;
    return translationHistory[currentRightHistoryIndex].result;
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
  };

  const generateSrtContent = (segments: StoreSubtitleSegment[], exportMode: ExportMode) => {
    let content = "";

    segments.forEach((seg, index) => {
      content += `${index + 1}\n`;
      content += `${formatTime(seg.start)} --> ${formatTime(seg.end)}\n`;

      switch (exportMode) {
        case "original":
          content += seg.originalText;
          break;
        case "translated":
          content += seg.translatedText || seg.originalText;
          break;
        case "bilingual-top-bottom":
          content += seg.originalText;
          content += "\n";
          content += seg.translatedText || seg.originalText;
          break;
        case "bilingual-left-right":
          content += `${seg.originalText} | ${seg.translatedText || seg.originalText}`;
          break;
        default:
          content += seg.translatedText || seg.originalText;
      }

      content += "\n\n";
    });

    return content;
  };

  const downloadSrt = () => {
    const segments = getSelectedSegments();
    const content = generateSrtContent(segments, mode);

    // 创建下载链接
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `subtitle_${Date.now()}.srt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExported(true);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const segments = getSelectedSegments().map((s) => ({
        index: s.index,
        start: s.start,
        end: s.end,
        original_text: s.originalText,
        translated_text: s.translatedText,
      }));
      
      await invoke("export_srt", {
        segments,
        outputPath,
        mode,
      });
      
      setExported(true);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const previewContent = () => {
    const segments = getSelectedSegments();
    return generateSrtContent(segments.slice(0, 3), mode);
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <Card>
        <Title level={3} style={{ marginBottom: 24 }}>导出字幕</Title>

        <Card type="inner" style={{ marginBottom: 24 }}>
          <Space direction="vertical" style={{ width: "100%" }}>
            <Text strong>导出模式：</Text>
            <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
              <Space direction="vertical">
                <Radio value="translated">仅译文</Radio>
                <Radio value="original">仅原文</Radio>
                <Radio value="bilingual-top-bottom">双语字幕 - 上下显示</Radio>
                <Radio value="bilingual-left-right">双语字幕 - 左右对照</Radio>
              </Space>
            </Radio.Group>
          </Space>
        </Card>

        <Card type="inner" title="预览（前3条）" style={{ marginBottom: 24 }}>
          <pre style={{ 
            background: "#f5f5f5", 
            padding: 16, 
            borderRadius: 4, 
            margin: 0,
            fontSize: 13,
            maxHeight: 300,
            overflow: "auto"
          }}>
            {previewContent()}
          </pre>
        </Card>

        {exported && (
          <Alert
            message="导出成功！"
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
            onClick={downloadSrt}
            loading={isExporting}
          >
            下载 SRT 文件
          </Button>
        </Space>
      </Card>
    </div>
  );
}

export default ExportDialog;
