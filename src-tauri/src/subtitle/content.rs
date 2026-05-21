use super::processor::SubtitleProcessor;
use super::rules::PostProcessConfig;
use crate::SubtitleSegment;

pub struct ContentProcessor;

impl SubtitleProcessor for ContentProcessor {
    fn name(&self) -> &'static str {
        "ContentProcessor"
    }
    
    fn process(&self, segments: Vec<SubtitleSegment>, config: &PostProcessConfig) -> Vec<SubtitleSegment> {
        if segments.is_empty() {
            return segments;
        }
        
        let mut result = Vec::new();
        let mut current_segment = segments[0].clone();
        let mut duplicate_count = 0;
        
        for seg in segments.iter().skip(1) {
            if config.merge_duplicates && ContentProcessor::is_duplicate(&current_segment, seg, config) {
                duplicate_count += 1;
                
                if duplicate_count < config.max_consecutive_duplicates {
                    current_segment.end = seg.end;
                    continue;
                } else {
                    duplicate_count = 0;
                }
            } else {
                duplicate_count = 0;
            }
            
            result.push(current_segment);
            current_segment = seg.clone();
        }
        
        result.push(current_segment);
        
        ContentProcessor::deduplicate_by_content(&mut result, config);
        
        result
    }
}

impl ContentProcessor {
    fn is_duplicate(a: &SubtitleSegment, b: &SubtitleSegment, config: &PostProcessConfig) -> bool {
        let text_a = &a.original_text;
        let text_b = &b.original_text;
        
        if text_a == text_b {
            return true;
        }
        
        let similarity = ContentProcessor::calculate_similarity(text_a, text_b);
        similarity >= config.duplicate_similarity
    }
    
    fn calculate_similarity(a: &str, b: &str) -> f64 {
        let a_chars: Vec<char> = a.chars().collect();
        let b_chars: Vec<char> = b.chars().collect();
        
        if a_chars.is_empty() || b_chars.is_empty() {
            return 0.0;
        }
        
        let mut dp = vec![vec![0; b_chars.len() + 1]; a_chars.len() + 1];
        
        for i in 0..=a_chars.len() {
            dp[i][0] = i;
        }
        for j in 0..=b_chars.len() {
            dp[0][j] = j;
        }
        
        for i in 1..=a_chars.len() {
            for j in 1..=b_chars.len() {
                let cost = if a_chars[i-1] == b_chars[j-1] { 0 } else { 1 };
                dp[i][j] = std::cmp::min(
                    std::cmp::min(dp[i-1][j] + 1, dp[i][j-1] + 1),
                    dp[i-1][j-1] + cost
                );
            }
        }
        
        let max_len = std::cmp::max(a_chars.len(), b_chars.len()) as f64;
        1.0 - (dp[a_chars.len()][b_chars.len()] as f64 / max_len)
    }
    
    fn deduplicate_by_content(segments: &mut Vec<SubtitleSegment>, config: &PostProcessConfig) {
        if segments.len() < 2 {
            return;
        }
        
        let mut i = 0;
        while i < segments.len() {
            let mut j = i + 1;
            while j < segments.len() {
                if ContentProcessor::is_duplicate(&segments[i], &segments[j], config) {
                    segments[i].end = segments[j].end;
                    segments.remove(j);
                } else {
                    j += 1;
                }
            }
            i += 1;
        }
    }
}