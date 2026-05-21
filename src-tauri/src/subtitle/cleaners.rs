use super::processor::SubtitleProcessor;
use super::rules::PostProcessConfig;
use crate::SubtitleSegment;

pub struct CleanupProcessor;

impl SubtitleProcessor for CleanupProcessor {
    fn name(&self) -> &'static str {
        "CleanupProcessor"
    }
    
    fn process(&self, segments: Vec<SubtitleSegment>, config: &PostProcessConfig) -> Vec<SubtitleSegment> {
        let mut result: Vec<SubtitleSegment> = Vec::new();
        
        for (idx, seg) in segments.into_iter().enumerate() {
            let mut text = seg.original_text.trim().to_string();
            
            text = text.replace('♪', "");
            text = text.replace('~', "");
            text = text.replace("～", "");
            text = text.replace("♩", "");
            text = text.replace("♫", "");
            
            text = text.replace("\\n", " ");
            text = text.replace("\n", " ");
            text = text.replace("\r", "");
            
            text = text.split_whitespace().collect::<Vec<_>>().join(" ");
            
            if config.remove_empty_segments && text.is_empty() {
                continue;
            }
            
            if config.remove_single_char && text.len() <= config.max_single_char_len {
                continue;
            }
            
            let mut start = seg.start;
            let mut end = seg.end;
            let duration = end - start;
            
            let is_duration_abnormal = duration <= 0.0 || duration > 3600.0;
            let is_end_abnormal = end > 7200.0 && idx < 50;
            let is_end_too_large = idx > 0 && result.len() > 0 && end > result.last().unwrap().end + 60.0;
            
            if is_duration_abnormal || is_end_abnormal || is_end_too_large {
                if idx > 0 && result.len() > 0 {
                    start = result.last().unwrap().end;
                    end = start + 3.0;
                } else {
                    end = start + 3.0;
                }
            }
            
            if !result.is_empty() && start < result.last().unwrap().end {
                start = result.last().unwrap().end;
                if end <= start {
                    end = start + 3.0;
                }
            }
            
            result.push(SubtitleSegment {
                index: seg.index,
                start,
                end,
                original_text: text,
                translated_text: seg.translated_text,
            });
        }
        
        result
    }
}