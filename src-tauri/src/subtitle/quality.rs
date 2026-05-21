use super::processor::SubtitleProcessor;
use super::rules::PostProcessConfig;
use crate::SubtitleSegment;

pub struct QualityProcessor;

impl SubtitleProcessor for QualityProcessor {
    fn name(&self) -> &'static str {
        "QualityProcessor"
    }
    
    fn process(&self, segments: Vec<SubtitleSegment>, config: &PostProcessConfig) -> Vec<SubtitleSegment> {
        if !config.enable_quality_filter {
            return segments;
        }
        
        segments.into_iter()
            .filter(|seg| QualityProcessor::calculate_quality(seg) >= config.quality_threshold)
            .collect()
    }
}

impl QualityProcessor {
    fn calculate_quality(seg: &SubtitleSegment) -> f64 {
        let text = &seg.original_text;
        let duration = seg.end - seg.start;
        
        let mut score = 0.0;
        let mut weight_sum = 0.0;
        
        let text_length_score = QualityProcessor::score_text_length(text);
        score += text_length_score * 0.3;
        weight_sum += 0.3;
        
        let duration_score = QualityProcessor::score_duration(duration);
        score += duration_score * 0.3;
        weight_sum += 0.3;
        
        let repetition_score = QualityProcessor::score_repetition(text);
        score += repetition_score * 0.2;
        weight_sum += 0.2;
        
        let semantic_score = QualityProcessor::score_semantic(text);
        score += semantic_score * 0.2;
        weight_sum += 0.2;
        
        if weight_sum > 0.0 {
            score / weight_sum
        } else {
            0.0
        }
    }
    
    fn score_text_length(text: &str) -> f64 {
        let len = text.len();
        
        if len == 0 {
            0.0
        } else if len <= 2 {
            0.3
        } else if len <= 5 {
            0.6
        } else if len <= 50 {
            1.0
        } else if len <= 100 {
            0.8
        } else {
            0.5
        }
    }
    
    fn score_duration(duration: f64) -> f64 {
        if duration < 0.3 {
            0.2
        } else if duration < 0.5 {
            0.5
        } else if duration < 10.0 {
            1.0
        } else if duration < 15.0 {
            0.7
        } else {
            0.4
        }
    }
    
    fn score_repetition(text: &str) -> f64 {
        let chars: Vec<char> = text.chars().collect();
        
        if chars.len() < 2 {
            return 1.0;
        }
        
        let mut repeat_count = 0;
        for i in 0..chars.len()-1 {
            if chars[i] == chars[i+1] {
                repeat_count += 1;
            }
        }
        
        let repeat_ratio = repeat_count as f64 / chars.len() as f64;
        
        if repeat_ratio > 0.5 {
            0.3
        } else if repeat_ratio > 0.3 {
            0.6
        } else {
            1.0
        }
    }
    
    fn score_semantic(text: &str) -> f64 {
        let noise_patterns = ["(音楽)", "(music)", "♪", "~", "---", "...", "......"];
        
        for pattern in noise_patterns.iter() {
            if text == *pattern {
                return 0.2;
            }
        }
        
        if text.chars().all(|c| c.is_ascii_punctuation()) {
            return 0.1;
        }
        
        let has_meaningful_chars = text.chars().any(|c| c.is_alphanumeric());
        if !has_meaningful_chars {
            return 0.2;
        }
        
        1.0
    }
}