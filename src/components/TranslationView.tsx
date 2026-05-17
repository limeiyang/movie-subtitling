import { useState } from "react";
import { Button, Card, Select, Typography, Space, Input, Divider, Row, Col, List, Progress } from "antd";
import { useAppStore, SubtitleSegment as StoreSubtitleSegment } from "../store/useAppStore";
import { invoke } from "@tauri-apps/api/core";

const { Title, Text } = Typography;
const { Option } = Select;

interface TranslationViewProps {
  onNext: () => void;
  onBack: () => void;
}

type LLMProvider = "openai" | "minimax" | "deepseek" | "custom";

interface PromptTemplate {
  id: string;
  name: string;
  systemPrompt: string;
  userPromptTemplate: string;
}

const defaultPrompts: PromptTemplate[] = [
  {
    id: "default",
    name: "默认字幕翻译",
    systemPrompt: "你是一个专业的字幕翻译员。翻译时保持简洁，符合字幕阅读习惯，控制句子长度，不要添加解释。",
    userPromptTemplate: "将以下 {from} 文本翻译为 {to}：{text}"
  },
  {
    id: "formal",
    name: "正式书面语",
    systemPrompt: "你是一个专业的翻译，使用正式、书面化的语言进行翻译，保持原文的语气和风格。",
    userPromptTemplate: "将以下 {from} 文本翻译为 {to}：{text}"
  }
];

