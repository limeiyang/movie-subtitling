import { useRef, useState, useEffect } from "react";
import { Button, Card, Upload, Typography, Space, message, Progress } from "antd";
import { InboxOutlined, AudioOutlined, FontSizeOutlined } from "@ant-design/icons";
import { useAppStore } from "../store/useAppStore";

const { Dragger } = Upload;
const { Title, Text } = Typography;

interface FileSelectProps {
  onNext: () => void;
}

function FileSelect({ onNext }: FileSelectProps) {
  const { videoFile, videoPath, setVideoFile, setAudioPath, setOriginalSegments } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<"idle" | "extracting" | "transcribing">("idle");
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

  const handleSelectFile = async () => {
    if (isTauriAvailable) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const fileInfo = await invoke<{
          path: string;
          name: string;
          size: number;
        }>("select_video_file");
        
        const file = new File([], fileInfo.name, {
          type: "video/mp4",
        });
        
        Object.defineProperty(file, "size", { value: fileInfo.size });
        
        setVideoFile(file, fileInfo.path);
        message.success("文件选择成功！");
        return;
      } catch (error) {
        console.log("Tauri dialog not available, using fallback");
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isSupported = 
        file.type.startsWith("video/") || 
        file.name.match(/\.(mp4|mkv|avi|mov|flv|wmv)$/i);
      
      if (!isSupported) {
        message.error("只支持视频文件！");
        return;
      }
      
      setVideoFile(file, "web-mode-" + file.name);
      message.success("文件选择成功！");
    }
  };

  const handleProcess = async () => {
    if (!videoFile) return;

    setIsProcessing(true);
    setStep("extracting");
    setProgress(0);

    try {
      if (isTauriAvailable && videoPath && !videoPath.startsWith("web-mode")) {
        // 桌面应用模式：调用真正的 Tauri 命令
        const { invoke } = await import("@tauri-apps/api/core");
        
        // 提取音频（只提取，不转写）
        const audioPathResult = await invoke<string>("extract_audio", {
          videoPath
        });
        setAudioPath(audioPathResult);
        setProgress(100);
        
      } else {
        // 纯前端模式：模拟流程
        for (let i = 0; i <= 100; i += 10) {
          await new Promise(r => setTimeout(r, 200));
          setProgress(i);
        }
        setAudioPath("/fake/audio/path.wav");
      }

      setIsProcessing(false);
      setStep("idle");
      message.success("音频提取完成！");
      onNext();

    } catch (error) {
      console.error("Processing failed:", error);
      const errorMsg = (error as any).message || (error as any).toString() || JSON.stringify(error);
      console.error("Full error:", error);
      message.error("处理失败：" + errorMsg);
      setIsProcessing(false);
      setStep("idle");
    }
  };

  const props = {
    name: "file",
    multiple: false,
    accept: ".mp4,.mkv,.avi,.mov,.flv,.wmv",
    showUploadList: false,
    beforeUpload: (file: File) => {
      const isSupported = 
        file.type.startsWith("video/") || 
        file.name.match(/\.(mp4|mkv|avi|mov|flv|wmv)$/i);
      
      if (!isSupported) {
        message.error("只支持视频文件！");
        return Upload.LIST_IGNORE;
      }
      
      setVideoFile(file, "web-mode-" + file.name);
      message.success("文件选择成功！");
      return false;
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <Card>
        <Title level={3} style={{ marginBottom: 24 }}>选择视频文件</Title>
        
        {!videoFile && (
          <>
            <Button 
              type="primary" 
              size="large" 
              icon={<InboxOutlined />}
              onClick={handleSelectFile}
              style={{ marginBottom: 24, width: "100%", height: 60 }}
            >
              选择视频文件
            </Button>

            <Dragger {...props} style={{ marginBottom: 24 }}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">或者拖拽视频文件到这里</p>
              <p className="ant-upload-hint">
                支持 mp4, mkv, avi, mov, flv, wmv 格式
              </p>
            </Dragger>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".mp4,.mkv,.avi,.mov,.flv,.wmv,video/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        {videoFile && (
          <Card type="inner" style={{ marginBottom: 24 }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Text strong>已选择文件：</Text>
              <Text>{videoFile.name}</Text>
              <Text type="secondary">
                大小：{(videoFile.size / 1024 / 1024).toFixed(2)} MB
              </Text>
              {isTauriAvailable && videoPath && !videoPath.startsWith("web-mode") && (
                <Text type="secondary">
                  路径：{videoPath}
                </Text>
              )}
              {!isTauriAvailable && (
                <Text type="secondary" style={{ color: "#faad14" }}>
                  提示：当前是浏览器模式，使用模拟数据。如需真实功能请运行桌面应用。
                </Text>
              )}
            </Space>
          </Card>
        )}

        {isProcessing && (
          <Card type="inner" style={{ marginBottom: 24 }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Text strong>
                {step === "extracting" ? (
                  <><AudioOutlined /> 正在提取音频...</>
                ) : (
                  <><FontSizeOutlined /> 正在转写字幕...</>
                )}
              </Text>
              <Progress percent={progress} status="active" />
            </Space>
          </Card>
        )}

        <Space>
          {videoFile && !isProcessing && (
            <Button 
              type="primary" 
              onClick={handleProcess}
              size="large"
            >
              开始提取音频并转写
            </Button>
          )}
        </Space>
      </Card>
    </div>
  );
}

export default FileSelect;
