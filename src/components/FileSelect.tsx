import { Button, Card, Upload, Typography, Space, message } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { useAppStore } from "../store/useAppStore";
import { invoke } from "@tauri-apps/api/core";

const { Dragger } = Upload;
const { Title, Text } = Typography;

interface FileSelectProps {
  onNext: () => void;
}

function FileSelect({ onNext }: FileSelectProps) {
  const { videoFile, videoPath, setVideoFile } = useAppStore();

  const handleSelectFile = async () => {
    try {
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
    } catch (error) {
      console.error("File selection failed:", error);
      message.warning("未选择文件或选择失败");
    }
  };

  const props = {
    name: "file",
    multiple: false,
    accept: ".mp4,.mkv,.avi,.mov,.flv,.wmv",
    showUploadList: false,
    beforeUpload: (file: File) => {
      const isSupported = [
        "video/mp4",
        "video/x-matroska",
        "video/x-msvideo",
        "video/quicktime"
      ].includes(file.type) || file.name.match(/\.(mp4|mkv|avi|mov|flv|wmv)$/i);
      
      if (!isSupported) {
        message.error("只支持视频文件！");
        return Upload.LIST_IGNORE;
      }
      
      setVideoFile(file, "");
      return false;
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <Card>
        <Title level={3} style={{ marginBottom: 24 }}>选择视频文件</Title>
        
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
          <p className="ant-upload-text">或者拖拽视频文件到这里</p>
          <p className="ant-upload-hint">
            支持 mp4, mkv, avi, mov, flv, wmv 格式
          </p>
        </Dragger>

        {videoFile && (
          <Card type="inner" style={{ marginBottom: 24 }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Text strong>已选择文件：</Text>
              <Text>{videoFile.name}</Text>
              <Text type="secondary">
                大小：{(videoFile.size / 1024 / 1024).toFixed(2)} MB
              </Text>
              {videoPath && (
                <Text type="secondary">
                  路径：{videoPath}
                </Text>
              )}
            </Space>
          </Card>
        )}

        <Space>
          <Button type="primary" onClick={onNext} disabled={!videoFile}>
            下一步：提取音频并转写
          </Button>
        </Space>
      </Card>
    </div>
  );
}

export default FileSelect;
