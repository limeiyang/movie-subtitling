import { Steps } from "antd";
import { useAppStore } from "../store/useAppStore";
import FileSelect from "./FileSelect";
import AsrSettings from "./AsrSettings";
import TranslationView from "./TranslationView";
import ExportDialog from "./ExportDialog";

const steps = [
  { title: "选择视频" },
  { title: "语音转文字" },
  { title: "字幕翻译" },
  { title: "导出字幕" }
];

function MainLayout() {
  const { currentStep, setCurrentStep } = useAppStore();

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return <FileSelect onNext={() => setCurrentStep(1)} />;
      case 1:
        return <AsrSettings onNext={() => setCurrentStep(2)} onBack={() => setCurrentStep(0)} />;
      case 2:
        return <TranslationView onNext={() => setCurrentStep(3)} onBack={() => setCurrentStep(1)} />;
      case 3:
        return <ExportDialog onBack={() => setCurrentStep(2)} />;
      default:
        return null;
    }
  };

  return (
    <div style={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column", padding: "24px" }}>
      <div style={{ marginBottom: "24px" }}>
        <Steps current={currentStep} items={steps} />
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {renderStepContent()}
      </div>
    </div>
  );
}

export default MainLayout;
