import { useState, useEffect } from "react";
import { Button, Card, Select, Typography, Space, Input, Divider, Row, Col, Progress, message } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { useAppStore, SubtitleSegment as StoreSubtitleSegment } from "../store/useAppStore";

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

const CONFIG_KEY = "subtitle_translation_config";

function TranslationView({ onNext, onBack }: TranslationViewProps) {
  const { 
    originalSegments, 
    translationHistory, 
    detectedLanguage,
    addTranslation,
    currentLeftHistoryIndex, 
    currentRightHistoryIndex,
    setLeftHistoryIndex,
    setRightHistoryIndex
  } = useAppStore();
  
  const [provider, setProvider] = useState<LLMProvider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [fromLang, setFromLang] = useState(() => {
    if (!detectedLanguage) return "英文";
    const langMap: Record<string, string> = {
      "en": "英文",
      "zh": "中文",
      "ja": "日文",
      "ko": "韩文",
      "fr": "法文",
      "de": "德文",
      "es": "西班牙文",
      "ru": "俄文",
    };
    return langMap[detectedLanguage] || "自动检测";
  });
  const [toLang, setToLang] = useState("中文");
  const [selectedPrompt, setSelectedPrompt] = useState("default");
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<"success" | "error" | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) {
      try {
        const config = JSON.parse(saved);
        if (config.provider) setProvider(config.provider as LLMProvider);
        if (config.apiKey) setApiKey(config.apiKey);
        if (config.model) setModel(config.model);
        if (config.fromLang) setFromLang(config.fromLang);
        if (config.toLang) setToLang(config.toLang);
        if (config.selectedPrompt) setSelectedPrompt(config.selectedPrompt);
      } catch (e) {
        console.error("Failed to load config:", e);
      }
    }
  }, []);

  const saveConfig = () => {
    const config = {
      provider,
      apiKey: apiKey ? "***" : "",
      model,
      fromLang,
      toLang,
      selectedPrompt
    };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  };

  const getModelsForProvider = (prov: LLMProvider): string[] => {
    switch (prov) {
      case "openai":
        return ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"];
      case "minimax":
        return ["MiniMax-M2.7", "MiniMax-M2.7-highspeed", "MiniMax-Text-01"];
      case "deepseek":
        return ["deepseek-chat", "deepseek-coder"];
      case "custom":
        return ["custom-model"];
      default:
        return ["gpt-4o-mini"];
    }
  };

  const handleProviderChange = (newProvider: LLMProvider) => {
    setProvider(newProvider);
    const models = getModelsForProvider(newProvider);
    setModel(models[0]);
    setApiTestResult(null);
    saveConfig();
  };

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    saveConfig();
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    setApiTestResult(null);
  };

  const handleLangChange = () => {
    saveConfig();
  };

  const testApiConnection = async () => {
    console.log("testApiConnection called");
    console.log("provider:", provider);
    console.log("apiKey length:", apiKey.length);
    
    if (!apiKey) {
      message.warning("请先输入 API Key");
      return;
    }

    setIsTestingApi(true);
    setApiTestResult(null);

    try {
      console.log("Calling invoke test_api_connection");
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<boolean>("test_api_connection", {
        provider: provider,
        apikey: apiKey
      });
      console.log("API test result:", result);

      if (result) {
        setApiTestResult("success");
        message.success("API 连接测试成功！");
      } else {
        setApiTestResult("error");
        message.error("API 连接测试失败，请检查 API Key 是否正确");
      }
    } catch (error) {
      console.error("API test error:", error);
      setApiTestResult("error");
      message.error("API 连接测试失败，请检查网络连接或 API Key");
    } finally {
      setIsTestingApi(false);
    }
  };

  const handleTranslate = async () => {
    if (!apiKey) {
      message.warning("请先输入 API Key");
      return;
    }

    setIsTranslating(true);
    setProgress(0);

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const prompt = defaultPrompts.find(p => p.id === selectedPrompt);
      const systemPrompt = prompt?.systemPrompt || "你是一个专业的字幕翻译员。";

      const segments: StoreSubtitleSegment[] = await invoke("translate_subtitle", {
        segments: originalSegments,
        provider,
        api_key: apiKey,
        model,
        from_lang: fromLang === "自动检测" ? "English" : fromLang,
        to_lang: toLang,
        system_prompt: systemPrompt
      });

      addTranslation({
        id: Date.now().toString(),
        promptId: selectedPrompt,
        promptName: prompt?.name || "自定义",
        result: segments,
        timestamp: Date.now()
      });

      setProgress(100);
      message.success("翻译完成！");
    } catch (error) {
      console.error("Translation error:", error);
      message.error("翻译失败，请检查 API Key 和网络连接");
    } finally {
      setIsTranslating(false);
    }
  };

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
              <Select value={fromLang} onChange={(v) => { setFromLang(v); handleLangChange(); }} style={{ width: "100%", marginTop: 8 }}>
                <Option value="英文">英文</Option>
                <Option value="日文">日文</Option>
                <Option value="韩文">韩文</Option>
                <Option value="自动检测">自动检测</Option>
              </Select>
            </Col>
            <Col span={6}>
              <Text strong>目标语言：</Text>
              <Select value={toLang} onChange={(v) => { setToLang(v); handleLangChange(); }} style={{ width: "100%", marginTop: 8 }}>
                <Option value="中文">中文</Option>
                <Option value="英文">英文</Option>
                <Option value="日文">日文</Option>
              </Select>
            </Col>
            <Col span={6}>
              <Text strong>LLM 提供商：</Text>
              <Select value={provider} onChange={handleProviderChange} style={{ width: "100%", marginTop: 8 }}>
                <Option value="openai">OpenAI</Option>
                <Option value="minimax">MiniMax (国内)</Option>
                <Option value="deepseek">DeepSeek (国内)</Option>
                <Option value="custom">自定义</Option>
              </Select>
            </Col>
            <Col span={6}>
              <Text strong>模型：</Text>
              <Select value={model} onChange={handleModelChange} style={{ width: "100%", marginTop: 8 }}>
                {getModelsForProvider(provider).map(m => (
                  <Option key={m} value={m}>{m}</Option>
                ))}
              </Select>
            </Col>
          </Row>
          
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={16}>
              <Text strong>API Key：</Text>
              <Space style={{ marginTop: 8, width: "100%" }}>
                <Input.Password
                  placeholder="输入 API Key"
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  style={{ flex: 1 }}
                />
                <Button
                  onClick={testApiConnection}
                  loading={isTestingApi}
                  icon={apiTestResult === "success" ? <CheckCircleOutlined /> : apiTestResult === "error" ? <CloseCircleOutlined /> : undefined}
                  type={apiTestResult === "success" ? "primary" : apiTestResult === "error" ? "default" : "default"}
                  style={{ 
                    backgroundColor: apiTestResult === "success" ? "#52c41a" : apiTestResult === "error" ? "#ff4d4f" : undefined,
                    borderColor: apiTestResult === "success" ? "#52c41a" : apiTestResult === "error" ? "#ff4d4f" : undefined
                  }}
                >
                  测试连接
                </Button>
              </Space>
            </Col>
            <Col span={8}>
              <Text strong>翻译提示词：</Text>
              <Select value={selectedPrompt} onChange={(v) => { setSelectedPrompt(v); saveConfig(); }} style={{ width: "100%", marginTop: 8 }}>
                {defaultPrompts.map(p => (
                  <Option key={p.id} value={p.id}>{p.name}</Option>
                ))}
              </Select>
            </Col>
          </Row>

          {isTranslating && (
            <div style={{ marginTop: 16 }}>
              <Progress percent={Math.round(progress)} status="active" />
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
                <Option value={-1}>原文</Option>
                {translationHistory.map((h, i) => (
                  <Option key={i} value={i}>{h.promptName} ({new Date(h.timestamp).toLocaleTimeString()})</Option>
                ))}
              </Select>
            </Space>
          </Card>
        )}

        <Card type="inner" style={{ flex: 1, overflow: "auto" }}>
          <Row gutter={16}>
            <Col span={12}>
              <Text strong>{currentLeftHistoryIndex === -1 ? "原文" : translationHistory[currentLeftHistoryIndex]?.promptName}</Text>
            </Col>
            <Col span={12}>
              <Text strong>翻译结果</Text>
            </Col>
          </Row>
          <Divider style={{ margin: "8px 0" }} />
          <div style={{ maxHeight: 400, overflow: "auto" }}>
            {left.map((segment, index) => (
              <Row key={index} gutter={16} style={{ marginBottom: 8, padding: "4px 0", borderBottom: "1px solid #f0f0f0" }}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>{formatTime(segment.start)} → {formatTime(segment.end)}</Text>
                  <div>{segment.originalText}</div>
                </Col>
                <Col span={12}>
                  <div style={{ color: "#1890ff" }}>{right ? right[index]?.translatedText || segment.originalText : segment.originalText}</div>
                </Col>
              </Row>
            ))}
          </div>
        </Card>
      </Card>
    </div>
  );
}

export default TranslationView;
