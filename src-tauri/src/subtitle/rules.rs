#[derive(Debug, Clone)]
pub struct PostProcessConfig {
    pub min_duration_ms: f64,
    pub max_duration_ms: f64,
    pub merge_threshold_ms: f64,
    pub duplicate_similarity: f64,
    pub quality_threshold: f64,
    pub max_single_char_len: usize,
    pub max_consecutive_duplicates: usize,
    pub remove_empty_segments: bool,
    pub remove_single_char: bool,
    pub merge_overlapping: bool,
    pub merge_duplicates: bool,
    pub enable_quality_filter: bool,
}

impl Default for PostProcessConfig {
    fn default() -> Self {
        PostProcessConfig {
            min_duration_ms: 0.3,
            max_duration_ms: 15.0,
            merge_threshold_ms: 0.5,
            duplicate_similarity: 0.95,
            quality_threshold: 0.6,
            max_single_char_len: 1,
            max_consecutive_duplicates: 3,
            remove_empty_segments: true,
            remove_single_char: false,
            merge_overlapping: true,
            merge_duplicates: true,
            enable_quality_filter: true,
        }
    }
}

impl PostProcessConfig {
    pub fn builder() -> PostProcessConfigBuilder {
        PostProcessConfigBuilder { config: Self::default() }
    }
}

pub struct PostProcessConfigBuilder {
    config: PostProcessConfig,
}

impl PostProcessConfigBuilder {
    pub fn min_duration_ms(mut self, value: f64) -> Self {
        self.config.min_duration_ms = value;
        self
    }
    
    pub fn max_duration_ms(mut self, value: f64) -> Self {
        self.config.max_duration_ms = value;
        self
    }
    
    pub fn merge_threshold_ms(mut self, value: f64) -> Self {
        self.config.merge_threshold_ms = value;
        self
    }
    
    pub fn duplicate_similarity(mut self, value: f64) -> Self {
        self.config.duplicate_similarity = value;
        self
    }
    
    pub fn quality_threshold(mut self, value: f64) -> Self {
        self.config.quality_threshold = value;
        self
    }
    
    pub fn max_single_char_len(mut self, value: usize) -> Self {
        self.config.max_single_char_len = value;
        self
    }
    
    pub fn max_consecutive_duplicates(mut self, value: usize) -> Self {
        self.config.max_consecutive_duplicates = value;
        self
    }
    
    pub fn remove_empty_segments(mut self, value: bool) -> Self {
        self.config.remove_empty_segments = value;
        self
    }
    
    pub fn remove_single_char(mut self, value: bool) -> Self {
        self.config.remove_single_char = value;
        self
    }
    
    pub fn merge_overlapping(mut self, value: bool) -> Self {
        self.config.merge_overlapping = value;
        self
    }
    
    pub fn merge_duplicates(mut self, value: bool) -> Self {
        self.config.merge_duplicates = value;
        self
    }
    
    pub fn enable_quality_filter(mut self, value: bool) -> Self {
        self.config.enable_quality_filter = value;
        self
    }
    
    pub fn build(self) -> PostProcessConfig {
        self.config
    }
}