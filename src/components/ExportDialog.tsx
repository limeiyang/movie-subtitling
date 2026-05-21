import { useState } from "react";
import { Button, Card, Typography, Space, Radio, Divider, Alert, message } from "antd";
import { useAppStore, SubtitleSegment as StoreSubtitleSegment } from "../store/useAppStore";

const { Title, Text } = Typography;

interface ExportDialogProps {
  onBack: () => void;
}

type ExportMode = "translated" | "original" | "bilingual-top-bottom" | "bilingual-left-right";

function ExportDialog({ onBack }: ExportDialogProps) {
  const { translationHistory, originalSegments, currentRightHistoryIndex } = useAppStore();
  const [mode, setMode] = useState<ExportMode>("translated");
  const [exported, setExported] = useState(false);

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

  const downloadSrt = async () => {
    const segments = getSelectedSegments();
    const content = generateSrtContent(segments, mode);

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      
      const defaultPath = `subtitle_${Date.now()}.srt`;
      
      const savePath = await invoke<string>("select_save_path", {
        defaultPath: defaultPath,
        filterName: "SRT Files",
        filterExt: "srt"
      });

      if (!savePath) {
        return;
      }

      await invoke("export_srt", {
        segments: segments.map(s => ({
          index: s.index,
          start: s.start,
          end: s.end,
          originalText: s.originalText,
          translatedText: s.translatedText || null
        })),
        outputPath: savePath,
        mode: mode
      });

      setExported(true);
      message.success(`字幕已导出到：${savePath}`);
    } catch (error) {
      console.error("Export failed:", error);
      message.error("导出失败：" + (error as any).message);
    }
  };

  const segments = getSelectedSegments();
  const previewSegments = segments.slice(0, 3);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <Card>
        <Title level={3} style={{ marginBottom: 24 }}>导出字幕</Title>

        <Space direction="vertical" style={{ width: "100%" }}>
          <Text strong>导出模式：</Text>
          <Radio.Group
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            <Radio value="translated">仅译文</Radio>
            <Radio value="original">仅原文</Radio>
            <Radio value="bilingual-top-bottom">双语字幕 - 上下显示</Radio>
            <Radio value="bilingual-left-right">双语字幕 - 左右对照</Radio>
          </Radio.Group>
        </Space>

        <Divider />

        <Text strong>预览：</Text>
        <Card type="inner" style={{ marginTop: 12, marginBottom: 24 }}>
          {previewSegments.map((seg) => (
            <div key={seg.index} style={{ marginBottom: 16 }}>
              <Text type="secondary">
                {formatTime(seg.start)} → {formatTime(seg.end)}
              </Text>
              <div>
                {mode === "bilingual-top-bottom" ? (
                  <>
                    <div>{seg.originalText}</div>
                    <div style={{ color: "#1890ff" }}>
                      {seg.translatedText || seg.originalText}
                    </div>
                  </>
                ) : mode === "bilingual-left-right" ? (
                  <span>
                    {seg.originalText} | <span style={{ color: "#1890ff" }}>{seg.translatedText || seg.originalText}</span>
                  </span>
                ) : mode === "original" ? (
                  seg.originalText
                ) : (
                  <span style={{ color: "#1890ff" }}>
                    {seg.translatedText || seg.originalText}
                  </span>
                )}
              </div>
            </div>
          ))}
          {segments.length > 3 && (
            <Text type="secondary">... 还有 {segments.length - 3} 条</Text>
          )}
        </Card>

        {exported && (
          <Alert
            message="字幕文件已成功导出！"
            type="success"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Divider />

        <Space>
          <Button onClick={onBack}>返回</Button>
          <Button type="primary" onClick={downloadSrt}>
            下载 SRT 文件
          </Button>
        </Space>
      </Card>
    </div>
  );
}

export default ExportDialog;
