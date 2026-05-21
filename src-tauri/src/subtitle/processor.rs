use super::rules::PostProcessConfig;
use crate::SubtitleSegment;

pub trait SubtitleProcessor: Send + Sync {
    fn name(&self) -> &'static str;
    fn process(&self, segments: Vec<SubtitleSegment>, config: &PostProcessConfig) -> Vec<SubtitleSegment>;
}

pub struct ProcessorWrapper<T: SubtitleProcessor> {
    inner: T,
}

impl<T: SubtitleProcessor> ProcessorWrapper<T> {
    pub fn new(inner: T) -> Self {
        ProcessorWrapper { inner }
    }
}

impl<T: SubtitleProcessor> SubtitleProcessor for ProcessorWrapper<T> {
    fn name(&self) -> &'static str {
        self.inner.name()
    }
    
    fn process(&self, segments: Vec<SubtitleSegment>, config: &PostProcessConfig) -> Vec<SubtitleSegment> {
        self.inner.process(segments, config)
    }
}