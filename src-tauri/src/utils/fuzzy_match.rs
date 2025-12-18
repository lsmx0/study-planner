// 模糊匹配工具
use strsim::jaro_winkler;

/// 默认相似度阈值
pub const DEFAULT_THRESHOLD: f64 = 0.7;

/// 检查两个字符串是否模糊匹配
pub fn fuzzy_match(input: &str, target: &str, threshold: f64) -> bool {
    let similarity = jaro_winkler(input, target);
    similarity >= threshold
}

/// 使用默认阈值检查模糊匹配
pub fn fuzzy_match_default(input: &str, target: &str) -> bool {
    fuzzy_match(input, target, DEFAULT_THRESHOLD)
}

/// 获取两个字符串的相似度
pub fn get_similarity(input: &str, target: &str) -> f64 {
    jaro_winkler(input, target)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exact_match() {
        assert!(fuzzy_match_default("学习数学", "学习数学"));
    }

    #[test]
    fn test_similar_match() {
        assert!(fuzzy_match("学习数学", "学数学", 0.6));
    }

    #[test]
    fn test_no_match() {
        assert!(!fuzzy_match_default("学习数学", "看电影"));
    }
}