function TranslationView({ onNext, onBack }: TranslationViewProps) {
  const { 
    originalSegments, 
    translationHistory, 
    addTranslation,
    currentLeftHistoryIndex, 
    currentRightHistoryIndex,
    setLeftHistoryIndex,
    setRightHistoryIndex
  } = useAppStore();
  
  const [provider, setProvider] = useState<LLMProvider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [fromLang, setFromLang] = useState("英文");
  const [toLang, setToLang] = useState("中文");
  const [selectedPrompt, setSelectedPrompt] = useState("default");
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleTranslate = async () => {
    setIsTranslating(true);
    setProgress(0);

    const mockTranslate();
  };

  const mockTranslate = async () => {
    setIsTranslating(true);
    setProgress(0);

    const doTranslate = async () => {
      const segments = originalSegments;
      let progressStep = 100 / segments.length;
      let currentProgress = 0;

      for (let i = 0; i < segments.length; i += 10) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        currentProgress += Math.min(10 * progressStep, 100);
        setProgress(Math.min(currentProgress, 100));
      }

      const translated: StoreSubtitleSegment[] = originalSegments.map(seg => ({
        ...seg,
        translatedText: seg.originalText
          .replace("Hello", "你好")
          .replace("welcome", "欢迎")
          .replace("video", "视频")
          .replace("AI technology", "AI技术")
          .replace("changing the world", "改变世界")
          .replace("Let's get started", "让我们开始")
          .replace("basics", "基础知识")
          .replace("First", "首先")
          .replace("understand", "了解")
          .replace("machine learning", "机器学习")
      }));

      addTranslation({
        id: Date.now().toString(),
        promptId: selectedPrompt,
        promptName: defaultPrompts.find(p => p.id === selectedPrompt)?.name || "自定义",
        result: translated,
        timestamp: Date.now()
      });

      setIsTranslating(false);
    };

    doTranslate();
  };

  const actualTranslate = async () => {
    const prompt = defaultPrompts.find(p => p.id === selectedPrompt);
    
    const segments = originalSegments.map(s => ({
      index: s.index,
      start: s.start,
      end: s.end,
      original_text: s.originalText,
      translated_text: s.translatedText,
    }));

    invoke("translate_subtitle", {
      segments,
      provider,
      apiKey,
      model,
      fromLang,
      toLang,
      systemPrompt: prompt?.systemPrompt || "",
    });
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
  };

  const getDisplaySegments = () => {
    if (translationHistory.length === 0) {
      return { left: originalSegments, right: null };
    }
    
    const leftSegs = currentLeftHistoryIndex === -1 
      ? originalSegments 
      : translationHistory[currentLeftHistoryIndex].result;
    
    const rightSegs = currentRightHistoryIndex === -1 
      ? null 
      : translationHistory[currentRightHistoryIndex].result;
    
    return { left: leftSegs, right: rightSegs };
  };

  const { left, right } = getDisplaySegments();

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", height: "100%" }}>
      <Card style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <Title level={3} style={{ margin: 0 }}>字幕翻译</Title>
          <Space>
            <Button onClick={onBack}>返回</Button>
            <Button type="primary" onClick={onNext} disabled={translationHistory.length === 0}>
              下一步：导出字幕
            </Button>
          </Space>
        </div>

        <Card type="inner" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Text strong>源语言：</Text>
              <Select value={fromLang} onChange={setFromLang} style={{ width: "100%", marginTop: 8 }}>
                <Option value="英文">英文</Option>
                <Option value="日文">日文</Option>
                <Option value="韩文">韩文</Option>
                <Option value="自动检测">自动检测</Option>
              </Select>
            </Col>
            <Col span={6}>
              <Text strong>目标语言：</Text>
              <Select value={toLang} onChange={setToLang} style={{ width: "100%", marginTop: 8 }}>
                <Option value="中文">中文</Option>
                <Option value="英文">英文</Option>
                <Option value="日文">日文</Option>
              </Select>
            </Col>
            <Col span={6}>
              <Text strong>LLM 提供商：</Text>
              <Select value={provider} onChange={setProvider} style={{ width: "100%", marginTop: 8 }}>
                <Option value="openai">OpenAI</Option>
                <Option value="minimax">MiniMax (国内)</Option>
                <Option value="deepseek">DeepSeek (国内)</Option>
                <Option value="custom">自定义</Option>
              </Select>
            </Col>
            <Col span={6}>
              <Text strong>模型：</Text>
              <Select value={model} onChange={setModel} style={{ width: "100%", marginTop: 8 }}>
                <Option value="gpt-4o-mini">gpt-4o-mini</Option>
                <Option value="gpt-4o">gpt-4o</Option>
              </Select>
            </Col>
          </Row>
          
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={12}>
              <Text strong>API Key：</Text>
              <Input.Password
                placeholder="输入 API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                style={{ marginTop: 8 }}
              />
            </Col>
            <Col span={12}>
              <Text strong>翻译提示词：</Text>
              <Select value={selectedPrompt} onChange={setSelectedPrompt} style={{ width: "100%", marginTop: 8 }}>
                {defaultPrompts.map(p => (
                  <Option key={p.id} value={p.id}>{p.name}</Option>
                ))}
              </Select>
            </Col>
          </Row>

          {isTranslating && (
            <div style={{ marginTop: 16 }}>
              <Progress percent={progress} status="active" />
              <Text type="secondary">正在翻译，请稍候...</Text>
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <Button
              type="primary"
              onClick={handleTranslate}
              disabled={isTranslating || !apiKey}
              loading={isTranslating}
            >
              开始翻译
            </Button>
          </div>
        </Card>

        {translationHistory.length > 0 && (
          <Card type="inner" style={{ marginBottom: 16 }}>
            <Space>
              <Text strong>对比历史翻译：</Text>
              <Select
                value={currentLeftHistoryIndex}
                onChange={setLeftHistoryIndex}
                style={{ width: 200 }}
              >
                <Option value={-1}>原文</Option>
                {translationHistory.map((h, i) => (
                  <Option key={i} value={i}>{h.promptName} ({new Date(h.timestamp).toLocaleTimeString()})</Option>
                ))}
              </Select>
              <Text>←→</Text>
              <Select
                value={currentRightHistoryIndex}
                onChange={setRightHistoryIndex}
                style={{ width: 200 }}
              >
                {translationHistory.map((h, i) => (
                  <Option key={i} value={i}>{h.promptName} ({new Date(h.timestamp).toLocaleTimeString()})</Option>
                ))}
              </Select>
            </Space>
          </Card>
        )}

        <Divider style={{ margin: "8px 0" }} />

        <div style={{ flex: 1, overflow: "auto" }}>
          <Row gutter={16}>
            <Col span={right ? 12 : 24}>
              <Card 
                type="inner" 
                title={currentLeftHistoryIndex === -1 ? "原文" : translationHistory[currentLeftHistoryIndex]?.promptName}
                style={{ height: "100%" }}
              >
                <List
                  dataSource={left}
                  renderItem={(item) => (
                    <List.Item>
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {formatTime(item.start)} → {formatTime(item.end)}
                        </Text>
                        <Text>{item.translatedText || item.originalText}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
            
            {right && (
              <Col span={12}>
                <Card 
                  type="inner" 
                  title={translationHistory[currentRightHistoryIndex]?.promptName}
                  style={{ height: "100%" }}
                >
                  <List
                    dataSource={right}
                    renderItem={(item) => (
                      <List.Item>
                        <Space direction="vertical" style={{ width: "100%" }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {formatTime(item.start)} → {formatTime(item.end)}
                          </Text>
                          <Text>{item.translatedText || item.originalText}</Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                </Card>
              </Col>
            )}
          </Row>
        </div>
      </Card>
    </div>
  );
}

export default TranslationView;
