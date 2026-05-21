use super::processor::SubtitleProcessor;
use super::rules::PostProcessConfig;
use crate::SubtitleSegment;
use std::sync::Arc;

pub struct Pipeline {
    processors: Vec<Arc<dyn SubtitleProcessor>>,
    config: PostProcessConfig,
}

impl Pipeline {
    pub fn new(processors: Vec<Arc<dyn SubtitleProcessor>>, config: PostProcessConfig) -> Self {
        Pipeline { processors, config }
    }
    
    pub fn builder() -> PipelineBuilder {
        PipelineBuilder {
            processors: Vec::new(),
            config: PostProcessConfig::default(),
        }
    }
    
    pub fn add_processor(&mut self, processor: Arc<dyn SubtitleProcessor>) {
        self.processors.push(processor);
    }
    
    pub fn remove_processor(&mut self, name: &str) -> bool {
        if let Some(index) = self.processors.iter().position(|p| p.name() == name) {
            self.processors.remove(index);
            true
        } else {
            false
        }
    }
    
    pub fn set_config(&mut self, config: PostProcessConfig) {
        self.config = config;
    }
    
    pub fn get_config(&self) -> &PostProcessConfig {
        &self.config
    }
    
    pub fn run(&self, segments: Vec<SubtitleSegment>) -> Vec<SubtitleSegment> {
        let original_count = segments.len();
        println!("[INFO] 开始后处理, 原始字幕数: {}", original_count);
        
        let mut result = segments;
        
        for (i, processor) in self.processors.iter().enumerate() {
            let before_count = result.len();
            result = processor.process(result, &self.config);
            let after_count = result.len();
            
            println!("[INFO] 处理器 {} ({}): {} -> {}", 
                i + 1, processor.name(), before_count, after_count);
        }
        
        let final_count = result.len();
        println!("[INFO] 后处理完成, 最终字幕数: {}, 减少: {} ({:.1}%)", 
            final_count, 
            original_count - final_count,
            ((original_count - final_count) as f64 / original_count as f64) * 100.0
        );
        
        self.renumber_segments(result)
    }
    
    fn renumber_segments(&self, mut segments: Vec<SubtitleSegment>) -> Vec<SubtitleSegment> {
        for (i, seg) in segments.iter_mut().enumerate() {
            seg.index = i as u32;
        }
        segments
    }
}

pub struct PipelineBuilder {
    processors: Vec<Arc<dyn SubtitleProcessor>>,
    config: PostProcessConfig,
}

impl PipelineBuilder {
    pub fn with_config(mut self, config: PostProcessConfig) -> Self {
        self.config = config;
        self
    }
    
    pub fn add_processor<T: SubtitleProcessor + 'static>(mut self, processor: T) -> Self {
        self.processors.push(Arc::new(processor));
        self
    }
    
    pub fn add_processor_arc(mut self, processor: Arc<dyn SubtitleProcessor>) -> Self {
        self.processors.push(processor);
        self
    }
    
    pub fn build(self) -> Pipeline {
        Pipeline {
            processors: self.processors,
            config: self.config,
        }
    }
}